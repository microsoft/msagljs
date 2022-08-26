import {RectilinearEdgeRouter} from '../routing/rectilinear/RectilinearEdgeRouter'
import {GeomGraph, optimalPackingRunner} from './core/geomGraph'
import {CancelToken} from '../utils/cancelToken'
import {Edge} from '../structs/edge'
import {Graph, shallowConnectedComponents} from '../structs/graph'
import {GeomEdge} from './core/geomEdge'
import {SugiyamaLayoutSettings} from './layered/sugiyamaLayoutSettings'
import {CommonLayoutSettings} from './layered/commonLayoutSettings'
import {GeomNode, LayeredLayout, MdsLayoutSettings} from '..'
import {PivotMDS} from './mds/pivotMDS'
import {EdgeRoutingMode} from '../routing/EdgeRoutingMode'
import {straightLineEdgePatcher} from '../routing/StraightLineEdges'
import {routeSplines, SplineRouter} from '../routing/splineRouter'
import {EdgeRoutingSettings} from '../routing/EdgeRoutingSettings'
import {GeomObject} from './core/geomObject'
import {initRandom} from '../utils/random'
import {EdgeLabelPlacement} from './edgeLabelPlacement'

// function routeEdges(
//  geomG: GeomGraph,
//  edgeRoutingSettings: EdgeRoutingSettings,
//  cornerFitRadius = 3,
// ) {
//  if (edgeRoutingSettings.edgeRoutingMode !== EdgeRoutingMode.Rectilinear) {
//    // TODO: enable other modes
//    routeStraightEdges(geomG)
//  } else {
//    if (edgeRoutingSettings.EdgeRoutingMode === EdgeRoutingMode.Rectilinear)
//      routeRectilinearEdges(geomG, edgeRoutingSettings.padding, cornerFitRadius)
//  }
// }

// function routeStraightEdges(geomG: GeomGraph) {
//  for (const u of geomG.deepNodes) {
//    for (const e of u.outEdges()) {
//      if (e.curve == null ) StraightLineEdges.RouteEdge(e, 0)
//    }
//    for (const e of u.selfEdges()) {
//      if (e.curve == null ) StraightLineEdges.RouteEdge(e, 0)
//    }
//  }
// }

export function enforceLayoutSettings(geomGraph: GeomGraph, ss: any) {
  if (!geomGraph.layoutSettings) geomGraph.layoutSettings = ss

  for (const n of geomGraph.shallowNodes) {
    if (n instanceof GeomGraph) {
      enforceLayoutSettings(<GeomGraph>n, geomGraph.layoutSettings)
    }
  }
}

function createSettingsIfNeeded(geomGraph: GeomGraph) {
  if (!geomGraph.layoutSettings) {
    geomGraph.layoutSettings = figureOutSettings(geomGraph)
  }
}

function figureOutSettings(geomGraph: GeomGraph): any {
  const tooLargeForLayered = geomGraph.graph.shallowNodeCount > 2000 || geomGraph.graph.nodeCollection.edgeCount > 4000
  if (tooLargeForLayered) {
    return new MdsLayoutSettings()
  }

  let directed = false
  for (const e of geomGraph.edges()) {
    if (e.sourceArrowhead != null || e.targetArrowhead != null) {
      directed = true
      break
    }
  }

  return directed ? new SugiyamaLayoutSettings() : new MdsLayoutSettings()
}
function layoutEngine(geomGraph: GeomGraph, cancelToken: CancelToken) {
  createSettingsIfNeeded(geomGraph)
  if (geomGraph.layoutSettings instanceof SugiyamaLayoutSettings) {
    const ll = new LayeredLayout(geomGraph, <SugiyamaLayoutSettings>geomGraph.layoutSettings, cancelToken)
    ll.run()
  } else if (geomGraph.layoutSettings instanceof MdsLayoutSettings) {
    const pivotMds = new PivotMDS(geomGraph, cancelToken, () => 1, <MdsLayoutSettings>geomGraph.layoutSettings)
    pivotMds.run()
  } else {
    throw Error('not implemented')
  }
}

export function layoutGeomGraph(geomGraph: GeomGraph, cancelToken: CancelToken = null): void {
  createSettingsIfNeeded(geomGraph)
  layoutGeomGraphDetailed(geomGraph, cancelToken, layoutEngine, routeEdges, optimalPackingRunner)
}

export function getEdgeRoutingSettingsFromAncestors(geomGraph: GeomGraph): EdgeRoutingSettings {
  do {
    if (geomGraph.layoutSettings && geomGraph.layoutSettings.edgeRoutingSettings) {
      return geomGraph.layoutSettings.edgeRoutingSettings
    }
    const parent = geomGraph.graph.parent
    if (parent) {
      geomGraph = <GeomGraph>GeomObject.getGeom(parent)
    } else {
      break
    }
  } while (true)
  const ers = new EdgeRoutingSettings()
  ers.EdgeRoutingMode = EdgeRoutingMode.Spline
  return ers
}

export function routeEdges(geomGraph: GeomGraph, edgesToRoute: GeomEdge[], cancelToken: CancelToken) {
  const ers: EdgeRoutingSettings = getEdgeRoutingSettingsFromAncestors(geomGraph)
  if (ers.EdgeRoutingMode === EdgeRoutingMode.Rectilinear) {
    routeRectilinearEdges(geomGraph, edgesToRoute, cancelToken)
  } else if (ers.EdgeRoutingMode === EdgeRoutingMode.Spline || ers.EdgeRoutingMode === EdgeRoutingMode.SplineBundling) {
    routeSplines(geomGraph, edgesToRoute, cancelToken)
  } else if (ers.EdgeRoutingMode === EdgeRoutingMode.StraightLine) {
    straightLineEdgePatcher(geomGraph, edgesToRoute, cancelToken)
  } else if (ers.EdgeRoutingMode !== EdgeRoutingMode.None) {
    new SplineRouter(geomGraph, edgesToRoute).run()
  }
  positionLabelsIfNeeded(geomGraph, edgesToRoute)
}
/** Lays out a GeomGraph, which is possibly disconnected and might have sub-graphs */
export function layoutGeomGraphDetailed(
  geomG: GeomGraph,
  cancelToken: CancelToken,
  layoutEngine: (g: GeomGraph, cancelToken: CancelToken) => void,
  edgeRouter: (g: GeomGraph, edgesToRoute: GeomEdge[], cancelToken: CancelToken) => void,
  packing: (g: GeomGraph, subGraphs: GeomGraph[]) => void,
  flipToScreenCoords = true,
  randomSeed = 1,
) {
  if (geomG.graph.isEmpty()) {
    return
  }
  initRandom(randomSeed)
  requireLabelPositioning(geomG)
  const removedEdges = removeEdgesLeadingOutOfGraphOrCollapsingToSelfEdges()

  layoutShallowSubgraphs(geomG)
  const liftedEdges = createLiftedEdges(geomG.graph)
  const connectedGraphs: GeomGraph[] = getConnectedComponents(geomG)
  layoutComps()

  liftedEdges.forEach((e) => {
    e[0].edge.remove()
    e[1].add()
  })
  // restore the parent
  connectedGraphs.forEach((g) => {
    for (const n of g.graph.shallowNodes) n.parent = geomG.graph
  })

  removedEdges.forEach((e) => e.add())
  geomG.boundingBox = geomG.pumpTheBoxToTheGraphWithMargins()
  //the final touches
  if (geomG.graph.parent == null) {
    const edgesToRoute: Array<GeomEdge> = getUnroutedEdges(geomG)
    edgeRouter(geomG, edgesToRoute, cancelToken)
    positionLabelsIfNeeded(geomG, edgesToRoute)
    geomG.boundingBox = geomG.pumpTheBoxToTheGraphWithMargins()

    if (flipToScreenCoords) {
      geomG.FlipYAndMoveLeftTopToOrigin()
    }
  }

  // end of layoutGeomGraphDetailed body

  function getUnroutedEdges(g: GeomGraph): Array<GeomEdge> {
    const edges = []
    for (const n of g.deepNodesIt()) {
      for (const e of n.outEdges()) if (e.curve == null) edges.push(e)
      for (const e of n.selfEdges()) if (e.curve == null) edges.push(e)
    }
    return edges
  }

  function layoutShallowSubgraphs(geomG: GeomGraph) {
    for (const n of geomG.shallowNodes) {
      if (n instanceof GeomGraph) {
        const g = <GeomGraph>n
        layoutGeomGraphDetailed(g, cancelToken, layoutEngine, edgeRouter, packing)
      }
    }
  }

  function removeEdgesLeadingOutOfGraphOrCollapsingToSelfEdges(): Set<Edge> {
    const ret = new Set<Edge>()
    const graphUnderSurgery = geomG.graph
    if (graphUnderSurgery.parent == null) return ret
    for (const n of graphUnderSurgery.shallowNodes) {
      for (const e of n.outEdges) {
        const lifted = graphUnderSurgery.liftNode(e.target)
        if (lifted == null || lifted === n) {
          ret.add(e)
        }
      }
      for (const e of n.inEdges) {
        const lifted = graphUnderSurgery.liftNode(e.source)
        if (lifted == null || lifted === n) {
          ret.add(e)
        }
      }
    }
    for (const e of ret) e.remove()
    return ret
  }

  function layoutComps() {
    if (connectedGraphs.length === 1) {
      layoutEngine(geomG, cancelToken)
    } else {
      for (const cg of connectedGraphs) {
        layoutEngine(cg, cancelToken)
        cg.boundingBox = cg.pumpTheBoxToTheGraphWithMargins()
      }
      packing(geomG, connectedGraphs)
    }
  }
} // end of layoutGeomGraphDetailed

// returns arrays of pairs (new lifted GeomEdge, existing Edge)
function createLiftedEdges(graph: Graph): Array<[GeomEdge, Edge]> {
  const liftedEdges = new Array<[GeomEdge, Edge]>()
  for (const u of graph.deepNodes) {
    const liftedU = graph.liftNode(u)
    if (liftedU == null) continue
    for (const uv of u.outEdges.values()) {
      const v = uv.target
      const liftedV = graph.liftNode(v)
      if (liftedV == null || (liftedU === u && liftedV === v) || liftedU === liftedV) {
        continue
      }
      uv.remove()
      const newLiftedEdge = new Edge(liftedU, liftedV)
      const newLiftedGeomEdge = new GeomEdge(newLiftedEdge)
      liftedEdges.push([newLiftedGeomEdge, uv])
    }
  }
  return liftedEdges
}

function getConnectedComponents(parentGeomGraph: GeomGraph): GeomGraph[] {
  const parentGraph = parentGeomGraph.graph
  const comps = shallowConnectedComponents(parentGraph)
  const ret = []
  let i = 0
  for (const comp of comps) {
    const g = new Graph(parentGraph.id + i++)
    g.parent = parentGraph
    const geomG = new GeomGraph(g)
    geomG.layoutSettings = parentGeomGraph.layoutSettings
    for (const n of comp) {
      n.parent = g
      g.addNode(n) // this changes the parent - should be restored to graph
    }
    ret.push(geomG)
  }
  return ret
}
/** route edges with segments paralles to either X or Y axes */
export function routeRectilinearEdges(
  geomG: GeomGraph,
  edgesToRoute: GeomEdge[],
  cancelToken: CancelToken,
  nodePadding = 1,
  cornerFitRadius = 3,
) {
  const rr = RectilinearEdgeRouter.constructorGNAN(geomG, edgesToRoute, nodePadding, cornerFitRadius)
  rr.run()
}
function positionLabelsIfNeeded(geomG: GeomGraph, edges: GeomEdge[]) {
  if (edges.length === 0) return
  const ep = EdgeLabelPlacement.constructorGA(geomG, edges)
  ep.run()
}
/** mark labels as required positoning */
function requireLabelPositioning(geomG: GeomGraph) {
  for (const e of geomG.deepEdges) {
    if (e.label) e.label.isPositioned = false
  }
}

export function geometryIsCreated(graph: Graph): boolean {
  if (GeomGraph.getGeom(graph) == null) return false
  for (const n of graph.shallowNodes) {
    const gn = GeomObject.getGeom(n) as GeomNode
    if (gn == null || gn.boundaryCurve == null) return false
    if (n instanceof Graph) {
      if (geometryIsCreated(n) === false) return false
    }
  }
  for (const e of graph.edges) {
    const ge = GeomEdge.getGeom(e) as GeomEdge
    if (ge == null) return false
  }
  return true
}

export function layoutIsCalculated(graph: Graph): boolean {
  const geomGraph = GeomGraph.getGeom(graph)
  if (geomGraph == null) return false
  if (geomGraph.boundingBox == null || geomGraph.boundingBox.isEmpty()) return false

  for (const n of graph.shallowNodes) {
    const gn = GeomObject.getGeom(n) as GeomNode
    if (gn == null || gn.boundaryCurve == null) return false
    if (n instanceof Graph) {
      if (layoutIsCalculated(n) === false) return false
    }
  }
  for (const e of graph.edges) {
    const ge = GeomEdge.getGeom(e) as GeomEdge
    if (ge == null || ge.curve == null) return false
  }
  // todo: consider adding more checks. For example, check that the bounding boxes of subgraphs make sense, and the edge curves are attached to the nodes
  return true
}
