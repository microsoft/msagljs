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
  }

export function getNodeLayers(props: NodeLayerProps, style: ParsedGraphNodeLayerStyle): LayersList {
  const {tileMap, levelIndex} = props
  const getScale = (n: GeomNode): number => {
    if (tileMap && levelIndex != null) return tileMap.getNodeScale(n.node, levelIndex)
    return 1
  }
  // Only draw the node boundary for clusters (GeomGraph). Ordinary nodes are
  // rendered as labels only — no rectangle / rounded-rectangle border — which
  // produces a cleaner "text-only" look for datasets like gameofthrones.json
  // where box borders add noise.
  const data = (props.data as GeomNode[]) ?? []
  const clusterData = data.filter((n) => n instanceof GeomGraph)
  const layers: LayersList = []
  if (clusterData.length > 0) {
    layers.push(
      new GeometryLayer<GeomNode>(props, {
        id: `${props.id}-node-boundary`,
        data: clusterData,
        lineWidthUnits: 'pixels',
        getPosition: getNodeCenter,
        getSize: (e: GeomNode) => {
          const s = getScale(e)
          return [e.boundingBox.width * s, e.boundingBox.height * s]
        },
        getShape: (e: GeomNode) => getShapeFromNode(e.node),
        getIsCluster: (e: GeomNode) => (e instanceof GeomGraph ? 1 : 0),
        cornerRadius: getCornerRadius(clusterData[0]),
        getLineColor: getNodeColor,
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
    )
  }
  layers.push(
    new TextLayer<GeomNode>(props, {
      id: `${props.id}-node-label`,
      getPosition: getLabelPosition,
      getText: getLabelText,
      getSize: (n: GeomNode) => getLabelSize(n) * getScale(n),
      getColor: getNodeColor,
      billboard: false,
      sizeUnits: 'common',
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
  )
  return layers
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
function getNodeFillColor(e: GeomNode): [number, number, number, number] {
  const drawingNode = getDrawingObj<DrawingNode>(e.node)
  if (drawingNode) {
    const color = drawingNode.fillColor
    if (color) return [color.R, color.G, color.B, color.A]
  }
  return [255, 255, 255, 255]
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
