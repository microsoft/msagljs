import {CompositeLayer, LayersList, Accessor, GetPickingInfoParams} from '@deck.gl/core/typed'
import {IconLayer, TextLayer, TextLayerProps} from '@deck.gl/layers/typed'
import {GeomNode, GeomLabel, TileData, Point, Edge, Label, GeomEdge, AttributeRegistry} from 'msagl-js'
import {DrawingEdge, DrawingObject} from 'msagl-js/drawing'
import {iconMapping} from './arrows'

import NodeLayer from './node-layer'
import EdgeLayer from './edge-layer'
import GraphHighlighter from './graph-highlighter'

type NodeLayerProps = TextLayerProps<GeomNode> & {
  highlighter: GraphHighlighter
  resolution: number
  getTextSize: Accessor<GeomNode, number>
}

export default class GraphLayer extends CompositeLayer<NodeLayerProps> {
  static defaultProps = {
    ...TextLayer.defaultProps,
    resolution: {type: 'number', value: 1},
    highlighter: {type: 'object'},
    getTextSize: {type: 'accessor', value: 16},
  }
  static layerName = 'Graphayer'

  renderLayers(): LayersList {
    // @ts-ignore
    const data = this.props.data as TileData
    const {highlighter, resolution, fontFamily, fontWeight, lineHeight, getTextSize} = this.props
    return [
      data.nodes.length > 0 &&
        new NodeLayer(
          this.getSubLayerProps({
            id: 'nodes',
          }),
          {
            data: data.nodes,
            getPickingColor: (n, {target}) => highlighter.encodeNodeIndex(n, target),
            fromIndex: (i) => highlighter.getNode(i),
            nodeDepth: highlighter.nodeDepth,
            getLineWidth: 1,
            fontFamily,
            fontWeight,
            lineHeight,
            getTextSize,
            // @ts-ignore
            clipByInstance: false,
          },
        ),

      data.curveClips.length > 0 &&
        new EdgeLayer(
          this.getSubLayerProps({
            id: 'curves',
          }),
          {
            data: data.curveClips,
            getWidth: 1,
            getDepth: highlighter.edgeDepth,
            resolution,
          },
        ),

      data.arrowheads.length > 0 &&
        new IconLayer<{
          tip: Point
          edge: Edge
          base: Point
        }>(
          this.getSubLayerProps({
            id: 'arrowheads',
          }),
          {
            data: data.arrowheads,
            iconAtlas: 'deck://arrowAtlas',
            iconMapping,
            getPosition: (d) => [d.tip.x, d.tip.y],
            getColor: (d) => getEdgeColor(d.edge),
            getIcon: (d) => getEdgeType(d.edge),
            getSize: (d) => getArrowSize(d.tip, d.base),
            getAngle: (d) => getArrowAngle(d.tip, d.base),
            billboard: false,
            sizeUnits: 'common',
          },
        ),

      data.labels.length > 0 &&
        new TextLayer<GeomLabel>(
          this.getSubLayerProps({
            id: 'labels',
          }),
          {
            data: data.labels,
            getText: getLabelText,
            getPosition: (d: GeomLabel) => [d.center.x, d.center.y],
            fontFamily,
            fontWeight,
            lineHeight,
          },
        ),
    ]
  }
}

function getEdgeColor(e: Edge): [number, number, number] {
  const drawinEdge = <DrawingEdge>DrawingObject.getDrawingObj(e)
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
  const geomEdge = l.parent as GeomEdge
  const edge = geomEdge.entity
  return edge.getAttr(AttributeRegistry.DrawingObjectIndex).labelText
}
