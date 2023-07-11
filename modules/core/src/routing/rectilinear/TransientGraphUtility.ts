import {String} from 'typescript-string-operations'
import {Point, Rectangle, CompassVector, Direction, GeomConstants, LineSegment} from '../../math/geometry'

import {closeDistEps} from '../../utils/compare'
import {TollFreeVisibilityEdge} from '../visibility/TollFreeVisibilityEdge'
import {VisibilityEdge} from '../visibility/VisibilityEdge'
import {VisibilityGraph} from '../visibility/VisibilityGraph'
import {VisibilityVertex} from '../visibility/VisibilityVertex'
import {GroupBoundaryCrossing} from './GroupBoundaryCrossing'
import {ObstacleTree} from './ObstacleTree'
import {PointAndCrossings} from './PointAndCrossings'
import {PointAndCrossingsList} from './PointAndCrossingsList'
import {PointComparer} from './PointComparer'
import {ScanSegment} from './ScanSegment'
import {SparseVisibilityGraphGenerator} from './SparseVisibiltyGraphGenerator'
import {StaticGraphUtility} from './StaticGraphUtility'
import {VisibilityGraphGenerator} from './VisibilityGraphGenerator'
import {VisibilityVertexRectilinear} from './VisibilityVertexRectiline'

export class TransientGraphUtility {
  // Vertices added to the graph for routing.
  AddedVertices: Array<VisibilityVertexRectilinear> = new Array<VisibilityVertexRectilinear>()

  // Edges added to the graph for routing.
  AddedEdges: Array<TollFreeVisibilityEdge> = new Array<TollFreeVisibilityEdge>()

  // Edges joining two non-transient vertices; these must be replaced.
  edgesToRestore: Array<VisibilityEdge> = new Array<VisibilityEdge>()

  LimitPortVisibilitySpliceToEndpointBoundingBox = false

  // Owned by creator of this class.
  GraphGenerator: VisibilityGraphGenerator

  get ObstacleTree(): ObstacleTree {
    return this.GraphGenerator.ObstacleTree
  }

  get VisGraph(): VisibilityGraph {
    return this.GraphGenerator.VisibilityGraph
  }

  private get IsSparseVg(): boolean {
    return this.GraphGenerator instanceof SparseVisibilityGraphGenerator
  }

  constructor(graphGen: VisibilityGraphGenerator) {
    this.GraphGenerator = graphGen
  }

  AddVertex(location: Point): VisibilityVertex {
    const vertex = this.VisGraph.AddVertexP(location)
    this.AddedVertices.push(<VisibilityVertexRectilinear>vertex)
    return vertex
  }

  FindOrAddVertex(location: Point): VisibilityVertex {
    const vertex = this.VisGraph.FindVertex(location)
    return vertex ?? this.AddVertex(location)
  }

  FindOrAddEdgeVV(sourceVertex: VisibilityVertex, targetVertex: VisibilityVertex): VisibilityEdge {
    return this.FindOrAddEdge(sourceVertex, targetVertex, ScanSegment.NormalWeight)
  }

  FindOrAddEdge(sourceVertex: VisibilityVertex, targetVertex: VisibilityVertex, weight: number): VisibilityEdge {
    // Since we're adding transient edges into the graph, we're not doing full intersection
    // evaluation; thus there may already be an edge from the source vertex in the direction
    // of the target vertex, but ending before or after the target vertex.
    const dirToTarget: Direction = PointComparer.GetPureDirectionVV(sourceVertex, targetVertex)
    // Is there an edge in the chain from sourceVertex in the direction of targetVertex
    // that brackets targetvertex?
    //      <sourceVertex> -> ..1.. -> ..2.. <end>   3
    // Yes if targetVertex is at the x above 1 or 2, No if it is at 3.  If false, bracketSource
    // will be set to the vertex at <end> (if there are any edges in that direction at all).
    const t = {
      bracketSource: <VisibilityVertex>undefined,
      bracketTarget: <VisibilityVertex>undefined,
      splitVertex: <VisibilityVertex>undefined,
    }
    TransientGraphUtility.GetBrackets(sourceVertex, targetVertex, dirToTarget, t)

    // If null !=  edge then targetVertex is between bracketSource and bracketTarget and SplitEdge returns the
    // first half-edge (and weight is ignored as the split uses the edge weight).
    let edge = this.VisGraph.FindEdgePP(t.bracketSource.point, t.bracketTarget.point)
    edge = edge != null ? this.SplitEdge(edge, t.splitVertex) : this.CreateEdge(t.bracketSource, t.bracketTarget, weight)

    return edge
  }

  private static GetBrackets(
    sourceVertex: VisibilityVertex,
    targetVertex: VisibilityVertex,
    dirToTarget: Direction,
    t: {
      bracketSource: VisibilityVertex
      bracketTarget: VisibilityVertex
      splitVertex: VisibilityVertex
    },
  ) {
    // Is there an edge in the chain from sourceVertex in the direction of targetVertex
    // that brackets targetvertex?
    //      <sourceVertex> -> ..1.. -> ..2.. <end>   3
    // Yes if targetVertex is at the x above 1 or 2, No if it is at 3.  If false, bracketSource
    // will be set to the vertex at <end> (if there are any edges in that direction at all).
    t.splitVertex = targetVertex
    if (!TransientGraphUtility.FindBracketingVertices(sourceVertex, targetVertex.point, dirToTarget, t)) {
      // No bracketing of targetVertex from sourceVertex but bracketSource has been updated.
      // Is there a bracket of bracketSource from the targetVertex direction?
      //                      3   <end> ..2.. <- ..1..   <targetVertex>
      // Yes if bracketSource is at the x above 1 or 2, No if it is at 3.  If false, bracketTarget
      // will be set to the vertex at <end> (if there are any edges in that direction at all).
      // If true, then bracketSource and splitVertex must be updated.
      const tt = {
        bracketSource: <VisibilityVertex>null,
        bracketTarget: <VisibilityVertex>null,
      }
      if (TransientGraphUtility.FindBracketingVertices(targetVertex, sourceVertex.point, CompassVector.OppositeDir(dirToTarget), tt)) {
        /*Assert.assert(
          t.bracketSource === sourceVertex,
          'Mismatched bracketing detection',
        )*/
        t.bracketSource = tt.bracketTarget
        t.splitVertex = sourceVertex
      }

      t.bracketTarget = tt.bracketSource
    }
  }
  static FindBracketingVertices(
    sourceVertex: VisibilityVertex,
    targetPoint: Point,
    dirToTarget: Direction,
    t: {bracketSource: VisibilityVertex; bracketTarget: VisibilityVertex},
  ): boolean {
    // Walk from the source to target until we bracket target or there is no nextVertex
    // in the desired direction.
    t.bracketSource = sourceVertex
    for (;;) {
      t.bracketTarget = StaticGraphUtility.FindAdjacentVertex(t.bracketSource, dirToTarget)
      if (t.bracketTarget == null) {
        break
      }

      if (Point.closeDistEps(t.bracketTarget.point, targetPoint)) {
        // Desired edge already exists.
        return true
      }

      if (dirToTarget !== PointComparer.GetDirections(t.bracketTarget.point, targetPoint)) {
        // bracketTarget is past vertex in the traversal direction.
        break
      }

      t.bracketSource = t.bracketTarget
    }

    return t.bracketTarget != null
  }

  // DEVTRACE
  // ReSharper restore InconsistentNaming
  private CreateEdge(first: VisibilityVertex, second: VisibilityVertex, weight: number): VisibilityEdge {
    // All edges in the graph are ascending.
    let source: VisibilityVertex = first
    let target: VisibilityVertex = second
    if (!PointComparer.IsPureLower(source.point, target.point)) {
      source = second
      target = first
    }

    const edge = new TollFreeVisibilityEdge(source, target, weight)
    VisibilityGraph.AddEdge(edge)
    this.AddedEdges.push(edge)
    return edge
  }

  RemoveFromGraph() {
    this.RemoveAddedVertices()
    this.RemoveAddedEdges()
    this.RestoreRemovedEdges()
  }

  private RemoveAddedVertices() {
    for (const vertex of this.AddedVertices) {
      // Removing all transient vertices will remove all associated transient edges as well.
      if (this.VisGraph.FindVertex(vertex.point) != null) {
        this.VisGraph.RemoveVertex(vertex)
      }
    }

    this.AddedVertices = []
  }

  private RemoveAddedEdges() {
    for (const edge of this.AddedEdges) {
      // If either vertex was removed, so was the edge, so just check source.
      if (this.VisGraph.FindVertex(edge.SourcePoint) != null) {
        VisibilityGraph.RemoveEdge(edge)
      }
    }

    this.AddedEdges = []
  }

  private RestoreRemovedEdges() {
    for (const edge of this.edgesToRestore) {
      // We should only put TransientVisibilityEdges in this list, and should never encounter
      // a non-transient edge in the graph after we've replaced it with a transient one, so
      // the edge should not be in the graph until we re-insert it.
      /*Assert.assert(
        !(edge instanceof TollFreeVisibilityEdge),
        'Unexpected Transient edge',
      )*/
      VisibilityGraph.AddEdge(edge)
    }

    this.edgesToRestore = []
  }

  FindNextEdge(vertex: VisibilityVertex, dir: Direction): VisibilityEdge {
    return StaticGraphUtility.FindAdjacentEdge(vertex, dir)
  }

  FindPerpendicularOrContainingEdge(startVertex: VisibilityVertex, dir: Direction, pointLocation: Point): VisibilityEdge {
    // Return the edge in 'dir' from startVertex that is perpendicular to pointLocation.
    // startVertex must therefore be located such that pointLocation is in 'dir' direction from it,
    // or is on the same line.
    // StaticGraphUtility.Assert((0
    //                === (CompassVector.OppositeDir(dir) & PointComparer.GetDirections(startVertex.point, pointLocation))), "the ray from 'dir' is away from pointLocation", this.ObstacleTree, this.VisGraph);
    while (true) {
      const nextVertex: VisibilityVertex = StaticGraphUtility.FindAdjacentVertex(startVertex, dir)
      if (nextVertex == null) {
        break
      }

      const dirCheck: Direction = PointComparer.GetDirections(nextVertex.point, pointLocation)
      // If the next vertex is past the intersection with pointLocation, this edge brackets it.
      if (0 !== (CompassVector.OppositeDir(dir) & dirCheck)) {
        return this.VisGraph.FindEdgePP(startVertex.point, nextVertex.point)
      }

      startVertex = nextVertex
    }

    return null
  }

  FindNearestPerpendicularOrContainingEdge(startVertex: VisibilityVertex, dir: Direction, pointLocation: Point): VisibilityEdge {
    // Similar to FindPerpendicularEdge, but first try to move closer to pointLocation,
    // as long as there are edges going in 'dir' that extend to pointLocation.
    let dirTowardLocation: Direction
    dir & PointComparer.GetDirections(startVertex.point, pointLocation)
    // If Directions. None then pointLocation is collinear.
    let currentVertex: VisibilityVertex = startVertex
    const currentDirTowardLocation: Direction = dirTowardLocation
    // First move toward pointLocation far as we can.
    while (Direction.None !== currentDirTowardLocation) {
      const nextVertex: VisibilityVertex = StaticGraphUtility.FindAdjacentVertex(currentVertex, dirTowardLocation)
      if (nextVertex == null) {
        break
      }

      if (0 !== (CompassVector.OppositeDir(dirTowardLocation) & PointComparer.GetDirections(nextVertex.point, pointLocation))) {
        break
      }

      currentVertex = nextVertex
      dir & PointComparer.GetDirections(currentVertex.point, pointLocation)
    }

    // Now find the first vertex that has a chain that intersects pointLocation, if any, moving away
    // from pointLocation until we find it or arrive back at startVertex.
    let perpEdge: VisibilityEdge
    while (true) {
      perpEdge = this.FindPerpendicularOrContainingEdge(currentVertex, dir, pointLocation)
      if (perpEdge != null || currentVertex === startVertex) {
        break
      }

      currentVertex = StaticGraphUtility.FindAdjacentVertex(currentVertex, CompassVector.OppositeDir(dirTowardLocation))
    }

    return perpEdge
  }

  ConnectVertexToTargetVertex(sourceVertex: VisibilityVertex, targetVertex: VisibilityVertex, finalEdgeDir: Direction, weight: number) {
    // finalDir is the required direction of the final edge to the targetIntersect
    // (there will be two edges if we have to add a bend vertex).
    // StaticGraphUtility.Assert(PointComparer.IsPureDirection(finalEdgeDir), "finalEdgeDir is not pure", this.ObstacleTree, this.VisGraph);
    // // targetIntersect may be CenterVertex if that is on an extreme bend or a flat border.
    if (Point.closeDistEps(sourceVertex.point, targetVertex.point)) {
      return
    }

    // If the target is collinear with sourceVertex we can just create one edge to it.
    const targetDirs: Direction = PointComparer.GetDirections(sourceVertex.point, targetVertex.point)
    if (PointComparer.IsPureDirectionD(targetDirs)) {
      this.FindOrAddEdgeVV(sourceVertex, targetVertex)
      return
    }

    // Not collinear so we need to create a bend vertex and edge if they don't yet exist.
    const bendPoint: Point = StaticGraphUtility.FindBendPointBetween(sourceVertex.point, targetVertex.point, finalEdgeDir)
    const bendVertex: VisibilityVertex = this.FindOrAddVertex(bendPoint)
    this.FindOrAddEdge(sourceVertex, bendVertex, weight)
    // Now create the outer target vertex if it doesn't exist.
    this.FindOrAddEdge(bendVertex, targetVertex, weight)
  }

  AddEdgeToTargetEdge(sourceVertex: VisibilityVertex, targetEdge: VisibilityEdge, targetIntersect: Point): VisibilityVertex {
    // StaticGraphUtility.Assert((Point.closeDistEps(sourceVertex.point, targetIntersect) || PointComparer.IsPureDirection(sourceVertex.point, targetIntersect)), "non-orthogonal edge request", this.ObstacleTree, this.VisGraph);
    // StaticGraphUtility.Assert(StaticGraphUtility.PointIsOnSegmentSP(targetEdge.SourcePoint, targetEdge.TargetPoint, targetIntersect), "targetIntersect is not on targetEdge", this.ObstacleTree, this.VisGraph);
    // If the target vertex does not exist, we must split targetEdge to add it.
    let targetVertex: VisibilityVertex = this.VisGraph.FindVertex(targetIntersect)
    if (targetVertex == null) {
      targetVertex = this.AddVertex(targetIntersect)
      this.SplitEdge(targetEdge, targetVertex)
    }

    this.FindOrAddEdgeVV(sourceVertex, targetVertex)
    return targetVertex
  }

  SplitEdge(edge: VisibilityEdge, splitVertex: VisibilityVertex): VisibilityEdge {
    // If the edge is NULL it means we could not find an appropriate one, so do nothing.
    if (edge == null) {
      return null
    }

    // StaticGraphUtility.Assert(StaticGraphUtility.PointIsOnSegmentSP(edge.SourcePoint, edge.TargetPoint, splitVertex.point), "splitVertex is not on edge", this.ObstacleTree, this.VisGraph);
    if (Point.closeDistEps(edge.Source.point, splitVertex.point) || Point.closeDistEps(edge.Target.point, splitVertex.point)) {
      // No split needed.
      return edge
    }

    // Store the original edge, if needed.
    if (!(edge instanceof TollFreeVisibilityEdge)) {
      this.edgesToRestore.push(edge)
    }

    VisibilityGraph.RemoveEdge(edge)
    // If this is an overlapped edge, or we're in sparseVg, then it may be an unpadded->padded edge that crosses
    // over another obstacle's padded boundary, and then either a collinear splice from a free point or another
    // obstacle in the same cluster starts splicing from that leapfrogged boundary, so we have the edges:
    //      A   ->   D                      | D is unpadded, A is padded border of sourceObstacle
    //        B -> C  ->  E  ->  F          | B and C are vertical ScanSegments between A and D
    //      <-- splice direction is West    | F is unpadded, E is padded border of targetObstacle
    // Now after splicing F to E to C to B we go A, calling FindOrAddEdge B->A; the bracketing process finds
    // A->D which we'll be splitting at B, which would wind up with A->B, B->C, B->D, having to Eastward
    // outEdges from B.  See RectilinearTests.Reflection_Block1_Big_UseRect for overlapped, and
    // RectilinearTests.FreePortLocationRelativeToTransientVisibilityEdgesSparseVg for sparseVg.
    // To avoid this we add the edges in each direction from splitVertex with FindOrAddEdge.  If we've
    // come here from a previous call to FindOrAddEdge, then that call has found the bracketing vertices,
    // which are the endpoints of 'edge', and we've removed 'edge', so we will not call SplitEdge again.
    if ((this.IsSparseVg || edge.Weight === ScanSegment.OverlappedWeight) && splitVertex.Degree > 0) {
      this.FindOrAddEdge(splitVertex, edge.Source, edge.Weight)
      return this.FindOrAddEdge(splitVertex, edge.Target, edge.Weight)
    }

    // Splice it into the graph in place of targetEdge.  Return the first half, because
    // this may be called from AddEdge, in which case the split vertex is the target vertex.
    this.CreateEdge(splitVertex, edge.Target, edge.Weight)
    return this.CreateEdge(edge.Source, splitVertex, edge.Weight)
  }

  ExtendEdgeChainVRLPB(
    startVertex: VisibilityVertex,
    limitRect: Rectangle,
    maxVisibilitySegment: LineSegment,
    pacList: PointAndCrossingsList,
    isOverlapped: boolean,
  ) {
    const dir = PointComparer.GetDirections(maxVisibilitySegment.start, maxVisibilitySegment.end)
    if (dir === Direction.None) {
      return
    }

    /*Assert.assert(
      CompassVector.IsPureDirection(dir),
      'impure max visibility segment',
    )*/
    // Shoot the edge chain out to the shorter of max visibility or intersection with the limitrect.
    // StaticGraphUtility.Assert((Point.closeDistEps(maxVisibilitySegment.start, startVertex.point)
    //                || (PointComparer.GetPureDirectionVV(maxVisibilitySegment.start, startVertex.point) === dir)), "Inconsistent direction found", this.ObstacleTree, this.VisGraph);
    const oppositeFarBound: number = StaticGraphUtility.GetRectangleBound(limitRect, dir)
    const maxDesiredSplicePoint: Point = StaticGraphUtility.IsVerticalD(dir)
      ? Point.RoundPoint(new Point(startVertex.point.x, oppositeFarBound))
      : Point.RoundPoint(new Point(oppositeFarBound, startVertex.point.y))
    if (Point.closeDistEps(maxDesiredSplicePoint, startVertex.point)) {
      // Nothing to do.
      return
    }

    if (PointComparer.GetDirections(startVertex.point, maxDesiredSplicePoint) !== dir) {
      // It's in the opposite direction, so no need to do anything.
      return
    }

    // If maxDesiredSplicePoint is shorter, create a new shorter segment.  We have to pass both segments
    // through to the worker function so it knows whether it can go past maxDesiredSegment (which may be limited
    // by limitRect).
    let maxDesiredSegment = maxVisibilitySegment
    if (PointComparer.GetDirections(maxDesiredSplicePoint, maxDesiredSegment.end) === dir) {
      maxDesiredSegment = LineSegment.mkPP(maxDesiredSegment.start, maxDesiredSplicePoint)
    }

    this.ExtendEdgeChain(startVertex, dir, maxDesiredSegment, maxVisibilitySegment, pacList, isOverlapped)
  }

  ExtendEdgeChain(
    startVertex: VisibilityVertex,
    extendDir: Direction,
    maxDesiredSegment: LineSegment,
    maxVisibilitySegment: LineSegment,
    pacList: PointAndCrossingsList,
    isOverlapped: boolean,
  ) {
    // StaticGraphUtility.Assert((PointComparer.GetDirections(maxDesiredSegment.start, maxDesiredSegment.end) === extendDir), "maxDesiredSegment is reversed", this.ObstacleTree, this.VisGraph);
    // Direction*s*, because it may return None, which is valid and means startVertex is on the
    // border of an obstacle and we don't want to go inside it.
    const segmentDir: Direction = PointComparer.GetDirections(startVertex.point, maxDesiredSegment.end)
    if (segmentDir !== extendDir) {
      // OppositeDir may happen on overlaps where the boundary has a gap in its ScanSegments due to other obstacles
      // overlapping it and each other.  This works because the port has an edge connected to startVertex,
      // which is on a ScanSegment outside the obstacle.
      // StaticGraphUtility.Assert((isOverlapped
      //                || (segmentDir !== CompassVector.OppositeDir(extendDir))), "obstacle encountered between prevPoint and startVertex", this.ObstacleTree, this.VisGraph);
      return
    }

    // We'll find the segment to the left (or right if to the left doesn't exist),
    // then splice across in the opposite direction.
    let spliceSourceDir: Direction = CompassVector.RotateLeft(extendDir)
    let spliceSource: VisibilityVertex = StaticGraphUtility.FindAdjacentVertex(startVertex, spliceSourceDir)
    if (spliceSource == null) {
      spliceSourceDir = CompassVector.OppositeDir(spliceSourceDir)
      spliceSource = StaticGraphUtility.FindAdjacentVertex(startVertex, spliceSourceDir)
      if (spliceSource == null) {
        return
      }
    }

    // Store this off before ExtendSpliceWorker, which overwrites it.
    const spliceTargetDir: Direction = CompassVector.OppositeDir(spliceSourceDir)
    const t = {spliceTarget: <VisibilityVertex>null}
    if (this.ExtendSpliceWorker(spliceSource, extendDir, spliceTargetDir, maxDesiredSegment, maxVisibilitySegment, isOverlapped, t)) {
      // We ended on the source side and may have dead-ends on the target side so reverse sides.
      this.ExtendSpliceWorker(t.spliceTarget, extendDir, spliceSourceDir, maxDesiredSegment, maxVisibilitySegment, isOverlapped, t)
    }

    this.SpliceGroupBoundaryCrossings(pacList, startVertex, maxDesiredSegment)
  }

  private SpliceGroupBoundaryCrossings(crossingList: PointAndCrossingsList, startVertex: VisibilityVertex, maxSegment: LineSegment) {
    if (crossingList == null || 0 === crossingList.Count()) {
      return
    }

    crossingList.Reset()
    let start = maxSegment.start
    let end = maxSegment.end
    let dir = PointComparer.GetDirections(start, end)
    // Make sure we are going in the ascending direction.
    if (!StaticGraphUtility.IsAscending(dir)) {
      start = maxSegment.end
      end = maxSegment.start
      dir = CompassVector.OppositeDir(dir)
    }

    // We need to back up to handle group crossings that are between a VisibilityBorderIntersect on a sloped border and the
    // incoming startVertex (which is on the first ScanSegment in Perpendicular(dir) that is outside that padded border).
    startVertex = TransientGraphUtility.TraverseToFirstVertexAtOrAbove(startVertex, start, CompassVector.OppositeDir(dir))
    // Splice into the Vertices between and including the start/end points.
    for (
      let currentVertex = startVertex;
      currentVertex != null;
      currentVertex = StaticGraphUtility.FindAdjacentVertex(currentVertex, dir)
    ) {
      const isFinalVertex: boolean = PointComparer.ComparePP(currentVertex.point, end) >= 0
      while (crossingList.CurrentIsBeforeOrAt(currentVertex.point)) {
        const pac: PointAndCrossings = crossingList.Pop()
        // If it's past the start and at or before the end, splice in the crossings in the descending direction.
        if (PointComparer.ComparePP(pac.Location, startVertex.point) > 0) {
          if (PointComparer.ComparePP(pac.Location, end) <= 0) {
            this.SpliceGroupBoundaryCrossing(currentVertex, pac, CompassVector.OppositeDir(dir))
          }
        }

        // If it's at or past the start and before the end, splice in the crossings in the descending direction.
        if (PointComparer.ComparePP(pac.Location, startVertex.point) >= 0) {
          if (PointComparer.ComparePP(pac.Location, end) < 0) {
            this.SpliceGroupBoundaryCrossing(currentVertex, pac, dir)
          }
        }
      }

      if (isFinalVertex) {
        break
      }
    }
  }

  private static TraverseToFirstVertexAtOrAbove(startVertex: VisibilityVertex, start: Point, dir: Direction): VisibilityVertex {
    let returnVertex = startVertex
    const oppositeDir = CompassVector.OppositeDir(dir)
    for (;;) {
      const nextVertex = StaticGraphUtility.FindAdjacentVertex(returnVertex, dir)
      // This returns Directions. None on a match.
      if (nextVertex == null || PointComparer.GetDirections(nextVertex.point, start) === oppositeDir) {
        break
      }

      returnVertex = nextVertex
    }

    return returnVertex
  }

  private SpliceGroupBoundaryCrossing(currentVertex: VisibilityVertex, pac: PointAndCrossings, dirToInside: Direction) {
    const crossings: GroupBoundaryCrossing[] = PointAndCrossingsList.ToCrossingArray(pac.Crossings, dirToInside)

    if (crossings != null) {
      const outerVertex = this.VisGraph.FindVertex(pac.Location) ?? this.AddVertex(pac.Location)

      if (!currentVertex.point.equal(outerVertex.point)) {
        this.FindOrAddEdgeVV(currentVertex, outerVertex)
      }

      const interiorPoint = crossings[0].GetInteriorVertexPoint(pac.Location)
      const interiorVertex = this.VisGraph.FindVertex(interiorPoint) ?? this.AddVertex(interiorPoint)

      // FindOrAddEdge splits an existing edge so may not return the portion bracketed by outerVertex and interiorVertex.
      const edge = this.FindOrAddEdgeVV(outerVertex, interiorVertex)
      //const edge = this.VisGraph.FindEdgePP(outerVertex.point, interiorVertex.point)
      const crossingsArray = crossings.map((c) => c.Group.InputShape)
      edge.IsPassable = () => crossingsArray.some((s) => s.IsTransparent)
    }
  }

  // The return value is whether we should try a second pass if this is called on the first pass,
  // using spliceTarget to wrap up dead-ends on the target side.
  ExtendSpliceWorker(
    spliceSourcePar: VisibilityVertex,
    extendDir: Direction,
    spliceTargetDir: Direction,
    maxDesiredSegment: LineSegment,
    maxVisibilitySegment: LineSegment,
    isOverlapped: boolean,
    t: {spliceTarget: VisibilityVertex},
  ): boolean {
    // This is called after having created at least one extension vertex (initially, the
    // first one added outside the obstacle), so we know extendVertex
    // will be there. spliceSource  is the vertex to the OppositeDir(spliceTargetDir) of that extendVertex.
    let extendVertex: VisibilityVertex = StaticGraphUtility.FindAdjacentVertex(spliceSourcePar, spliceTargetDir)
    t.spliceTarget = StaticGraphUtility.FindAdjacentVertex(extendVertex, spliceTargetDir)
    const st = {spliceSource: spliceSourcePar}
    for (;;) {
      if (!TransientGraphUtility.GetNextSpliceSource(st, spliceTargetDir, extendDir)) {
        break
      }

      // spliceSource is now on the correct edge relative to the desired nextExtendPoint.
      // spliceTarget is in the opposite direction of the extension-line-to-spliceSource.
      const nextExtendPoint: Point = StaticGraphUtility.FindBendPointBetween(
        extendVertex.point,
        st.spliceSource.point,
        CompassVector.OppositeDir(spliceTargetDir),
      )
      // We test below for being on or past maxDesiredSegment; here we may be skipping
      // over maxDesiredSegmentEnd which is valid since we want to be sure to go to or
      // past limitRect, but be sure to stay within maxVisibilitySegment.
      if (TransientGraphUtility.IsPointPastSegmentEnd(maxVisibilitySegment, nextExtendPoint)) {
        break
      }

      t.spliceTarget = TransientGraphUtility.GetSpliceTarget(st, spliceTargetDir, nextExtendPoint)
      // StaticGraphUtility.Test_DumpVisibilityGraph(ObstacleTree, VisGraph);
      if (t.spliceTarget == null) {
        // This may be because spliceSource was created just for Group boundaries.  If so,
        // skip to the next nextExtendVertex location.
        if (this.IsSkippableSpliceSourceWithNullSpliceTarget(st.spliceSource, extendDir)) {
          continue
        }

        // We're at a dead-end extending from the source side, or there is an intervening obstacle, or both.
        // Don't splice across lateral group boundaries.
        if (this.ObstacleTree.SegmentCrossesAnObstacle(st.spliceSource.point, nextExtendPoint)) {
          return false
        }
      }

      // We might be walking through a point where a previous chain dead-ended.
      let nextExtendVertex: VisibilityVertex = this.VisGraph.FindVertex(nextExtendPoint)
      if (nextExtendVertex != null) {
        if (t.spliceTarget == null || this.VisGraph.FindEdgePP(extendVertex.point, nextExtendPoint) != null) {
          // We are probably along a ScanSegment so visibility in this direction has already been determined.
          // Stop and don't try to continue extension from the opposite side.  If we continue splicing here
          // it might go across an obstacle.
          if (t.spliceTarget == null) {
            this.FindOrAddEdge(extendVertex, nextExtendVertex, isOverlapped ? ScanSegment.OverlappedWeight : ScanSegment.NormalWeight)
          }

          return false
        }

        // This should always have been found in the find-the-next-target loop above if there is
        // a vertex (which would be nextExtendVertex, which we just found) between spliceSource
        // and spliceTarget.  Even for a sparse graph, an edge should not skip over a vertex.
        // StaticGraphUtility.Assert((spliceTarget === StaticGraphUtility.FindAdjacentVertex(nextExtendVertex, spliceTargetDir)), "no edge exists between an existing nextExtendVertex and spliceTarget", this.ObstacleTree, this.VisGraph);
      } else {
        // StaticGraphUtility.Assert(((spliceTarget == null )
        //                || (spliceTargetDir === PointComparer.GetPureDirectionVV(nextExtendPoint, spliceTarget.point))), "spliceTarget is not to spliceTargetDir of nextExtendVertex", this.ObstacleTree, this.VisGraph);
        nextExtendVertex = this.AddVertex(nextExtendPoint)
      }

      this.FindOrAddEdge(extendVertex, nextExtendVertex, isOverlapped ? ScanSegment.OverlappedWeight : ScanSegment.NormalWeight)
      // This will split the edge if targetVertex is non-null; otherwise we are at a dead-end
      // on the target side so must not create a vertex as it would be inside an obstacle.
      this.FindOrAddEdge(st.spliceSource, nextExtendVertex, isOverlapped ? ScanSegment.OverlappedWeight : ScanSegment.NormalWeight)

      if (isOverlapped) {
        isOverlapped = this.SeeIfSpliceIsStillOverlapped(extendDir, nextExtendVertex)
      }

      extendVertex = nextExtendVertex
      // Test GetDirections because it may return Directions. None.
      if (0 === (extendDir & PointComparer.GetDirections(nextExtendPoint, maxDesiredSegment.end))) {
        // At or past the desired max extension point, so we're done.
        t.spliceTarget = null
        break
      }
    }

    return t.spliceTarget != null
  }

  private static GetNextSpliceSource(t: {spliceSource: VisibilityVertex}, spliceTargetDir: Direction, extendDir: Direction): boolean {
    let nextSpliceSource: VisibilityVertex = StaticGraphUtility.FindAdjacentVertex(t.spliceSource, extendDir)
    if (nextSpliceSource == null) {
      // See if there is a source further away from the extension line - we might have
      // been on freePoint line (or another nearby PortEntry line) that dead-ended.
      // Look laterally from the previous spliceSource first.
      nextSpliceSource = t.spliceSource
      for (;;) {
        nextSpliceSource = StaticGraphUtility.FindAdjacentVertex(nextSpliceSource, CompassVector.OppositeDir(spliceTargetDir))
        if (nextSpliceSource == null) {
          return false
        }

        const nextSpliceSourceExtend = StaticGraphUtility.FindAdjacentVertex(nextSpliceSource, extendDir)
        if (nextSpliceSourceExtend != null) {
          nextSpliceSource = nextSpliceSourceExtend
          break
        }
      }
    }

    t.spliceSource = nextSpliceSource
    return true
  }

  private static GetSpliceTarget(
    t: {spliceSource: VisibilityVertex},
    spliceTargetDir: Direction,
    nextExtendPoint: Point,
  ): VisibilityVertex {
    // Look for the target.  There may be a dead-ended edge starting at the current spliceSource
    // edge that has a vertex closer to the extension line; in that case keep walking until we
    // have the closest vertex on the Source side of the extension line as spliceSource.
    const prevDir: Direction = PointComparer.GetDirections(t.spliceSource.point, nextExtendPoint)
    let nextDir: Direction = prevDir
    let spliceTarget = t.spliceSource
    while (nextDir === prevDir) {
      t.spliceSource = spliceTarget
      spliceTarget = StaticGraphUtility.FindAdjacentVertex(t.spliceSource, spliceTargetDir)
      if (spliceTarget == null) {
        break
      }

      if (Point.closeDistEps(spliceTarget.point, nextExtendPoint)) {
        // If we encountered an existing vertex for the extension chain, update spliceTarget
        // to be after it and we're done with this loop.
        spliceTarget = StaticGraphUtility.FindAdjacentVertex(spliceTarget, spliceTargetDir)
        break
      }

      nextDir = PointComparer.GetDirections(spliceTarget.point, nextExtendPoint)
    }

    return spliceTarget
  }

  private SeeIfSpliceIsStillOverlapped(extendDir: Direction, nextExtendVertex: VisibilityVertex): boolean {
    // If we've spliced out of overlapped space into free space, we may be able to turn off the
    // overlapped state if we have a perpendicular non-overlapped edge.
    let edge = this.FindNextEdge(nextExtendVertex, CompassVector.RotateLeft(extendDir))
    let maybeFreeSpace = edge == null ? false : ScanSegment.NormalWeight === edge.Weight
    if (!maybeFreeSpace) {
      edge = this.FindNextEdge(nextExtendVertex, CompassVector.RotateRight(extendDir))
      maybeFreeSpace = edge == null ? false : ScanSegment.NormalWeight === edge.Weight
    }

    return !maybeFreeSpace || this.ObstacleTree.PointIsInsideAnObstaclePD(nextExtendVertex.point, extendDir)
  }

  IsSkippableSpliceSourceWithNullSpliceTarget(spliceSource: VisibilityVertex, extendDir: Direction): boolean {
    if (TransientGraphUtility.IsSkippableSpliceSourceEdgeWithNullTarget(StaticGraphUtility.FindAdjacentEdge(spliceSource, extendDir))) {
      return true
    }

    const spliceSourceEdge = StaticGraphUtility.FindAdjacentEdge(spliceSource, CompassVector.OppositeDir(extendDir))
    // Since target is null, if this is a reflection, it is bouncing off an outer side of a group or
    // obstacle at spliceSource.  In that case, we don't want to splice from it because then we could
    // cut through the group and outside again; instead we should just stay outside it.
    return (
      TransientGraphUtility.IsSkippableSpliceSourceEdgeWithNullTarget(spliceSourceEdge) ||
      TransientGraphUtility.IsReflectionEdge(spliceSourceEdge)
    )
  }

  static IsSkippableSpliceSourceEdgeWithNullTarget(spliceSourceEdge: VisibilityEdge): boolean {
    return (
      spliceSourceEdge != null &&
      spliceSourceEdge.IsPassable != null &&
      closeDistEps(spliceSourceEdge.Length, GroupBoundaryCrossing.BoundaryWidth)
    )
  }

  static IsReflectionEdge(edge: VisibilityEdge): boolean {
    return edge != null && edge.Weight === ScanSegment.ReflectionWeight
  }

  static IsPointPastSegmentEnd(maxSegment: LineSegment, point: Point): boolean {
    return PointComparer.GetDirections(maxSegment.start, maxSegment.end) === PointComparer.GetDirections(maxSegment.end, point)
  }

  toString(): string {
    return String.Format('{0} {1}', this.AddedVertices.length, this.edgesToRestore.length)
  }
}
