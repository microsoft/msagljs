import {
  GeomGraph,
  layoutGeomGraph,
  MdsLayoutSettings,
  SugiyamaLayoutSettings,
  Graph,
  EdgeRoutingMode,
  routeEdges,
  LayerDirectionEnum,
  FastIncrementalLayoutSettings,
  ILayoutSettings,
} from '@msagl/core'

import {parseJSON, graphToJSON} from '@msagl/parser'
import {LayoutOptions} from '.'
import {DrawingGraph} from '@msagl/drawing'

let layoutWorker: Worker = null
let layoutInProgress = false

export async function layoutGraphOnWorker(workerUrl: string, graph: Graph, options: LayoutOptions, forceUpdate = false): Promise<Graph> {
  if (layoutInProgress && layoutWorker) {
    // Supersede the in-flight request. Clear handlers first so terminate()
    // does not fire our onerror and reject the (now abandoned) promise — that
    // would surface as "Uncaught (in promise)" in the example code which does
    // not catch rejections from setOptions/setGraph.
    layoutWorker.onmessage = null
    layoutWorker.onerror = null
    layoutWorker.terminate()
    layoutWorker = null
    layoutInProgress = false
  }
  if (!layoutWorker) {
    // Resolve relative URL
    workerUrl = new URL(workerUrl, location.href).href
    // Worker cannot be constructed directly cross-origin
    const content = `importScripts( "${workerUrl}" )`
    const blobUrl = URL.createObjectURL(new Blob([content], {type: 'text/javascript'}))
    layoutWorker = new Worker(blobUrl)
  }

  return new Promise((resolve, reject) => {
    layoutWorker.onmessage = ({data}) => {
      if (data.type === 'error') {
        layoutInProgress = false
        reject(data.message)
      } else if (data.type === 'layout-done') {
        layoutInProgress = false
        try {
          graph = parseJSON(data.graph)
          console.debug('graph transfer to main thread', Date.now() - data.timestamp + ' ms')

          // graphToJSON/parseJSON does not preserve geomGraph.layoutSettings.
          // Re-apply them here so downstream consumers (e.g. TileMap's
          // getEdgeRoutingSettingsFromAncestorsOrDefault) observe the same
          // EdgeRoutingMode (Corridor, etc.) as the main-thread-only path.
          applyLayoutSettings(graph, options)

          resolve(graph)
        } catch (err) {
          reject(err.message)
        }
      }
    }
    layoutWorker.onerror = (e) => {
      layoutInProgress = false
      reject(e.message || 'layout worker error')
    }

    layoutWorker.postMessage({
      type: 'layout',
      timestamp: Date.now(),
      graph: graphToJSON(graph),
      options,
      forceUpdate,
    })
    layoutInProgress = true
  })
}

/** Walk the GeomGraph tree and set layoutSettings without triggering layout.
 * Returns aggregated diff flags vs. the previous settings (useful for layoutGraph).
 */
export function applyLayoutSettings(
  graph: Graph,
  options: LayoutOptions,
): {layoutChanged: boolean; routingChanged: boolean} {
  const drawingGraph: DrawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  const geomGraph: GeomGraph = GeomGraph.getGeom(graph)
  let layoutChanged = false
  let routingChanged = false

  function recurse(gg: GeomGraph) {
    if (!gg) return
    for (const subgraph of gg.subgraphs()) {
      recurse(subgraph)
    }
    const settings = resolveLayoutSettings(drawingGraph, gg, options)
    const diff = diffLayoutSettings(gg.layoutSettings, settings)
    layoutChanged = layoutChanged || diff.layoutChanged
    routingChanged = routingChanged || diff.routingChanged
    gg.layoutSettings = settings
  }

  recurse(geomGraph)
  return {layoutChanged, routingChanged}
}

/** lay out the given graph */
export function layoutGraph(graph: Graph, options: LayoutOptions, forceUpdate = false): Graph {
  const t0 = performance.now()
  const geomGraph: GeomGraph = GeomGraph.getGeom(graph) // grab the GeomGraph from the underlying Graph

  const diff = applyLayoutSettings(graph, options)
  const needsLayout = forceUpdate || diff.layoutChanged
  const needsReroute = diff.routingChanged

  // Clear cached curves
  if (needsLayout || needsReroute) {
    for (const e of geomGraph.deepEdges) {
      e.requireRouting()
    }
  }

  if (needsLayout) {
    layoutGeomGraph(geomGraph, null)
  } else if (needsReroute) {
    // console.time('routeEdges')
    routeEdges(geomGraph, Array.from(geomGraph.deepEdges), null)
    // console.timeEnd('routeEdges')
  }
  console.log(`layout: ${(performance.now() - t0).toFixed(1)}ms`)
  return graph
}

function resolveLayoutSettings(root: DrawingGraph, subgraph: GeomGraph, overrides: LayoutOptions): ILayoutSettings {
  // directed is true iff the dot starts with keyword 'digraph'
  let directed = false
  for (const e of subgraph.deepEdges) {
    if (e.sourceArrowhead != null || e.targetArrowhead != null) {
      directed = true
      break
    }
  }

  let layoutSettings: any
  switch (overrides.layoutType) {
    case 'Sugiyama LR': {
      const ss: SugiyamaLayoutSettings = <SugiyamaLayoutSettings>(layoutSettings = new SugiyamaLayoutSettings())
      ss.layerDirection = LayerDirectionEnum.LR
      break
    }

    case 'Sugiyama RL': {
      const ss: SugiyamaLayoutSettings = <SugiyamaLayoutSettings>(layoutSettings = new SugiyamaLayoutSettings())
      ss.layerDirection = LayerDirectionEnum.RL
      break
    }

    case 'Sugiyama TB': {
      const ss: SugiyamaLayoutSettings = <SugiyamaLayoutSettings>(layoutSettings = new SugiyamaLayoutSettings())
      ss.layerDirection = LayerDirectionEnum.TB
      break
    }
    case 'Sugiyama BT': {
      const ss: SugiyamaLayoutSettings = <SugiyamaLayoutSettings>(layoutSettings = new SugiyamaLayoutSettings())
      ss.layerDirection = LayerDirectionEnum.BT
      break
    }

    case 'MDS':
      layoutSettings = new MdsLayoutSettings()
      break
    case 'IPsepCola':
      layoutSettings = new FastIncrementalLayoutSettings()
      break
    default: {
      // figure out if the graph is too large for the layered layout
      const tooLargeForLayered = subgraph.graph.shallowNodeCount > 2001 || subgraph.graph.deepEdgesCount > 4000
      if (directed && !tooLargeForLayered) {
        // the graph is not too large and has directed edges: use layered layout
        const ss = (layoutSettings = new SugiyamaLayoutSettings())
        if (root) {
          if (root.rankdir) {
            ss.layerDirection = root.rankdir
          }
        }
      } else {
        // the graph is more suitable for the pivot mds layout
        layoutSettings = new FastIncrementalLayoutSettings()
      }
    }
  }

  if (overrides.edgeRoutingMode == null) {
    // Use default
    if (layoutSettings instanceof SugiyamaLayoutSettings) {
      layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SugiyamaSplines
    } else {
      layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Corridor
    }
  } else {
    layoutSettings.edgeRoutingSettings.EdgeRoutingMode = overrides.edgeRoutingMode
  }

  if (overrides.smoothCorners != null) {
    layoutSettings.edgeRoutingSettings.smoothCorners = overrides.smoothCorners
  }

  return layoutSettings
}

function diffLayoutSettings(
  oldSettings: ILayoutSettings | null,
  newSettings: ILayoutSettings,
): {
  layoutChanged: boolean
  routingChanged: boolean
} {
  if (!oldSettings) return {layoutChanged: true, routingChanged: true}

  const routingChanged =
    oldSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode !== newSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode ||
    oldSettings.commonSettings.edgeRoutingSettings.smoothCorners !== newSettings.commonSettings.edgeRoutingSettings.smoothCorners
  const specialCaseSugiamaRelayout =
    routingChanged && newSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode === EdgeRoutingMode.SugiyamaSplines

  const layerDirectionChange =
    oldSettings instanceof SugiyamaLayoutSettings &&
    newSettings instanceof SugiyamaLayoutSettings &&
    (<SugiyamaLayoutSettings>oldSettings).layerDirection != (<SugiyamaLayoutSettings>newSettings).layerDirection
  return {
    layoutChanged: oldSettings.constructor !== newSettings.constructor || specialCaseSugiamaRelayout || layerDirectionChange,
    routingChanged,
  }
}
