import {RectilinearEdgeRouter} from '../routing/rectilinear/RectilinearEdgeRouter'
import {GeomGraph, optimalPackingRunner} from './core/GeomGraph'
import {CancelToken} from '../utils/cancelToken'
import {CurveFactory} from '../math/geometry/curveFactory'
import {Edge} from '../structs/edge'
import {Graph, shallowConnectedComponents} from '../structs/graph'
import {GeomEdge} from './core/geomEdge'
import {LayoutSettings, SugiyamaLayoutSettings} from './layered/SugiyamaLayoutSettings'
import {LayeredLayout, MdsLayoutSettings} from '..'
import {PivotMDS} from './mds/PivotMDS'
import {EdgeRoutingMode} from '../routing/EdgeRoutingMode'
import {straightLineEdgePatcher} from '../routing/StraightLineEdges'
import {routeSplines, SplineRouter} from '../routing/splineRouter'
import {EdgeRoutingSettings} from '../routing/EdgeRoutingSettings'
import {GeomObject} from './core/geomObject'
import {initRandom} from '../utils/random'
import {EdgeLabelPlacement} from './edgeLabelPlacement'

// function routeEdges(
//   geomG: GeomGraph,
//   edgeRoutingSettings: EdgeRoutingSettings,
//   cornerFitRadius = 3,
// ) {
//   if (edgeRoutingSettings.edgeRoutingMode != EdgeRoutingMode.Rectilinear) {
//     // TODO: enable other modes
//     routeStraightEdges(geomG)
//   } else {
//     if (edgeRoutingSettings.EdgeRoutingMode == EdgeRoutingMode.Rectilinear)
//       routeRectilinearEdges(geomG, edgeRoutingSettings.padding, cornerFitRadius)
//   }
// }

// function routeStraightEdges(geomG: GeomGraph) {
//   for (const u of geomG.deepNodes()) {
//     for (const e of u.outEdges()) {
//       if (e.curve == null) StraightLineEdges.RouteEdge(e, 0)
//     }
//     for (const e of u.selfEdges()) {
//       if (e.curve == null) StraightLineEdges.RouteEdge(e, 0)
//     }
//   }
// }

export function enforceLayoutSettings(geomGraph: GeomGraph, ss: LayoutSettings) {
  if (!geomGraph.layoutSettings) geomGraph.layoutSettings = ss

  for (const n of geomGraph.shallowNodes()) {
    if (n instanceof GeomGraph) {
      enforceLayoutSettings(<GeomGraph>n, geomGraph.layoutSettings)
    }
  }
}

export function layoutGeomGraph(geomGraph: GeomGraph, cancelToken: CancelToken): void {
  createSettingsIfNeeded(geomGraph)
  layoutGeomGraphDetailed(geomGraph, cancelToken, layoutEngine, routeEdges, optimalPackingRunner)
  // end of the function body

  function createSettingsIfNeeded(geomGraph: GeomGraph) {
    if (!geomGraph.layoutSettings) {
      geomGraph.layoutSettings = figureOutSettings(geomGraph)
    }
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

  function figureOutSettings(geomGraph: GeomGraph): LayoutSettings {
    if (geomGraph.shallowNodeCount < 200 || geomGraph.edgeCount < 200) return new SugiyamaLayoutSettings()
    return new MdsLayoutSettings()
  }
} // end of layoutGeomGraph

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
  if (ers.EdgeRoutingMode == EdgeRoutingMode.Rectilinear) {
    routeRectilinearEdges(geomGraph, edgesToRoute, cancelToken)
  } else if (ers.EdgeRoutingMode == EdgeRoutingMode.Spline || ers.EdgeRoutingMode == EdgeRoutingMode.SplineBundling) {
    routeSplines(geomGraph, edgesToRoute, cancelToken)
  } else if (ers.EdgeRoutingMode == EdgeRoutingMode.StraightLine) {
    straightLineEdgePatcher(geomGraph, edgesToRoute, cancelToken)
  } else if (ers.EdgeRoutingMode != EdgeRoutingMode.None) {
    new SplineRouter(geomGraph, edgesToRoute).run()
  }
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
  markLabelsAsUnpositoned(geomG)
  const removedEdges = removeEdgesLeadingOutOfGraphOrCollapsingToSelfEdges()

  layoutShallowSubgraphs(geomG)
  const liftedEdges = createLiftedEdges(geomG.graph)
  const connectedGraphs: GeomGraph[] = getConnectedComponents(geomG)
  // TODO: possible optimization for a connected graph
  layoutComps()

  liftedEdges.forEach((e) => {
    e[0].edge.remove()
    e[1].add()
  })
  // restore the parent
  connectedGraphs.forEach((g) => {
    for (const n of g.graph.shallowNodes) n.parent = geomG.graph
  })

  const edgesToRoute: Array<GeomEdge> = getUnroutedEdges(geomG)
  removedEdges.forEach((e) => e.add())
  edgeRouter(geomG, edgesToRoute, cancelToken)

  //the final touches
  if (geomG.graph.parent == null) {
    positionLabelsIfNeeded(geomG)
    if (flipToScreenCoords) {
      geomG.FlipYAndMoveLeftTopToOrigin()
    }
  }

  // end of layoutGeomGraphDetailed body

  function getUnroutedEdges(g: GeomGraph): Array<GeomEdge> {
    const edges = []
    for (const n of g.deepNodes()) {
      for (const e of n.outEdges()) if (e.curve == null) edges.push(e)
      for (const e of n.selfEdges()) if (e.curve == null) edges.push(e)
    }
    return edges
  }

  function layoutShallowSubgraphs(geomG: GeomGraph) {
    for (const n of geomG.shallowNodes()) {
      if (n instanceof GeomGraph) {
        const g = <GeomGraph>n
        layoutGeomGraphDetailed(g, cancelToken, layoutEngine, edgeRouter, packing)
        if (!g.graph.isEmpty()) {
          const bb = g.boundingBox

          if (bb && !bb.isEmpty()) {
            n.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(
              bb.width,
              bb.height,
              Math.min(10, bb.width / 10),
              Math.min(10, bb.height / 10),
              bb.center,
            )
          }
        }
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
        if (lifted == null || lifted == n) {
          ret.add(e)
        }
      }
      for (const e of n.inEdges) {
        const lifted = graphUnderSurgery.liftNode(e.source)
        if (lifted == null || lifted == n) {
          ret.add(e)
        }
      }
    }
    for (const e of ret) e.remove()
    return ret
  }

  function layoutComps() {
    if (connectedGraphs.length == 0) return
    for (const cg of connectedGraphs) {
      layoutEngine(cg, cancelToken)
    }
    packing(geomG, connectedGraphs)
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
      if (liftedV == null || (liftedU == u && liftedV == v) || liftedU == liftedV) {
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
  const rr = RectilinearEdgeRouter.constructorGNANB(geomG, edgesToRoute, nodePadding, cornerFitRadius, true)
  rr.run()
}
function positionLabelsIfNeeded(geomG: GeomGraph) {
  const edgesWithNonPositionedLabels = Array.from(geomG.deepEdges()).filter((edge) => edge.label && edge.label.isPositioned == false)

  if (edgesWithNonPositionedLabels.length == 0) return
  const ep = EdgeLabelPlacement.constructorGA(geomG, edgesWithNonPositionedLabels)
  ep.run()
}
function markLabelsAsUnpositoned(geomG: GeomGraph) {
  for (const e of geomG.deepEdges()) {
    if (e.label) e.label.isPositioned = false
  }
}
