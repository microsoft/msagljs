import {
  GeomGraph,
  Size,
  layoutGraphWithSugiayma,
  layoutGraphWithMds,
  layoutGeomGraph,
  MdsLayoutSettings,
  SugiyamaLayoutSettings,
} from 'msagl-js'
import {DrawingGraph} from 'msagl-js/drawing'

// TODO - use user-specified font
function measureTextSize(str: string): Size {
  if (!str) return null
  return new Size(str.length * 8 + 8, 20)
}

/** lay out the DrawingGraph dg*/
export function layoutDrawingGraph(dg: DrawingGraph, stringMeasure = measureTextSize): GeomGraph {
  let geomGraph: GeomGraph = <GeomGraph>GeomGraph.getGeom(dg.graph) // grap the GeomGraph from the underlying Graph
  if (
    geomGraph == null || // there is no geometry yet
    geomGraph.layoutSettings == null || // or layout settings are not set
    !geomGraph.layoutSettings.runRoutingOnly // or we are not rerouting only
  ) {
    //  Go over the underlying Graph, dg.graph, and for every element of this Graph create a geometry attribute: GeomGraph for Graph, GeomNode for Node, GeomEdge for Edge, and GeomLabel for Label.
    geomGraph = dg.createGeometry(stringMeasure)
  }

  for (const subgraph of geomGraph.subgraphs()) {
    figureOutLayoutSetting(subgraph)
  }
  figureOutLayoutSetting(geomGraph)
  layoutGeomGraph(geomGraph, null)
  return geomGraph

  function figureOutLayoutSetting(subgraph: GeomGraph) {
    if (subgraph.layoutSettings != null) return

    // directed is true iff the dot starts with keyword 'digraph'
    let directed = false
    for (const e of subgraph.edges()) {
      if (e.sourceArrowhead != null || e.targetArrowhead != null) {
        directed = true
        break
      }
    }
    // figure out if the graph is too large for the layered layout
    const tooLargeForLayered = subgraph.graph.shallowNodeCount > 500 || subgraph.graph.nodeCollection.edgeCount > 500
    if (directed && !tooLargeForLayered) {
      // the graph is not tool large and has directed edges: use layered layout
      const ss = (subgraph.layoutSettings = new SugiyamaLayoutSettings())
      // rankdir sets up the layer direction: can be left-righ, right-left, top-bottom, and bottom-top
      if (dg.rankdir) {
        ss.layerDirection = dg.rankdir
      }
    } else {
      // the graph is more suitable for the pivot mds layout
      subgraph.layoutSettings = new MdsLayoutSettings()
    }
  }
}
