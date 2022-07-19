import {HashSet} from '@esfx/collections'
import {Direction, CurveFactory, LineSegment} from '../../math/geometry'
import {DebugCurve} from '../../math/geometry/debugCurve'
import {EdgeRoutingMode} from '../../routing/EdgeRoutingMode'
import {Edge, GeomNode} from '../..'
import {Algorithm} from '../../utils/algorithm'
import {GeomGraph} from '../core'
import {LayoutSettings, SugiyamaLayoutSettings} from '../layered/SugiyamaLayoutSettings'
import {addRange, insertRange} from '../../utils/setOperations'
export class Relayout extends Algorithm {
  graph: GeomGraph

  modifiedNodes: Iterable<GeomNode>

  clusterSettings: (g: GeomGraph) => LayoutSettings

  ancestorsOfModifiedNodes: Set<GeomGraph>

  addedNodesByCluster: Map<GeomGraph, HashSet<GeomNode>> = new Map<GeomGraph, HashSet<GeomNode>>()

  ///  <summary>
  ///  Recursively lay out the given clusters using the specified settings for each cluster, or if none is given for a particular
  ///  cluster then inherit from the cluster's ancestor - or from the specifed defaultSettings.
  ///  Clusters (other than the root) will be translated (together with their descendants) such that their
  ///  bottom-left point of their new boundaries are the same as the bottom-left of their old boundaries
  ///  (i.e. clusters are laid-out in place).
  ///  </summary>
  ///  <param name="graph">The graph being operated on.</param>
  ///  <param name="modifiedNodes">The nodes whose bounds are modified.</param>
  ///  <param name="addedNodes">Nodes added to the graph - a new initial position will be found for these nodes close to their neighbors</param>
  ///  <param name="clusterSettings">Settings to use for each cluster.</param>
  public constructor(
    graph: GeomGraph,
    modifiedNodes: Iterable<GeomNode>,
    addedNodes: Iterable<GeomNode>,
    clusterSettings: (gg: GeomGraph) => LayoutSettings,
  ) {
    super(null)
    if (addedNodes == null) return

    this.graph = graph
    this.modifiedNodes = modifiedNodes
    this.clusterSettings = clusterSettings
    this.ancestorsOfModifiedNodes = new Set<GeomGraph>()
    for (const v of this.modifiedNodes) {
      insertRange(this.ancestorsOfModifiedNodes, v.getAncestors())
    }

    for (const v of addedNodes) {
      this.addToChildren(v.parent as GeomGraph, v)
    }

    for (const v of addedNodes) {
      insertRange(this.ancestorsOfModifiedNodes, v.getAncestors())
    }
  }

  addToChildren(parent: GeomGraph, v: GeomNode) {
    let addedChildren = this.addedNodesByCluster.get(parent)
    if (addedChildren == null) {
      this.addedNodesByCluster.set(parent, (addedChildren = new HashSet<GeomNode>()))
    }

    addedChildren.add(v)
  }

  ///  <summary>
  ///  The actual layout process
  ///  </summary>
  run() {
    const openedClusters = Array.from(this.modifiedNodes).filter((v) => v instanceof GeomGraph && !v.isCollapsed)
    if (openedClusters.length > 0) {
      new InitialLayoutByCluster(this.graph, openedClusters, this.clusterSettings).Run()
    }

    this.Visit(this.graph.RootCluster)
    //  routing edges that cross cluster boundaries
    InitialLayoutByCluster.RouteParentEdges(this.graph, clusterSettings(this.graph.RootCluster).EdgeRoutingSettings)
    LayoutHelpers.RouteAndLabelEdges(
      this.graph,
      clusterSettings(this.graph.RootCluster),
      this.graph.edges.Where(BetweenClusterOnTheRightLevel),
      0,
      this.cancelToken,
    )
    this.graph.UpdateBoundingBox()
    ProgressComplete()
  }

  BetweenClusterOnTheRightLevel(edge: Edge): boolean {
    const sourceAncestors = new Set<GeomGraph>(edge.source.AllClusterAncestors)
    const targetAncestors = new Set<GeomGraph>(edge.target.AllClusterAncestors)
    return (sourceAncestors * targetAncestors).IsContained(this.ancestorsOfModifiedNodes)
  }

  //  depth first traversal of cluster hierarchy
  //  if the cluster is not in initiallayoutstate then visit children and then apply layout
  Visit(u: GeomGraph) {
    if (u.isCollapsed || !this.ancestorsOfModifiedNodes.Contains(u)) {
      return
    }

    for (const c in u.Clusters) {
      this.Visit(c)
    }

    this.LayoutCluster(u)
  }

  ///  <summary>
  ///  Apply the appropriate layout to the specified cluster
  ///  </summary>
  ///  <param name="cluster">the root of the cluster hierarchy to lay out</param>
  ///  <returns>list of edges external to the cluster</returns>
  LayoutCluster(cluster: GeomGraph) {
    ProgressStep()
    cluster.UnsetInitialLayoutState()
    let settings: FastIncrementalLayoutSettings = null
    const s: LayoutSettings = clusterSettings(cluster)
    let layoutDirection: Direction = Direction.None
    if (s instanceof SugiyamaLayoutSettings) {
      const ss = <SugiyamaLayoutSettings>s
      settings = new FastIncrementalLayoutSettings(<FastIncrementalLayoutSettings>ss.FallbackLayoutSettings)
      // TODO: Warning!!!, inline IF is not supported ?
      ss.FallbackLayoutSettings != null
      new FastIncrementalLayoutSettings()
      layoutDirection = LayeredLayoutEngine.GetLayoutDirection(ss)
    } else {
      settings = new FastIncrementalLayoutSettings(<FastIncrementalLayoutSettings>s)
    }

    settings.ApplyForces = true
    settings.MinorIterations = 10
    settings.AvoidOverlaps = true
    settings.InterComponentForces = false
    settings.IdealEdgeLength = [][((Direction = layoutDirection), (Separation = 30))]
    settings.EdgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
    let addedNodes: HashSet<GeomNode>
    if (this.addedNodesByCluster.TryGetValue(cluster, /* out */ addedNodes)) {
      //  if the structure of the cluster has changed then we apply unconstrained layout first,
      //  then introduce structural constraints, and then all constraints
      settings.MinConstraintLevel = 0
      settings.MaxConstraintLevel = 2
    } else {
      settings.MinConstraintLevel = 2
    }

    const newGraph: GeomGraph = Relayout.GetShallowCopyGraphUnderCluster(cluster)
    LayoutAlgorithmHelpers.ComputeDesiredEdgeLengths(settings.IdealEdgeLength, newGraph)
    //  orthogonal ordering constraints preserve the left-of, above-of relationships between existing nodes
    //  (we do not apply these to the newly added nodes)
    this.GenerateOrthogonalOrderingConstraints(newGraph.node.Where(() => {}, !addedNodes.Contains(<GeomNode>v.UserData)).ToList(), settings)
    this.LayoutComponent(newGraph, settings)
    // LayoutSettings.ShowGraph(newGraph);
    InitialLayoutByCluster.FixOriginalGraph(newGraph, true)
    cluster.UpdateBoundary(newGraph.boundingBox)
  }

  ///  <summary>
  ///  Generate orthogonal ordering constraints to preserve the left/right, above/below relative positions of nodes
  ///  </summary>
  ///  <param name="nodes"></param>
  ///  <param name="settings"></param>
  @Conditional('RelayoutOrthogonalOrderingConstraints')
  GenerateOrthogonalOrderingConstraints(nodes: Iterable<GeomNode>, settings: FastIncrementalLayoutSettings) {
    let p: GeomNode = null
    for (const v in this.graph.node.OrderBy(() => {}, v.Center.X)) {
      if (p != null) {
        settings.AddStructuralConstraint(new HorizontalSeparationConstraint(p, v, 0.1))
      }

      p = v
    }

    p = null
    for (const v in this.graph.node.OrderBy(() => {}, v.Center.Y)) {
      if (p != null) {
        settings.AddStructuralConstraint(new VerticalSeparationConstraint(p, v, 0.1))
      }

      p = v
    }
  }

  ///  <summary>
  ///  Creates a shallow copy of the cluster into a GeomGraph
  ///  </summary>
  ///  <param name="cluster">cluster to copy</param>
  ///  <returns>cluster children and edges between children in a GeomGraph</returns>
  static GetShallowCopyGraphUnderCluster(cluster: GeomGraph): GeomGraph {
    const originalToCopyNodeMap: Map<GeomNode, GeomNode> = InitialLayoutByCluster.ShallowNodeCopyDictionary(cluster)
    const newGraph = Relayout.CreateGeomGraphAndPopulateItWithNodes(originalToCopyNodeMap)
    for (const target in originalToCopyNodeMap.keys) {
      for (const underNode in Relayout.AllSuccessors(target)) {
        for (const e in underNode.InEdges) {
          const sourceAncestorUnderRoot = InitialLayoutByCluster.Ancestor(e.Source, cluster)
          if (Relayout.IsBetweenClusters(sourceAncestorUnderRoot, target)) {
            newGraph.edges.Add(InitialLayoutByCluster.CopyEdge(originalToCopyNodeMap, e, sourceAncestorUnderRoot, target))
          }
        }

        for (const e in target.SelfEdges) {
          newGraph.edges.Add(InitialLayoutByCluster.CopyEdge(originalToCopyNodeMap, e))
        }
      }
    }

    return newGraph
  }

  static CreateGeomGraphAndPopulateItWithNodes(originalToCopyNodeMap: Map<GeomNode, GeomNode>): GeomGraph {
    const newGraph: GeomGraph = new GeomGraph()
    for (const v in originalToCopyNodeMap.values) {
      newGraph.node.Add(v)
    }

    return newGraph
  }

  static IsBetweenClusters(sourceAncestorUnderRoot: GeomNode, target: GeomNode): boolean {
    return sourceAncestorUnderRoot != target && sourceAncestorUnderRoot != null
  }

  static AllSuccessors(node: GeomNode): Iterable<GeomNode> {
    const ret = [][node]
    const cl = <GeomGraph>node
    if (cl != null) {
      for (const u in cl.allSuccessorsWidthFirst()) {
        if (u != node) {
          ret.Add(u)
        }
      }
    }

    return ret
  }

  private /* internal */ LayoutComponent(component: GeomGraph, settings: FastIncrementalLayoutSettings) {
    //  for small graphs (below 100 nodes) do extra iterations
    settings.MaxIterations = LayoutAlgorithmHelpers.NegativeLinearInterpolation(component.node.Count, 50, 500, 3, 5)
    settings.MinorIterations = LayoutAlgorithmHelpers.NegativeLinearInterpolation(component.node.Count, 50, 500, 2, 10)
    const fil: FastIncrementalLayout = new FastIncrementalLayout(component, settings, settings.MinConstraintLevel, () => {}, settings)
    Debug.Assert(settings.Iterations == 0)
    for (const level in Enumerable.Range(settings.MinConstraintLevel, settings.MaxConstraintLevel + 1)) {
      if (level != fil.CurrentConstraintLevel) {
        fil.CurrentConstraintLevel = level
        if (level == 2) {
          settings.MinorIterations = 1
          settings.ApplyForces = false
        }
      }

      for (; !settings.IsDone; ) {
        fil.Run()
      }
    }

    //  Pad the graph with margins so the packing will be spaced out.
    component.margins = settings.ClusterMargin
    component.UpdateBoundingBox()
  }

  protected static ShowGraphInDebugViewer(graph: GeomGraph) {
    if (this.graph == null) {
      return
    }

    Microsoft.Msagl.GraphViewerGdi.DisplayGeomGraph.SetShowFunctions()
    // FixNullCurveEdges(graph.Edges);
    let debugCurves = this.graph.Nodes.Select(() => {}, n.BoundaryCurve).Select(() => {}, new DebugCurve('red', c))
    debugCurves = debugCurves.Concat(
      this.graph.RootCluster.AllClustersDepthFirst()
        .Select(() => {}, c.BoundaryCurve)
        .Select(() => {}, new DebugCurve('green', c)),
    )
    debugCurves = debugCurves.Concat(this.graph.Edges.Select(() => {}, new DebugCurve(120, 1, 'blue', e.Curve)))
    debugCurves = debugCurves.Concat(
      this.graph.Edges.Where(() => {}, e.Label != null).Select(() => {},
      new DebugCurve('green', CurveFactory.createRectangle(e.LabelBBox))),
    )
    const arrowHeadsAtSource = from
    e
    let where: graph.Edges
    e.Curve != null && e.EdgeGeometry.SourceArrowhead != null
    select
    new DebugCurve(120, 2, 'black', new LineSegment(e.Curve.Start, e.EdgeGeometry.SourceArrowhead.TipPosition))
    const arrowHeadsAtTarget = from
    e
    let where: graph.Edges
    e.Curve != null && e.EdgeGeometry.TargetArrowhead != null
    select
    new DebugCurve(120, 2, 'black', new LineSegment(e.Curve.End, e.EdgeGeometry.TargetArrowhead.TipPosition))
    LayoutSettings.ShowDebugCurvesEnumeration(debugCurves.Concat(arrowHeadsAtSource).Concat(arrowHeadsAtTarget))
  }
}
