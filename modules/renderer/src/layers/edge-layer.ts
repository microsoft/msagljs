import {CompositeLayer, Unit, Accessor, Color, UpdateParameters, Position, LayersList, LayerProps, DefaultProps} from '@deck.gl/core/typed'
import {Buffer} from '@luma.gl/webgl'
import {IconLayer} from '@deck.gl/layers/typed'
import {iconAtlas, iconMapping} from './arrows'
import {ICurve, GeomEdge, Point, LineSegment, BezierSeg, Ellipse, Curve} from 'msagl-js'
import {DrawingEdge, DrawingObject} from 'msagl-js/drawing'

import CurveLayer from './curve-layer'
import {CurveLayerProps, CURVE} from './curve-layer'

type EdgeLayerProps = {
  getDepth?: Buffer

  widthUnits?: Unit
  widthScale?: number
  widthMinPixels?: number
  widthMaxPixels?: number

  getWidth?: Accessor<GeomEdge, number>
  getColor?: Accessor<GeomEdge, Color>
} & LayerProps<GeomEdge>

const defaultProps: DefaultProps<EdgeLayerProps> = {
  widthUnits: 'common',
  widthScale: {type: 'number', min: 0, value: 1},
  widthMinPixels: {type: 'number', min: 0, value: 0},
  widthMaxPixels: {type: 'number', min: 0, value: Number.MAX_SAFE_INTEGER},

  getWidth: {type: 'accessor', value: 1},
  getColor: {type: 'accessor', value: [0, 0, 0, 255]},
}

type Arrow = {
  edge: GeomEdge
  type: string
  tip: Point
  end: Point
}

export default class EdgeLayer extends CompositeLayer<EdgeLayerProps> {
  static defaultProps = defaultProps

  state!: {
    arrows: Arrow[]
    curves: ICurve[]
  }

  updateState(params: UpdateParameters<this>) {
    super.updateState(params)

    if (params.changeFlags.dataChanged) {
      const arrows: Arrow[] = []
      const curves = Array.from(getCurves(params.props.data as Iterable<GeomEdge>))

      for (const eg of params.props.data as Iterable<GeomEdge>) {
        if (eg.sourceArrowhead) {
          arrows.push({
            edge: eg,
            type: 'triangle-n',
            tip: eg.sourceArrowhead.tipPosition,
            end: eg.curve.start,
          })
        }
        if (eg.targetArrowhead) {
          arrows.push({
            edge: eg,
            type: 'triangle-n',
            tip: eg.targetArrowhead.tipPosition,
            end: eg.curve.end,
          })
        }
      }
      this.setState({arrows, curves})
    }
  }

  renderLayers(): LayersList {
    const {getWidth, getColor} = this.props

    return [
      new CurveLayer<ICurve>(
        {
          getWidth:
            typeof getWidth === 'function'
              ? // @ts-ignore
                (d: ICurve) => getWidth(d.__source)
              : getWidth,
          getColor:
            typeof getColor === 'function'
              ? // @ts-ignore
                (d: ICurve) => getColor(d.__source)
              : getColor,
        },
        this.getSubLayerProps({
          id: 'path',
        }),
        {
          data: this.state.curves,
          getCurveType: (d: ICurve) => (d instanceof Ellipse ? CURVE.Arc : d instanceof BezierSeg ? CURVE.Bezier : CURVE.Line),
          getControlPoints: (d: ICurve) =>
            d instanceof Ellipse
              ? [d.center, d.aAxis, d.bAxis].flatMap(pointToArray).concat(d.parStart, d.parEnd)
              : d instanceof BezierSeg
              ? d.b.flatMap(pointToArray)
              : [d.start, d.end].flatMap(pointToArray),
          widthUnits: 'pixels',
          // one vertex per 4 pixels
          getResolution: (d: ICurve) => d.length / 4,
        },
      ),

      new IconLayer<Arrow>(
        this.getSubLayerProps({
          id: 'arrow',
        }),
        {
          data: this.state.arrows,
          // @ts-ignore
          iconAtlas,
          iconMapping,
          getPosition: (d) => [d.tip.x, d.tip.y],
          getColor: (d) => getEdgeColor(d.edge),
          getIcon: (d) => d.type,
          getSize: (d) => getArrowSize(d.tip, d.end),
          getAngle: (d) => getArrowAngle(d.tip, d.end),
          sizeUnits: 'common',
        },
      ),
    ]
  }
}

function* getCurves(data: Iterable<GeomEdge>): Generator<ICurve> {
  for (const eg of data) {
    if (eg.curve instanceof Curve) {
      for (const curve of eg.curve.segs) {
        // @ts-ignore
        curve.__source = eg
        yield curve
      }
    } else {
      // @ts-ignore
      eg.curve.__source = eg
      yield eg.curve
    }
  }
}

function pointToArray(p: Point): [number, number] {
  return [p.x, p.y]
}

function getEdgeColor(e: GeomEdge): [number, number, number] {
  const drawinEdge = <DrawingEdge>DrawingObject.getDrawingObj(e.edge)
  if (drawinEdge) {
    const color = drawinEdge.color
    if (color) return [color.R, color.G, color.B]
  }
  return [0, 0, 0]
}

function getArrowSize(tip: Point, end: Point): number {
  const dx = tip.x - end.x
  const dy = tip.y - end.y
  return Math.sqrt(dx * dx + dy * dy)
}

function getArrowAngle(tip: Point, end: Point): number {
  const dx = tip.x - end.x
  const dy = tip.y - end.y
  return (-Math.atan2(dy, dx) / Math.PI) * 180
}
