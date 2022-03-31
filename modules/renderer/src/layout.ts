import {MdsLayoutSettings} from 'msagl-js'
import {GeomGraph, Size, layoutGraphWithSugiayma, layoutGraphWithMds, SugiyamaLayoutSettings, EdgeRoutingMode} from 'msagl-js'
import {DrawingGraph} from 'msagl-js/drawing'

// TODO - use user-specified font
function measureTextSize(str: string): Size {
  if (!str) return null
  return new Size(str.length * 8 + 8, 20)
}

export type GraphLayoutOptions = {
  rectilinearEdges?: boolean
}
/** lay out the DrawingGraph dg.
 * TODO: replace GraphLayoutOptions by LayoutSettings from core
 */
export function layoutDrawingGraph(dg: DrawingGraph, options: GraphLayoutOptions = {}, stringMeasure = measureTextSize): GeomGraph {
  //  Go over the underlying Graph, dg.graph, and for every element of this Graph create a geometry attribute: GeomGraph for Graph, GeomNode for Node, GeomEdge for Edge, and GeomLabel for Label.
  dg.createGeometry(stringMeasure)

  const {rectilinearEdges = false} = options
  // Fetch the geometry attribute from Graph, GeomGraph in this case
  const geomGraph = <GeomGraph>GeomGraph.getGeom(dg.graph)
  // directed is true iff the dot starts with keyword 'digraph'
  const directed = dg.hasDirectedEdge()
  // figure out if the graph is too large for the layered layout
  const tooLargeForLayered = geomGraph.graph.nodeCollection.nodeDeepCount > 2000 || geomGraph.graph.nodeCollection.edgeCount > 2000

  if (geomGraph.layoutSettings instanceof SugiyamaLayoutSettings || (directed && !tooLargeForLayered)) {
    let ss: SugiyamaLayoutSettings // this type of settings is used for layered layout
    // create SugiyamaLayout settings, but only in the case they were not created before
    // and stored under GeomGraph
    if (geomGraph.layoutSettings instanceof SugiyamaLayoutSettings) {
      ss = <SugiyamaLayoutSettings>geomGraph.layoutSettings
    } else {
      ss = geomGraph.layoutSettings = new SugiyamaLayoutSettings()
    }
    // adjust the edge routing mode for rectilinearRouting if required
    if (rectilinearEdges) {
      ss.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Rectilinear
    }
    // rankdir sets up the layer direction: can be left-righ, right-left, top-bottom, and bottom-top
    if (dg.rankdir) {
      ss.layerDirection = dg.rankdir
    }
    // calculate the layout
    layoutGraphWithSugiayma(geomGraph, null)
  } else {
    if (rectilinearEdges) {
      // create settings to control MDS layout for the case they are not set and stored under GeomGraph beforehand
      let mdsS: MdsLayoutSettings = <MdsLayoutSettings>geomGraph.layoutSettings
      if (!(mdsS instanceof MdsLayoutSettings)) {
        geomGraph.layoutSettings = mdsS = new MdsLayoutSettings()
      }
      mdsS.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Rectilinear
    }
    // calculate the layout
    layoutGraphWithMds(geomGraph, null)
  }

  return geomGraph
}
