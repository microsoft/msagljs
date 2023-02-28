import { Unit, Accessor, Color, Layer, LayerProps, DefaultProps} from '@deck.gl/core/typed'
import {Buffer} from '@luma.gl/webgl'
import {IconLayer, IconLayerProps, TextLayer, TextLayerProps} from '@deck.gl/layers/typed'
import {ICurve, Point, BezierSeg, Ellipse, Entity, Edge, GeomEdge, GeomLabel, CurveClip} from 'msagl-js'
import { DrawingEdge, DrawingObject } from 'msagl-js/drawing'
import {iconMapping} from './arrows'

import CurveLayer, {CurveLayerProps} from './curve-layer'
import {CURVE} from './curve-layer'

type EdgeLayerProps = CurveLayerProps<ICurve> & {
  resolution?: number
}

export function getEdgeLayer(props: EdgeLayerProps, dataCache: any): Layer {
  
  if (!dataCache.curves) {
    dataCache.curves = Array.from(
      getCurves(props.data as Iterable<CurveClip>, (segment: ICurve, datum: CurveClip, index: number) => {
        // @ts-expect-error
        segment.__source = {
          parent: this,
          object: datum,
          index: index
        };
        return segment
      }),
    )
  }

  const {id, resolution} = props

  return new CurveLayer<ICurve>(props, {
    id: `${id}-edge`,
    data: dataCache.curves,
    getCurveType,
    getControlPoints,
    getRange: (d: ICurve) => {
      // @ts-ignore
      return [d.parStart, d.parEnd]
    },
    widthUnits: 'pixels',
    // one vertex per 4 pixels
    getResolution: (d: ICurve) => {
      // @ts-ignore
      return d.length * resolution
    },
    // @ts-ignore
    clipByInstance: false,
  })
}

export function getArrowHeadLayer(props: IconLayerProps<{
  tip: Point
  edge: Edge
  base: Point
}>): Layer {
  const {id, getColor} = props

  return new IconLayer<{
    tip: Point
    edge: Edge
    base: Point
  }>(
    props,
    {
      id: `${id}-arrowhead`,
      iconAtlas: 'deck://arrowAtlas',
      iconMapping,
      getPosition: (d) => [d.tip.x, d.tip.y],
      getColor: getColor || ((d) => getEdgeColor(d.edge)),
      getIcon: (d) => getEdgeType(d.edge),
      getSize: (d) => getArrowSize(d.tip, d.base),
      getAngle: (d) => getArrowAngle(d.tip, d.base),
      billboard: false,
      sizeUnits: 'common',
    },
  )
}

export function getEdgeLabelLayer(props: TextLayerProps<GeomLabel>): Layer {
  const {id, getColor = getLabelColor} = props

  return new TextLayer<GeomLabel>(
    props,
    {
      id: `${id}-edge-label`,
      getText: getLabelText,
      getSize: getLabelSize,
      getColor,
      getPosition: (d: GeomLabel) => [d.center.x, d.center.y],
      sizeUnits: 'common',
    },
  )
}

function getCurveType(c: ICurve): CURVE {
  if (c instanceof Ellipse) {
    return CURVE.Arc
  }
  if (c instanceof BezierSeg) {
    return CURVE.Bezier
  }
  return CURVE.Line
}

function getControlPoints(c: ICurve): number[] {
  if (c instanceof Ellipse) {
    return [c.center, c.aAxis, c.bAxis].flatMap(pointToArray)
  }
  if (c instanceof BezierSeg) {
    return c.b.flatMap(pointToArray)
  }
  return [c.start, c.end].flatMap(pointToArray)
}

function* getCurves(data: Iterable<CurveClip>, transform: (segment: ICurve, datum: CurveClip, index: number) => ICurve): Generator<ICurve> {
  let j = 0
  for (const cc of data) {
    const {curve} = cc
    // @ts-ignore
    transform(curve, cc, j)
    yield curve

    j++
  }
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
  return DrawingObject.getDrawingObj(e) as T;
}
