import {CompositeLayer} from '@deck.gl/core'
import {PathLayer, PathLayerProps, IconLayer} from '@deck.gl/layers'
import {iconAtlas, iconMapping} from './arrows'
import {interpolateICurve, GeomEdge, Point} from 'msagl-js'
import {DrawingEdge, DrawingObject} from 'msagl-js/drawing'

type EdgeLayerProps = PathLayerProps<GeomEdge>

export default class EdgeLayer extends CompositeLayer<GeomEdge, EdgeLayerProps> {
  static defaultProps = {
    ...PathLayer.defaultProps,
  }

  props: EdgeLayerProps

  updateState(params: any) {
    super.updateState(params)

    if (params.changeFlags.dataChanged) {
      const arrows: {edge: GeomEdge; type: string; tip: Point; end: Point}[] = []

      for (const e of params.props.data) {
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
      // @ts-ignore
      this.setState({arrows})
    }
  }

  renderLayers() {
    const props = this.props
    const {updateTriggers = {}} = props

    return [
      new PathLayer<GeomEdge>(
        props,
        // @ts-ignore
        this.getSubLayerProps({
          id: 'path',
          updateTriggers: {
            getPath: updateTriggers.getPath,
            getWidth: updateTriggers.getWidth,
            getColor: updateTriggers.getColor,
          },
        }),
        {
          getPath: (e: GeomEdge) => Array.from(interpolateICurve(e.curve, 0.5)).map((p: Point) => [p.x, p.y]),
          getColor: getEdgeColor,
          widthUnits: 'pixels',
        },
      ),

      new IconLayer<{edge: GeomEdge; type: string; tip: Point; end: Point}>(
        // @ts-ignore
        this.getSubLayerProps({
          id: 'arrow',
          updateTriggers: {
            getPosition: updateTriggers.getPath,
            getColor: updateTriggers.getColor,
          },
        }),
        {
          // @ts-ignore
          data: this.state.arrows,
          // @ts-ignore
          iconAtlas,
          iconMapping,
          getPosition: (d) => [d.tip.x, d.tip.y],
          getColor: (d) => getEdgeColor(d.edge),
          // @ts-ignore
          getIcon: (d) => d.type,
          getSize: (d) => getArrowSize(d.tip, d.end),
          getAngle: (d) => getArrowAngle(d.tip, d.end),
          // @ts-ignore
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
