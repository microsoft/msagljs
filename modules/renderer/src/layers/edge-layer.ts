import {CompositeLayer, UpdateParameters, Position, LayersList} from '@deck.gl/core/typed'
import {Buffer} from '@luma.gl/webgl'
import {PathLayer, PathLayerProps, IconLayer} from '@deck.gl/layers/typed'
import {iconAtlas, iconMapping} from './arrows'
import {interpolateICurve, GeomEdge, Point} from 'msagl-js'
import {DrawingEdge, DrawingObject} from 'msagl-js/drawing'

type EdgeLayerProps = PathLayerProps<GeomEdge> & {
  getDepth?: Buffer
}

type Arrow = {
  edge: GeomEdge
  type: string
  tip: Point
  end: Point
}

export default class EdgeLayer extends CompositeLayer<EdgeLayerProps> {
  static defaultProps = {
    ...PathLayer.defaultProps,
  }

  state!: {
    arrows: Arrow[]
  }

  updateState(params: UpdateParameters<this>) {
    super.updateState(params)

    if (params.changeFlags.dataChanged) {
      const arrows: Arrow[] = []

      for (const e of params.props.data as GeomEdge[]) {
        const eg = e
        if (eg.sourceArrowhead) {
          arrows.push({
            edge: e,
            type: 'triangle-n',
            tip: eg.sourceArrowhead.tipPosition,
            end: eg.curve.start,
          })
        }
        if (eg.targetArrowhead) {
          arrows.push({
            edge: e,
            type: 'triangle-n',
            tip: eg.targetArrowhead.tipPosition,
            end: eg.curve.end,
          })
        }
      }
      this.setState({arrows})
    }
  }

  renderLayers(): LayersList {
    const props = this.props

    return [
      new PathLayer<GeomEdge>(
        props,
        this.getSubLayerProps({
          id: 'path',
        }),
        {
          getPath: (e: GeomEdge) =>
            Array.from(interpolateICurve(e.curve, 0.01 /* this is a sensitive parameter: diminishing it creates more segments */)).map(
              (p: Point) => [p.x, p.y] as Position,
            ),
          getColor: getEdgeColor,
          widthUnits: 'pixels',
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
