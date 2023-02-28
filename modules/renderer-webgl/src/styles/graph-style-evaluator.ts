import {Entity, Node, Edge, TileMap } from 'msagl-js'
import {DrawingObject, DrawingNode, DrawingEdge, ShapeEnum} from 'msagl-js/drawing'
import {GraphStyleSpecification, EntityFilter, InterpolatorContext, Interpolation, GraphNodeLayerStyle, GraphEdgeLayerStyle} from './graph-style-spec'
import {scaleLinear} from 'd3-scale'

export type ParsedGraphStyle = {
  layers: (ParsedGraphNodeLayerStyle | ParsedGraphEdgeLayerStyle)[]
}

type ParsedGraphLayerStyle = {
  id: string
  type: string
  filter: ((e: Entity, context: FilterContext) => boolean) | null
  visible: boolean
  minZoom: number
  maxZoom: number
  _dynamic: boolean
}

type FilterContext = {
  tileMap?: TileMap
}

export type ValueOrInterpolator<OutputT> = ((context: InterpolatorContext) => OutputT) | OutputT | null;

export type ParsedGraphNodeLayerStyle = ParsedGraphLayerStyle & {
  type: 'node'
  size: ValueOrInterpolator<number>
  fillColor: ValueOrInterpolator<string>
  strokeWidth: ValueOrInterpolator<number>
  strokeColor: ValueOrInterpolator<string>
  labelSize: ValueOrInterpolator<number>
  labelColor: ValueOrInterpolator<string>
}
/** Internal only */
export type ParsedGraphEdgeLayerStyle = ParsedGraphLayerStyle & {
  type: 'edge'
  strokeWidth: ValueOrInterpolator<number>
  strokeColor: ValueOrInterpolator<string>
  arrowSize: ValueOrInterpolator<number>
  arrowColor: ValueOrInterpolator<string>
  labelSize: ValueOrInterpolator<number>
  labelColor: ValueOrInterpolator<string>
}

export function parseGraphStyle(style: GraphStyleSpecification): ParsedGraphStyle {
  const parsedLayers = style.layers.map(parseLayerStyle)
  const ids = new Set<string>()
  for (const layer of parsedLayers) {
    if (ids.has(layer.id)) {
      throw new Error(`Duplicate layer id: ${layer.id}`)
    }
    ids.add(layer.id)
  }

  return {
    layers: parsedLayers
  }
}

function parseLayerStyle(layer: GraphNodeLayerStyle, layerIndex: number): ParsedGraphNodeLayerStyle;
function parseLayerStyle(layer: GraphEdgeLayerStyle, layerIndex: number): ParsedGraphEdgeLayerStyle;

function parseLayerStyle(layer: GraphNodeLayerStyle | GraphEdgeLayerStyle, layerIndex: number) {
  const {
    type,
    id = `layer-${layerIndex}`,
    filter,
    visible = true,
    minZoom = -Infinity,
    maxZoom = Infinity,
  } = layer;

  let interpolators

  if (type === 'node') {
    interpolators = {
      size: parseInterpolation(layer.size),
      fillColor: parseInterpolation(layer.fillColor),
      strokeWidth: parseInterpolation(layer.strokeWidth),
      strokeColor: parseInterpolation(layer.strokeColor),
      labelSize: parseInterpolation(layer.labelSize),
      labelColor: parseInterpolation(layer.labelColor),
    }
  } else if (layer.type === 'edge') {
    interpolators = {
      strokeWidth: parseInterpolation(layer.strokeWidth),
      strokeColor: parseInterpolation(layer.strokeColor),
      arrowSize: parseInterpolation(layer.arrowSize),
      arrowColor: parseInterpolation(layer.arrowColor),
      labelSize: parseInterpolation(layer.labelSize),
      labelColor: parseInterpolation(layer.labelColor),
    }
  } else {
    throw new Error(`Unknown layer type: ${type}`)
  }

  return {
    type,
    id,
    filter: parseFilter(filter),
    visible,
    minZoom,
    maxZoom,
    ...interpolators,
    _dynamic: Object.values(interpolators).some(v => typeof v === 'function')
  }
}

function parseInterpolation<OutputT extends number | string>(valueOrInterpolation: OutputT | Interpolation<OutputT> | undefined): ValueOrInterpolator<OutputT> {
  if (!valueOrInterpolation) {
    return null
  }
  // @ts-ignore
  if (valueOrInterpolation.interpolation) {
    const {interpolation, input, inputStops, outputStops} = valueOrInterpolation as Interpolation<OutputT>

    switch (interpolation) {
      case 'linear': {
        const scale = scaleLinear(inputStops, outputStops)
        scale.clamp(true)
        return (context: InterpolatorContext) => {
          const inputValue = context[input] as number
          return scale(inputValue)
        };
      }

      case 'step': {
        return (context: InterpolatorContext) => {
          const inputValue = context[input] as number
          const i = inputStops.findIndex(x => x > inputValue)
          if (i < 0) {
            return outputStops[outputStops.length - 1]
          }
          return outputStops[i]
        };
      }

      default:
        throw new Error(`Unknown interpolation ${interpolation}`)
    }
  }
  return valueOrInterpolation as OutputT
}

function parseFilter(filter: EntityFilter | undefined): ((e: Entity, context: FilterContext) => boolean) | null {
  if (!filter) {
    return null
  }

  let getProperty: (e: Entity, context: FilterContext) => string | number

  switch (filter.property) {
    case 'id':
      getProperty = (e: Entity) => (e as Node).id
      break
    case 'source-id':
      getProperty = (e: Entity) => (e as Edge).source.id
      break
    case 'target-id':
      getProperty = (e: Entity) => (e as Edge).target.id
      break
    case 'shape':
      getProperty = (e: Entity) => ShapeEnum[getDrawingObj<DrawingNode>(e).shape]
      break
    case 'label':
      getProperty = (e: Entity) => getDrawingObj<DrawingNode | DrawingEdge>(e).labelText
      break
    case 'rank':
      getProperty = (e: Entity, context: FilterContext) => context.tileMap?.entityRank.get(e)
      break
    default:
      throw new Error(`Unknown filter property ${filter.property}`)
  }

  switch (filter.operator) {
    case '=':
      return (e: Entity, context: FilterContext) => getProperty(e, context) === filter.value
    case '<':
      return (e: Entity, context: FilterContext) => getProperty(e, context) < filter.value
    case '>':
      return (e: Entity, context: FilterContext) => getProperty(e, context) > filter.value
    case '<=':
      return (e: Entity, context: FilterContext) => getProperty(e, context) <= filter.value
    case '>=':
      return (e: Entity, context: FilterContext) => getProperty(e, context) >= filter.value
    case '!=':
      return (e: Entity, context: FilterContext) => getProperty(e, context) != filter.value
    case '*=':
      return (e: Entity, context: FilterContext) => String(getProperty(e, context)).includes(String(filter.value))
    case '^=':
      return (e: Entity, context: FilterContext) => String(getProperty(e, context)).startsWith(String(filter.value))
    case '$=':
      return (e: Entity, context: FilterContext) => String(getProperty(e, context)).endsWith(String(filter.value))
    default:
      throw new Error(`Unknown filter operator ${filter.operator}`)
  }
}

function getDrawingObj<T extends DrawingObject>(e: Entity): T {
  return DrawingObject.getDrawingObj(e) as T;
}
