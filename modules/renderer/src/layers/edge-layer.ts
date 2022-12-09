import {CompositeLayer, Unit, Accessor, Color, UpdateParameters, Position, LayersList, LayerProps, DefaultProps} from '@deck.gl/core/typed'
import {Buffer} from '@luma.gl/webgl'
import {TextLayerProps} from '@deck.gl/layers/typed'
import {ICurve, GeomLabel, Point, LineSegment, clipWithRectangle, BezierSeg, Ellipse, Curve, TileData, CurveClip, Rectangle} from 'msagl-js'
import {DrawingEdge, DrawingObject} from 'msagl-js/drawing'

import CurveLayer from './curve-layer'
import {CURVE} from './curve-layer'

type EdgeLayerProps = TextLayerProps<CurveClip> & {
  getDepth?: Buffer

  resolution?: number

  widthUnits?: Unit
  widthScale?: number
  widthMinPixels?: number
  widthMaxPixels?: number

  getWidth?: Accessor<CurveClip, number>
  getColor?: Accessor<CurveClip, Color>
} & LayerProps<CurveClip>

const defaultProps: DefaultProps<EdgeLayerProps> = {
  resolution: {type: 'number', value: 1},

  widthUnits: 'common',
  widthScale: {type: 'number', min: 0, value: 1},
  widthMinPixels: {type: 'number', min: 0, value: 0},
  widthMaxPixels: {type: 'number', min: 0, value: Number.MAX_SAFE_INTEGER},

  getWidth: {type: 'accessor', value: 1},
  getColor: {type: 'accessor', value: [0, 0, 0, 255]},
}

export default class EdgeLayer extends CompositeLayer<EdgeLayerProps> {
  static defaultProps = defaultProps
  static layerName = 'EdgeLayer'

  state!: {
    curves: ICurve[]
  }

  updateState(params: UpdateParameters<this>) {
    super.updateState(params)

    if (params.changeFlags.dataChanged) {
      const curves: ICurve[] = Array.from(
        getCurves(this.props.data as Iterable<CurveClip>, (segment: ICurve, datum: CurveClip, index: number) =>
          this.getSubLayerRow(segment, datum, index),
        ),
      )
      this.setState({curves})
    }
  }

  renderLayers(): LayersList {
    const {getWidth, getColor, resolution} = this.props

    return [
      new CurveLayer<ICurve>(
        {
          // @ts-ignore
          getWidth: this.getSubLayerAccessor(getWidth),
          // @ts-ignore
          getColor: this.getSubLayerAccessor(getColor),
        },
        this.getSubLayerProps({
          id: 'path',
        }),
        {
          data: this.state.curves,
          getCurveType,
          getControlPoints,
          getRange: (d: ICurve) => {
            // @ts-ignore
            return d.__range
          },
          widthUnits: 'pixels',
          // one vertex per 4 pixels
          getResolution: (d: ICurve) => {
            // @ts-ignore
            const [t0, t1] = d.__range
            const r = (t1 - t0) / (d.parEnd - d.parStart)
            return d.length * r * resolution
          },
          // @ts-ignore
          clipByInstance: false,
        },
      ),
    ]
  }
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
    const {curve, startPar, endPar} = cc
    if (curve instanceof Curve) {
      const t0 = curve.getSegIndexParam(startPar)
      const t1 = curve.getSegIndexParam(endPar)

      for (let i = t0.segIndex; i <= t1.segIndex; i++) {
        const seg = curve.segs[i]
        const range = [seg.parStart, seg.parEnd]
        if (t0.segIndex === i) {
          range[0] = t0.par
        }
        if (t1.segIndex === i) {
          range[1] = t1.par
        }
        // @ts-ignore
        seg.__range = range
        transform(seg, cc, j)
        yield seg
      }
    } else {
      // @ts-ignore
      curve.__range = [cc.startPar, cc.endPar]
      transform(curve, cc, j)
      yield curve
    }
    j++
  }
}

function pointToArray(p: Point): [number, number] {
  return [p.x, p.y]
}
