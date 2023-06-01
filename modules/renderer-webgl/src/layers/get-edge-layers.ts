import {Layer} from '@deck.gl/core/typed'
import {IconLayer, IconLayerProps, TextLayer, TextLayerProps} from '@deck.gl/layers/typed'
import {Point, BezierSeg, Ellipse, Entity, Edge, GeomEdge, GeomLabel, CurveClip} from '@msagl/core'
import {DrawingEdge, DrawingObject} from '@msagl/drawing'
import {iconMapping} from './arrows'

import CurveLayer, {CurveLayerProps} from './curve-layer'
import {CURVE} from './curve-layer'
import {ParsedGraphEdgeLayerStyle} from '../styles/graph-style-evaluator'
import GraphStyleExtension from './graph-style-extension'

type EdgeLayerProps = CurveLayerProps<CurveClip> & {
  resolution?: number
}

export function getEdgeLayer(props: EdgeLayerProps, style: ParsedGraphEdgeLayerStyle): Layer {

  return new CurveLayer<CurveClip>(props, {
    id: `${props.id}-edge`,
    data: props.data,
    getCurveType,
    getControlPoints,
    getRange: (d: CurveClip) => {
      return [d.startPar, d.endPar]
    },
    widthUnits: 'pixels',
    // one vertex per 4 pixels
    getResolution: (d: CurveClip) => {
      return d.curve.length * props.resolution
    },
    // @ts-ignore
    clipByInstance: false,

    extensions: [
      new GraphStyleExtension({
        overrideProps: {
          opacity: style.opacity,
          getWidth: style.strokeWidth,
          getColor: style.strokeColor,
        },
      }),
    ],
  })
}

export function getArrowHeadLayer(
  props: IconLayerProps<{
    tip: Point
    edge: Edge
    base: Point
  }>,
  style: ParsedGraphEdgeLayerStyle,
): Layer {
  return new IconLayer<{
    tip: Point
    edge: Edge
    base: Point
  }>(props, {
    id: `${props.id}-arrowhead`,
    iconAtlas: 'deck://arrowAtlas',
    iconMapping,
    getPosition: (d) => [d.tip.x, d.tip.y],
    getColor: (d) => getEdgeColor(d.edge),
    getIcon: (d) => getEdgeType(d.edge),
    getSize: (d) => getArrowSize(d.tip, d.base),
    getAngle: (d) => getArrowAngle(d.tip, d.base),
    billboard: false,
    sizeUnits: 'common',

    extensions: [
      new GraphStyleExtension({
        overrideProps: {
          opacity: style.opacity,
          sizeScale: style.arrowSize,
          getColor: style.arrowColor,
        },
      }),
    ],
  })
}

export function getEdgeLabelLayer(props: TextLayerProps<GeomLabel>, style: ParsedGraphEdgeLayerStyle): Layer {
  return new TextLayer<GeomLabel>(props, {
    id: `${props.id}-edge-label`,
    getText: getLabelText,
    getSize: getLabelSize,
    getColor: getLabelColor,
    getPosition: (d: GeomLabel) => [d.center.x, d.center.y],
    sizeUnits: 'common',
    characterSet: 'auto',

    extensions: [
      new GraphStyleExtension({
        overrideProps: {
          opacity: style.opacity,
          sizeScale: style.labelSize,
          getColor: style.labelColor,
        },
      }),
    ],
  })
}

function getCurveType(cc: CurveClip): CURVE {
  if (cc.curve instanceof Ellipse) {
    return CURVE.Arc
  }
  if (cc.curve instanceof BezierSeg) {
    return CURVE.Bezier
  }
  return CURVE.Line
}

function getControlPoints(cc: CurveClip): number[] {
  const c = cc.curve;
  if (c instanceof Ellipse) {
    return [c.center, c.aAxis, c.bAxis].flatMap(pointToArray)
  }
  if (c instanceof BezierSeg) {
    return c.b.flatMap(pointToArray)
  }
  return [c.start, c.end].flatMap(pointToArray)
}

function pointToArray(p: Point): [number, number] {
  return [p.x, p.y]
}

function getEdgeColor(e: Edge): [number, number, number] {
  const drawinEdge = getDrawingObj<DrawingEdge>(e)
  if (drawinEdge) {
    const color = drawinEdge.color
    if (color) return [color.R, color.G, color.B]
  }
  return [0, 0, 0]
}

function getEdgeType(e: Edge): string {
  return 'triangle-n'
}

function getArrowSize(tip: Point, end: Point): number {
  const dx = tip.x - end.x
  const dy = tip.y - end.y
  return Math.sqrt(dx * dx + dy * dy)
}

function getArrowAngle(tip: Point, end: Point): number {
  const dx = tip.x - end.x
  const dy = tip.y - end.y
  return (Math.atan2(dy, dx) / Math.PI) * 180
}

function getLabelText(l: GeomLabel): string {
  return getDrawingObj<DrawingEdge>(l.parent.entity).labelText
}

function getLabelSize(l: GeomLabel): number {
  return getDrawingObj<DrawingEdge>(l.parent.entity).fontsize
}

function getLabelColor(l: GeomLabel): [number, number, number] {
  const color = getDrawingObj<DrawingEdge>(l.parent.entity).labelfontcolor
  if (color) {
    return [color.R, color.G, color.B]
  }
  return [0, 0, 0]
}

function getDrawingObj<T extends DrawingObject>(e: Entity): T {
  return DrawingObject.getDrawingObj(e) as T
}
