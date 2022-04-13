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
} from 'msagl-js'
import {DrawingGraph} from 'msagl-js/drawing'

import type {RenderOptions} from './renderer'

/** lay out the DrawingGraph dg*/
export function layoutDrawingGraph(dg: DrawingGraph, options: RenderOptions, forceUpdate = false): GeomGraph {
  let needsReroute = false
  let needsLayout = forceUpdate
  const geomGraph: GeomGraph = <GeomGraph>GeomGraph.getGeom(dg.graph) // grab the GeomGraph from the underlying Graph

  function updateLayoutSettings(gg: GeomGraph) {
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

function resolveLayoutSettings(root: DrawingGraph, subgraph: GeomGraph, overrides: RenderOptions): LayoutSettings {
  // directed is true iff the dot starts with keyword 'digraph'
  let directed = false
  for (const e of subgraph.edges()) {
    if (e.sourceArrowhead != null || e.targetArrowhead != null) {
      directed = true
      break
    }
  }

  let ss: LayoutSettings
  switch (overrides.type) {
    case 'Sugiyama':
      ss = new SugiyamaLayoutSettings()
      break

    case 'MDS':
      ss = new MdsLayoutSettings()
      break

    default: {
      // figure out if the graph is too large for the layered layout
      const tooLargeForLayered = subgraph.graph.shallowNodeCount > 1000 || subgraph.graph.nodeCollection.edgeCount > 1000
      if (directed && !tooLargeForLayered) {
        // the graph is not tool large and has directed edges: use layered layout
        ss = new SugiyamaLayoutSettings()
      } else {
        // the graph is more suitable for the pivot mds layout
        ss = new MdsLayoutSettings()
      }
    }
  }

  if (ss instanceof SugiyamaLayoutSettings) {
    if (overrides.layerDirection == null) {
      if (root.rankdir) {
        ss.layerDirection = root.rankdir
      }
    } else {
      ss.layerDirection = overrides.layerDirection
    }
  }

  if (overrides.edgeRoutingMode == null) {
    // Use default
    if (ss instanceof SugiyamaLayoutSettings) {
      ss.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SugiyamaSplines
    } else {
      ss.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
    }
  } else {
    ss.edgeRoutingSettings.EdgeRoutingMode = overrides.edgeRoutingMode
  }

  return ss
}

function diffLayoutSettings(
  oldSettings: LayoutSettings | null,
  newSettings: LayoutSettings,
): {
  layoutChanged: boolean
  routingChanged: boolean
} {
  if (!oldSettings) return {layoutChanged: true, routingChanged: true}

  return {
    layoutChanged: oldSettings.constructor !== newSettings.constructor,
    routingChanged: oldSettings.edgeRoutingSettings.EdgeRoutingMode !== newSettings.edgeRoutingSettings.EdgeRoutingMode,
  }
}
