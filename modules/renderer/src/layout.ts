import {
  GeomGraph,
  Size,
  layoutGeomGraph,
  MdsLayoutSettings,
  SugiyamaLayoutSettings,
  Graph,
  LayoutSettings,
  EdgeRoutingMode,
  routeEdges,
  LayerDirectionEnum,
} from 'msagl-js'
import {DrawingGraph} from 'msagl-js/drawing'

import type {LayoutOptions} from './renderer'

/** lay out the DrawingGraph dg*/
export function layoutDrawingGraph(dg: DrawingGraph, options: LayoutOptions, forceUpdate = false): GeomGraph {
  let needsReroute = false
  let needsLayout = forceUpdate
  const geomGraph: GeomGraph = <GeomGraph>GeomGraph.getGeom(dg.graph) // grab the GeomGraph from the underlying Graph

  function updateLayoutSettings(gg: GeomGraph) {
    if (!gg) return
    for (const subgraph of gg.subgraphs()) {
      updateLayoutSettings(subgraph)
    }

    const settings = resolveLayoutSettings(dg, gg, options)
    const diff = diffLayoutSettings(gg.layoutSettings, settings)
    needsLayout = needsLayout || diff.layoutChanged
    needsReroute = needsReroute || diff.routingChanged
    gg.layoutSettings = settings
  }

  updateLayoutSettings(geomGraph)

  // Clear cached curves
  if (needsLayout || needsReroute) {
    for (const e of geomGraph.deepEdges()) {
      e.curve = null
    }
  }

  if (needsLayout) {
    layoutGeomGraph(geomGraph, null)
  } else if (needsReroute) {
    routeEdges(geomGraph, Array.from(geomGraph.deepEdges()), null)
  }
  return geomGraph
}

function resolveLayoutSettings(root: DrawingGraph, subgraph: GeomGraph, overrides: LayoutOptions): LayoutSettings {
  // directed is true iff the dot starts with keyword 'digraph'
  let directed = false
  for (const e of subgraph.edges()) {
    if (e.sourceArrowhead != null || e.targetArrowhead != null) {
      directed = true
      break
    }
  }

  let layoutSettings: LayoutSettings
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

    default: {
      // figure out if the graph is too large for the layered layout
      const tooLargeForLayered = subgraph.graph.shallowNodeCount > 2000 || subgraph.graph.nodeCollection.edgeCount > 4000
      if (directed && !tooLargeForLayered) {
        // the graph is not too large and has directed edges: use layered layout
        layoutSettings = new SugiyamaLayoutSettings()
      } else {
        // the graph is more suitable for the pivot mds layout
        layoutSettings = new MdsLayoutSettings()
      }
    }
  }

  if (overrides.edgeRoutingMode == null) {
    // Use default
    if (layoutSettings instanceof SugiyamaLayoutSettings) {
      layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SugiyamaSplines
    } else {
      layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
    }
  } else {
    layoutSettings.edgeRoutingSettings.EdgeRoutingMode = overrides.edgeRoutingMode
  }

  return layoutSettings
}

function diffLayoutSettings(
  oldSettings: LayoutSettings | null,
  newSettings: LayoutSettings,
): {
  layoutChanged: boolean
  routingChanged: boolean
} {
  if (!oldSettings) return {layoutChanged: true, routingChanged: true}

  const routingChanged = oldSettings.edgeRoutingSettings.EdgeRoutingMode !== newSettings.edgeRoutingSettings.EdgeRoutingMode
  const specialCaseSugiamaRelayout = routingChanged && newSettings.edgeRoutingSettings.EdgeRoutingMode === EdgeRoutingMode.SugiyamaSplines

  const layerDirectionChange =
    oldSettings instanceof SugiyamaLayoutSettings &&
    newSettings instanceof SugiyamaLayoutSettings &&
    (<SugiyamaLayoutSettings>oldSettings).layerDirection != (<SugiyamaLayoutSettings>newSettings).layerDirection
  return {
    layoutChanged: oldSettings.constructor !== newSettings.constructor || specialCaseSugiamaRelayout || layerDirectionChange,
    routingChanged,
  }
}
