import {LayersList, Color, Position} from '@deck.gl/core/typed'
import {TextLayer, TextLayerProps} from '@deck.gl/layers/typed'
import {GeomNode, GeomGraph, Node, Entity, TileMap} from '@msagl/core'
import {DrawingNode, DrawingObject, ShapeEnum} from '@msagl/drawing'

import GeometryLayer, {GeometryLayerProps, SHAPE} from './geometry-layer'
import {ParsedGraphNodeLayerStyle} from '../styles/graph-style-evaluator'
import GraphStyleExtension from './graph-style-extension'

type NodeLayerProps = GeometryLayerProps<GeomNode> &
  TextLayerProps<GeomNode> & {
    textColor: Color
    textSizeScale: number
    tileMap?: TileMap
    levelIndex?: number
    /** Viewport zoom at which this tile level is 1:1 (= tile.index.z). Used by
     *  GeometryLayer to interpolate node size across levels each frame. */
    nativeZoom?: number
  }

export function getNodeLayers(props: NodeLayerProps, style: ParsedGraphNodeLayerStyle): LayersList {
  const {tileMap, levelIndex, nativeZoom} = props
  // Per-node display scale at THIS level and at the next FINER level. We
  // interpolate toward the finer level (not the coarser one) because the finer
  // level is a SUPERSET of this one (V_z ⊆ V_{z+1}), so a node visible here is
  // guaranteed to also exist on the finer level — its finer scale always exists.
  // The coarser level can drop the node, which would force a fallback and break
  // continuity. The GeometryLayer mixes current -> finer per frame using the live
  // zoom (sizeLerp 0 at the level's lower zoom boundary, 1 at its native zoom),
  // so a node's on-screen size matches the finer level exactly at the moment the
  // tile switches, removing the jump. Routing still uses the full level scale in
  // the TileMap, so edges may not reach the interpolated boundaries mid-transition.
  const scaleAt = (n: GeomNode, idx: number): number => {
    if (tileMap && idx != null && idx >= 0) return tileMap.getNodeScale(n.node, idx)
    return 1
  }
  const scaleCurr = (n: GeomNode): number => (tileMap && levelIndex != null ? scaleAt(n, levelIndex) : 1)
  // Next finer level (levelIndex + 1). Always defined for a node present here;
  // at the finest level getNodeScale returns 1, which equals scaleCurr there.
  const scaleFiner = (n: GeomNode): number =>
    tileMap && levelIndex != null ? scaleAt(n, levelIndex + 1) : scaleCurr(n)
  const tiled = tileMap != null && levelIndex != null && nativeZoom != null
  // The FINEST level has no finer level (scaleCurr == scaleFiner == 1), so its node
  // box is NOT constant on screen: it grows as boundingBox * 2^zoom across the band.
  // A fixed-pixel label would stay put while the box grows. To make the label grow
  // at the SAME speed as the node there, render the finest-level label in 'common'
  // units (which scale with 2^zoom just like the box). This is also continuous with
  // the coarser levels' fixed-pixel labels: at the band's low end (zoom -> nativeZoom-1)
  // a 'common' label of getLabelSize*scaleCurr equals getLabelSize*scaleCurr*2^(nativeZoom-1)
  // pixels, the same value labelPixelSize produces, so there is no jump at the switch.
  const isFinest = tiled && (levelIndex as number) >= (tileMap as TileMap).numberOfLevels - 1
  // Labels pulsate because in 'common' units they grow ~2x across a tile-level
  // zoom band (and drop at the switch). TextLayer bakes sizeScale into its glyph
  // sublayer at render time, so a per-frame sizeScale override (as used for
  // opacity) does NOT animate label size. Instead we render labels in fixed
  // 'pixels', which are constant on screen by construction (no pulsation).
  //
  // The node box, however, is NOT constant on screen across a band: its size is
  // boundingBox * mix(scaleCurr, scaleFiner, t) * 2^zoom with t = zoom-nativeZoom+1.
  // On coarse levels scaleCurr ≈ 2*scaleFiner, so the mix cancels the 2^zoom growth
  // and the box stays ~constant; but at the FINEST level scaleCurr == scaleFiner == 1
  // (no finer level), so the box grows with zoom and is SMALLEST at the band's low
  // end (zoom -> nativeZoom-1, factor 2^(nativeZoom-1)). On coarse levels we keep the
  // fixed-pixel label sized to the box's minimum on-screen size over the band, so it
  // fits at EVERY zoom in the band. That minimum factor is min(scaleCurr, 2*scaleFiner)
  // (the box-scale curve's minimum is at a band endpoint) times 2^(nativeZoom-1). It is
  // continuous across level switches. (The finest level uses 'common' units instead;
  // see isFinest above.)
  const labelPixelSize = (n: GeomNode): number =>
    getLabelSize(n) * Math.min(scaleCurr(n), 2 * scaleFiner(n)) * Math.pow(2, (nativeZoom as number) - 1)
  return [
    new GeometryLayer<GeomNode>(props, {
      id: `${props.id}-node-boundary`,
      lineWidthUnits: 'pixels',
      getPosition: getNodeCenter,
      getSize: (e: GeomNode) => {
        const s = scaleCurr(e)
        return [e.boundingBox.width * s, e.boundingBox.height * s]
      },
      getSizeFiner: (e: GeomNode) => {
        const s = scaleFiner(e)
        return [e.boundingBox.width * s, e.boundingBox.height * s]
      },
      nativeZoom,
      getShape: (e: GeomNode) => getShapeFromNode(e.node),
      getIsCluster: (e: GeomNode) => (e instanceof GeomGraph ? 1 : 0),
      cornerRadius: getCornerRadius((props.data as GeomNode[])[0]),
      getLineColor: getNodeBorderColor,
      getFillColor: getNodeFillColor,

      extensions: [
        new GraphStyleExtension({
          overrideProps: {
            opacity: style.opacity,
            sizeScale: style.size,
            getFillColor: style.fillColor,
            getLineWidth: style.strokeWidth,
            getLineColor: style.strokeColor,
          },
        }),
      ],
    }),

    new TextLayer<GeomNode>(props, {
      id: `${props.id}-node-label`,
      getPosition: getLabelPosition,
      getText: getLabelText,
      // Tiled coarse levels: fixed-pixel size (constant on screen -> no pulsation),
      // scaled per node and per level so it tracks the ~constant box and is continuous
      // across levels. Tiled FINEST level: 'common' units so the label grows with the
      // (growing) node box at the same speed. Non-tiled: original 'common' behavior.
      getSize: (n: GeomNode) => (tiled && !isFinest ? labelPixelSize(n) : getLabelSize(n) * scaleCurr(n)),
      getColor: getNodeColor,
      billboard: false,
      sizeUnits: tiled && !isFinest ? 'pixels' : 'common',
      characterSet: 'auto',

      extensions: [
        new GraphStyleExtension({
          overrideProps: {
            opacity: style.opacity,
            getColor: style.labelColor,
            sizeScale: style.labelSize,
          },
        }),
      ],
    }),
  ]
}

function getNodeCenter(n: GeomNode, {index, data}: any): Position {
  return [n.center.x, n.center.y, 1 - index / data.length]
}

function getLabelPosition(n: GeomNode, context: any): Position {
  if (n instanceof GeomGraph) {
    const box = n.boundingBox
    return [box.center.x, box.bottom + (<GeomGraph>n).labelSize.height / 2 + 2]
  }
  return getNodeCenter(n, context)
}

function getLabelText(n: GeomNode): string {
  const drawingNode = getDrawingObj<DrawingNode>(n.node)
  return drawingNode.labelText
}

function getLabelSize(n: GeomNode): number {
  const drawingNode = getDrawingObj<DrawingNode>(n.node)
  return drawingNode.fontsize
}

function getCornerRadius(n: GeomNode): number {
  if (!n) return 0
  const drawingNode = getDrawingObj<DrawingNode>(n.node)
  return drawingNode.xRad
}

function getNodeColor(e: GeomNode): [number, number, number, number] {
  const drawingNode = getDrawingObj<DrawingNode>(e.node)
  if (drawingNode) {
    const color = drawingNode.pencolor
    if (color) return [color.R, color.G, color.B, color.A]
  }
  return [0, 0, 0, 255]
}
function getNodeBorderColor(e: GeomNode): [number, number, number, number] {
  const [r, g, b] = getNodeColor(e)
  // Faint border so labels stand out; edges show through clearly.
  return [r, g, b, 60]
}
function getNodeFillColor(e: GeomNode): [number, number, number, number] {
  const drawingNode = getDrawingObj<DrawingNode>(e.node)
  if (drawingNode) {
    const color = drawingNode.fillColor
    if (color) return [color.R, color.G, color.B, color.A]
  }
  return [255, 255, 255, 255]
}
function getTransparentFill(): [number, number, number, number] {
  return [0, 0, 0, 0]
}
/** 
the explanations of the shapes can be seen at
https://graphviz.org/doc/info/shapes.html#polygon
*/
function getShapeFromNode(node: Node): SHAPE {
  const drawingNode = getDrawingObj<DrawingNode>(node)
  if (drawingNode == null) {
    return SHAPE.Rectangle
  }
  switch (drawingNode.shape) {
    case ShapeEnum.diamond:
      return SHAPE.Diamond

    case ShapeEnum.ellipse:
      return SHAPE.Oval

    case ShapeEnum.box:
      return SHAPE.Rectangle

    case ShapeEnum.circle:
      return SHAPE.Oval

    case ShapeEnum.record:
      return SHAPE.Rectangle

    case ShapeEnum.plaintext:
      //here nothing is rendered except of the label
      return SHAPE.Oval

    case ShapeEnum.point:
      // draw a tiny circle
      return SHAPE.Oval

    case ShapeEnum.doublecircle:
      return SHAPE.Oval

    case ShapeEnum.octagon:
      return SHAPE.Oval

    case ShapeEnum.drawFromGeometry:
      // use the exact geometry of GeomNode.boundaryCurve
      return SHAPE.Rectangle

    case ShapeEnum.house:
      return SHAPE.Rectangle
    case ShapeEnum.invhouse:
      return SHAPE.Rectangle
    default:
      return SHAPE.Rectangle
  }
}

function getDrawingObj<T extends DrawingObject>(e: Entity): T {
  return DrawingObject.getDrawingObj(e) as T
}
