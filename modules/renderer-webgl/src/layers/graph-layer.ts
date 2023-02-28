import {CompositeLayer, LayersList, Accessor, GetPickingInfoParams, UpdateParameters} from '@deck.gl/core/typed'
import { TextLayer, TextLayerProps} from '@deck.gl/layers/typed'
import {GeomNode, TileData, TileMap} from 'msagl-js'

import {getNodeLayers} from './get-node-layers'
import {getEdgeLayer, getArrowHeadLayer, getEdgeLabelLayer} from './get-edge-layers'
import GraphHighlighter from './graph-highlighter'
import {ParsedGraphStyle, ParsedGraphNodeLayerStyle, ParsedGraphEdgeLayerStyle, ValueOrInterpolator} from '../styles/graph-style-evaluator'

import {rgb} from 'd3-color'

type GraphLayerProps = TextLayerProps<GeomNode> & {
  highlighter: GraphHighlighter
  resolution: number
  graphStyle: ParsedGraphStyle
  tileMap?: TileMap
}

export default class GraphLayer extends CompositeLayer<GraphLayerProps> {
  static defaultProps = {
    ...TextLayer.defaultProps,
    resolution: {type: 'number', value: 1},
    highlighter: {type: 'object'},
    fontSize: {type: 'number', value: 16},
  }
  static layerName = 'Graphayer'

  state!: {
    layerMap: Record<string, {data: TileData, subLayers: LayersList | null}>
  }

  override updateState({props, oldProps, changeFlags}: UpdateParameters<this>) {
    const {graphStyle} = props;
    if (changeFlags.dataChanged || graphStyle !== oldProps.graphStyle) {
      // @ts-ignore
      const data = props.data as TileData
      const filterContext = {
        tileMap: props.tileMap
      }
      const layerMap: Record<string, {data: TileData, subLayers: LayersList | null}> = {}
      for (const layer of graphStyle.layers) {
        const layerData = new TileData()
        layerMap[layer.id] = {data: layerData, subLayers: null}

        if (layer.type === 'node') {
          layerData.nodes = layer.filter ? data.nodes.filter(n => layer.filter(n.node, filterContext)) : data.nodes
        }
        if (layer.type === 'edge') {
          layerData.curveClips = layer.filter ? data.curveClips.filter(c => layer.filter(c.edge, filterContext)) : data.curveClips
          layerData.arrowheads = layer.filter ? data.arrowheads.filter(a => layer.filter(a.edge, filterContext)) : data.arrowheads
          layerData.labels = layer.filter ? data.labels.filter(l => layer.filter(l.parent.entity, filterContext)) : data.labels
        }
      }
      this.setState({layerMap})
    }
  }

  getPickingInfo({sourceLayer, info}: GetPickingInfoParams) {
    if (sourceLayer.id.endsWith('node-boundary') && info.picked) {
      info.object = this.props.highlighter.getNode(info.index)
    }
    return info
  }

  override renderLayers(): LayersList {
    const {layerMap} = this.state
    const {graphStyle, highlighter, resolution, fontFamily, fontWeight, lineHeight} = this.props

    const interpolatorContext = {
      zoom: this.context.viewport.zoom
    }
    const evaluateNumber = (interpolator: ValueOrInterpolator<number>) => {
      if (typeof interpolator === 'function') {
        return interpolator(interpolatorContext)
      }
      return interpolator
    }
    const evaluateColor = (interpolator: ValueOrInterpolator<string>) => {
      if (typeof interpolator === 'function') {
        const color = rgb(interpolator(interpolatorContext))
        return [color.r, color.g, color.b]
      } else if (interpolator) {
        const color = rgb(interpolator)
        return [color.r, color.g, color.b]
      }
      return null
    }

    return graphStyle.layers.map((layer) => {
      const {data, subLayers} = layerMap[layer.id]

      if (layer.minZoom > interpolatorContext.zoom || layer.maxZoom < interpolatorContext.zoom) {
        return null
      }

      if (subLayers && !layer._dynamic) {
        return subLayers
      }

      const newSubLayers = []
      const subLayerProps = this.getSubLayerProps({id: layer.id})

      if (data.nodes?.length > 0) {
        const propsFromLayerStyle: any = {}
        const nodeLayerStyle = layer as ParsedGraphNodeLayerStyle

        if (nodeLayerStyle.size !== null) propsFromLayerStyle.sizeScale = evaluateNumber(nodeLayerStyle.size)
        if (nodeLayerStyle.fillColor !== null) propsFromLayerStyle.getFillColor = evaluateColor(nodeLayerStyle.fillColor)
        if (nodeLayerStyle.strokeColor !== null) propsFromLayerStyle.getLineColor = evaluateColor(nodeLayerStyle.strokeColor)
        if (nodeLayerStyle.strokeWidth !== null) propsFromLayerStyle.getLineWidth = evaluateNumber(nodeLayerStyle.strokeWidth)
        if (nodeLayerStyle.labelColor !== null) propsFromLayerStyle.textColor = evaluateColor(nodeLayerStyle.labelColor)
        if (nodeLayerStyle.labelSize !== null) propsFromLayerStyle.textSizeScale = evaluateNumber(nodeLayerStyle.labelSize)

        newSubLayers.push(getNodeLayers({
          ...subLayerProps,
          ...propsFromLayerStyle,
          data: data.nodes,
          getPickingColor: (n, {target}) => highlighter.encodeNodeIndex(n, target),
          nodeDepth: highlighter.nodeDepth,

          // From renderer layout options
          fontFamily,
          fontWeight,
          lineHeight,

          // @ts-ignore
          clipByInstance: false,
        }))
      }

      if (data.curveClips?.length > 0) {
        const propsFromLayerStyle: any = {}
        const edgeLayerStyle = layer as ParsedGraphEdgeLayerStyle

        if (edgeLayerStyle.strokeWidth !== null) propsFromLayerStyle.getWidth = evaluateNumber(edgeLayerStyle.strokeWidth)
        if (edgeLayerStyle.strokeColor !== null) propsFromLayerStyle.getColor = evaluateColor(edgeLayerStyle.strokeColor)

        newSubLayers.push(getEdgeLayer({
          ...subLayerProps,
          ...propsFromLayerStyle,
          data: data.curveClips,
          getDepth: highlighter.edgeDepth,
          resolution,
        }, data))
      }
      
      if (data.arrowheads?.length > 0) {
        const propsFromLayerStyle: any = {}
        const edgeLayerStyle = layer as ParsedGraphEdgeLayerStyle

        if (edgeLayerStyle.arrowSize !== null) propsFromLayerStyle.sizeScale = evaluateNumber(edgeLayerStyle.arrowSize)
        if (edgeLayerStyle.arrowColor !== null) propsFromLayerStyle.getColor = evaluateColor(edgeLayerStyle.arrowColor)

        newSubLayers.push(getArrowHeadLayer({
          ...subLayerProps,
          ...propsFromLayerStyle,
          data: data.arrowheads,
        }))
      }
      
      if (data.labels?.length > 0) {
        const propsFromLayerStyle: any = {}
        const edgeLayerStyle = layer as ParsedGraphEdgeLayerStyle

        if (edgeLayerStyle.labelSize !== null) propsFromLayerStyle.sizeScale = evaluateNumber(edgeLayerStyle.labelSize)
        if (edgeLayerStyle.labelColor !== null) propsFromLayerStyle.getColor = evaluateColor(edgeLayerStyle.labelColor)

        newSubLayers.push(getEdgeLabelLayer({
          ...subLayerProps,
          ...propsFromLayerStyle,
          data: data.labels,
          fontFamily,
          fontWeight,
          lineHeight,
        }))
      }

      layerMap[layer.id].subLayers = newSubLayers
      return newSubLayers
    })
  }
}
