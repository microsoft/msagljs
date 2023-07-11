//
// PortManager.cs
// MSAGL class for Port management for Rectilinear Edge Routing.
//

// This stores information mapping the App-level Ports (e.g. FloatingPort, RelativeFloatingPort,
// and MultiLocationFloatingPort) to the router's BasicScanPort subclasses (ObstaclePort and FreePoint).
import {uniteSets, substractSets} from '../../utils/setOperations'

import {Point, Rectangle, ICurve} from '../../math/geometry'
import {Port} from '../../layout/core/port'
import {CompassVector} from '../../math/geometry/compassVector'
import {PointLocation, Curve} from '../../math/geometry/curve'
import {Direction} from '../../math/geometry/direction'
import {LineSegment} from '../../math/geometry/lineSegment'
import {InteractiveObstacleCalculator} from '../interactiveObstacleCalculator'
import {Shape} from '../shape'
import {VisibilityEdge} from '../visibility/VisibilityEdge'
import {VisibilityGraph} from '../visibility/VisibilityGraph'
import {VisibilityVertex} from '../visibility/VisibilityVertex'
import {Obstacle} from './obstacle'
import {ObstaclePort} from './ObstaclePort'
import {ObstacleTree} from './ObstacleTree'
import {PointComparer} from './PointComparer'
import {ScanDirection} from './ScanDirection'
import {ScanSegment} from './ScanSegment'
import {ScanSegmentTree} from './ScanSegmentTree'
import {StaticGraphUtility} from './StaticGraphUtility'
import {VisibilityGraphGenerator} from './VisibilityGraphGenerator'
import {FreePoint} from './FreePoint'
import {GeomConstants} from '../../math/geometry/geomConstants'

import {TransientGraphUtility} from './TransientGraphUtility'
import {ObstaclePortEntrance} from './ObstaclePortEntrance'
import {PointMap} from '../../utils/PointMap'
import {PointSet} from '../../utils/PointSet'
import {GeomEdge} from '../..'

export class PortManager {
  // The mapping of Msagl.Port (which may be MultiLocation) to the underlying Obstacle.Shape.
  private obstaclePortMap: Map<Port, ObstaclePort> = new Map<Port, ObstaclePort>()

  // The mapping of Msagl.Port.Location or a Waypoint to a FreePoint with visibility info.
  private freePointMap: PointMap<FreePoint> = new PointMap<FreePoint>()

  // This tracks which locations were used by the last call to RouteEdges, so we can remove unused locations.
  private freePointLocationsUsedByRouteEdges: PointSet = new PointSet()

  // Created to wrap the graph for adding transient vertices/edges to the graph.
  TransUtil: TransientGraphUtility

  // Owned by RectilinearEdgeRouter.
  private graphGenerator: VisibilityGraphGenerator

  // Storage and implementation of RectilinearEdgeRouter property of the same name.
  RouteToCenterOfObstacles = false
  // Extension of port visibility splices into the visibility graph.
  get LimitPortVisibilitySpliceToEndpointBoundingBox(): boolean {
    return this.TransUtil.LimitPortVisibilitySpliceToEndpointBoundingBox
  }
  set LimitPortVisibilitySpliceToEndpointBoundingBox(value: boolean) {
    this.TransUtil.LimitPortVisibilitySpliceToEndpointBoundingBox = value
  }

  // A control point is a source, target, or waypoint (terminology only, there's no ControlPoint
  // class).  These lists are the control points we've added for the current path.
  private obstaclePortsInGraph: Array<ObstaclePort> = new Array<ObstaclePort>()

  private freePointsInGraph: Set<FreePoint> = new Set<FreePoint>()

  // The limit for edge-chain extension.
  private portSpliceLimitRectangle: Rectangle

  // The current set of Obstacles that are groups whose boundaries are crossable.
  private activeAncestors: Array<Obstacle> = new Array<Obstacle>()

  // Typing shortcuts
  private get VisGraph(): VisibilityGraph {
    return this.graphGenerator.VisibilityGraph
  }

  private get HScanSegments(): ScanSegmentTree {
    return this.graphGenerator.HorizontalScanSegments
  }

  private get VScanSegments(): ScanSegmentTree {
    return this.graphGenerator.VerticalScanSegments
  }

  private get ObstacleTree(): ObstacleTree {
    return this.graphGenerator.ObstacleTree
  }

  private get AncestorSets(): Map<Shape, Set<Shape>> {
    return this.ObstacleTree.AncestorSets
  }

  constructor(graphGenerator: VisibilityGraphGenerator) {
    this.TransUtil = new TransientGraphUtility(graphGenerator)
    this.graphGenerator = graphGenerator
  }

  Clear() {
    this.TransUtil.RemoveFromGraph()
    // Probably nothing in here when this is called
    this.obstaclePortMap.clear()
  }

  CreateObstaclePorts(obstacle: Obstacle) {
    // Create ObstaclePorts for all Ports of this obstacle.  This just creates the
    // ObstaclePort object; we don't add its edges/vertices to the graph until we
    // do the actual routing.
    for (const port of obstacle.Ports) {
      this.CreateObstaclePort(obstacle, port)
    }
  }

  private CreateObstaclePort(obstacle: Obstacle, port: Port): ObstaclePort {
    // This will replace any previous specification for the port (last one wins).
    /*Assert.assert(
      !this.obstaclePortMap.has(port),
      'Port is used by more than one obstacle',
    )*/
    if (port.Curve == null) {
      return null
    }

    const roundedLocation = Point.RoundPoint(port.Location)
    if (PointLocation.Outside === Curve.PointRelativeToCurveLocation(roundedLocation, obstacle.InputShape.BoundaryCurve)) {
      // Obstacle.Port is outside Obstacle.Shape; handle it as a FreePoint.
      return null
    }

    if (
      obstacle.InputShape.BoundaryCurve !== port.Curve &&
      PointLocation.Outside === Curve.PointRelativeToCurveLocation(roundedLocation, port.Curve)
    ) {
      // Obstacle.Port is outside port.Curve; handle it as a FreePoint.
      return null
    }

    const oport = new ObstaclePort(port, obstacle)
    this.obstaclePortMap.set(port, oport)
    return oport
  }

  FindVertices(port: Port): Array<VisibilityVertex> {
    const vertices = new Array<VisibilityVertex>()
    const oport: ObstaclePort = this.obstaclePortMap.get(port)
    if (oport) {
      if (this.RouteToCenterOfObstacles) {
        vertices.push(oport.CenterVertex)
      } else {
        // Add all vertices on the obstacle borders.  Avoid LINQ for performance.
        for (const entrance of oport.PortEntrances) {
          const vertex: VisibilityVertex = this.VisGraph.FindVertex(entrance.UnpaddedBorderIntersect)
          if (vertex != null) {
            vertices.push(vertex)
          }
        }
      }
    } else {
      vertices.push(this.VisGraph.FindVertex(Point.RoundPoint(port.Location)))
    }
    return vertices
  }

  RemoveObstaclePorts(obstacle: Obstacle) {
    for (const port of obstacle.Ports) {
      // Since we remove the port from the visibility graph after each routing, all we
      // have to do here is remove it from the dictionary.
      this.RemoveObstaclePort(port)
    }
  }

  RemoveObstaclePort(port: Port) {
    this.obstaclePortMap.delete(port)
  }

  // Add path control points - source, target, and any waypoints.
  AddControlPointsToGraph(edge: GeomEdge, shapeToObstacleMap: Map<Shape, Obstacle>) {
    this.GetPortSpliceLimitRectangle(edge)
    this.activeAncestors = []
    const s: {oport: ObstaclePort} = {oport: null}
    const t: {oport: ObstaclePort} = {oport: null}
    const ssAncs = this.FindAncestorsAndObstaclePort(edge.sourcePort, s)
    const ttAncs = this.FindAncestorsAndObstaclePort(edge.targetPort, t)
    if (this.AncestorSets.size > 0 && s.oport != null && t.oport != null) {
      // Make non-common ancestors' boundaries transparent (we don't want to route outside common ancestors).
      const ttAncsOnly = substractSets(ttAncs, ssAncs)
      const ssAncsOnly = substractSets(ssAncs, ttAncs)
      this.ActivateAncestors(ssAncsOnly, ttAncsOnly, shapeToObstacleMap)
    }

    // Now that we've set any active ancestors, splice in the port visibility.
    this.AddPortToGraph(edge.sourcePort, s.oport)
    this.AddPortToGraph(edge.targetPort, t.oport)
  }

  ConnectOobWaypointToEndpointVisibilityAtGraphBoundary(oobWaypoint: FreePoint, port: Port) {
    if (oobWaypoint == null || !oobWaypoint.IsOutOfBounds) {
      return
    }

    // Connect to the graphbox side at points collinear with the vertices.  The waypoint may be
    // OOB in two directions so call once for each axis.
    const endpointVertices = this.FindVertices(port)
    let dirFromGraph = oobWaypoint.OutOfBoundsDirectionFromGraph & (Direction.North | Direction.South)
    this.ConnectToGraphAtPointsCollinearWithVertices(oobWaypoint, dirFromGraph, endpointVertices)
    dirFromGraph = oobWaypoint.OutOfBoundsDirectionFromGraph & (Direction.East | Direction.West)
    this.ConnectToGraphAtPointsCollinearWithVertices(oobWaypoint, dirFromGraph, endpointVertices)
  }

  private ConnectToGraphAtPointsCollinearWithVertices(
    oobWaypoint: FreePoint,
    dirFromGraph: Direction,
    endpointVertices: Array<VisibilityVertex>,
  ) {
    if (Direction.None === dirFromGraph) {
      // Not out of bounds on this axis.
      return
    }

    const dirToGraph = CompassVector.OppositeDir(dirFromGraph)
    for (const vertex of endpointVertices) {
      const graphBorderLocation = this.InBoundsGraphBoxIntersect(vertex.point, dirFromGraph)
      const graphBorderVertex = this.VisGraph.FindVertex(graphBorderLocation)
      if (graphBorderVertex != null) {
        this.TransUtil.ConnectVertexToTargetVertex(oobWaypoint.Vertex, graphBorderVertex, dirToGraph, ScanSegment.NormalWeight)
      }
    }
  }

  SetAllAncestorsActive(edgeGeom: GeomEdge, shapeToObstacleMap: Map<Shape, Obstacle>): boolean {
    if (0 === this.AncestorSets.size) {
      return false
    }

    this.ObstacleTree.AdjustSpatialAncestors()
    this.ClearActiveAncestors()
    const t: {oport: ObstaclePort} = {oport: null}
    const s: {oport: ObstaclePort} = {oport: null}
    const ssAncs = this.FindAncestorsAndObstaclePort(edgeGeom.sourcePort, s)
    const ttAncs = this.FindAncestorsAndObstaclePort(edgeGeom.targetPort, t)
    if (this.AncestorSets.size > 0 && ssAncs != null && ttAncs != null) {
      // Make all ancestors boundaries transparent; in this case we've already tried with only
      // non-common and found no path, so perhaps an obstacle is outside its parent group's bounds.
      this.ActivateAncestors(ssAncs, ttAncs, shapeToObstacleMap)
      return true
    }

    return false
  }

  SetAllGroupsActive() {
    // We couldn't get a path when we activated all hierarchical and spatial group ancestors of the shapes,
    // so assume we may be landlocked and activate all groups, period.
    this.ClearActiveAncestors()
    for (const group of this.ObstacleTree.GetAllGroups()) {
      group.IsTransparentAncestor = true
      this.activeAncestors.push(group)
    }
  }

  FindAncestorsAndObstaclePort(port: Port, t: {oport: ObstaclePort}): Set<Shape> {
    t.oport = this.FindObstaclePort(port)
    if (0 === this.AncestorSets.size) {
      return null
    }

    if (t.oport != null) {
      return this.AncestorSets.get(t.oport.Obstacle.InputShape)
    }

    // This is a free Port (not associated with an obstacle) or a Waypoint; return all spatial parents.
    return new Set<Shape>(
      Array.from(this.ObstacleTree.Root.AllHitItems(Rectangle.mkPP(port.Location, port.Location), (shape) => shape.IsGroup)).map(
        (obs) => obs.InputShape,
      ),
    )
  }

  private ActivateAncestors(ssAncsToUse: Set<Shape>, ttAncsToUse: Set<Shape>, shapeToObstacleMap: Map<Shape, Obstacle>) {
    for (const shape of uniteSets(ssAncsToUse, ttAncsToUse)) {
      const group = shapeToObstacleMap.get(shape)
      /*Assert.assert(group.IsGroup, 'Ancestor shape is not a group')*/
      group.IsTransparentAncestor = true
      this.activeAncestors.push(group)
    }
  }

  ClearActiveAncestors() {
    for (const group of this.activeAncestors) {
      group.IsTransparentAncestor = false
    }

    this.activeAncestors = []
  }

  RemoveControlPointsFromGraph() {
    this.ClearActiveAncestors()
    this.RemoveObstaclePortsFromGraph()
    this.RemoveFreePointsFromGraph()
    this.TransUtil.RemoveFromGraph()
    this.portSpliceLimitRectangle = Rectangle.mkEmpty()
  }

  private RemoveObstaclePortsFromGraph() {
    for (const oport of this.obstaclePortsInGraph) {
      oport.RemoveFromGraph()
    }

    this.obstaclePortsInGraph = []
  }

  private RemoveFreePointsFromGraph() {
    for (const freePoint of this.freePointsInGraph) {
      freePoint.RemoveFromGraph()
    }

    this.freePointsInGraph.clear()
  }

  private RemoveStaleFreePoints() {
    // FreePoints are not necessarily persistent - they may for example be waypoints which are removed.
    // So after every routing pass, remove any that were not added to the graph. Because the FreePoint has
    // be removed from the graph, its Vertex (and thus Point) are no longer set in the FreePoint, so we
    // must use the key from the dictionary.
    if (this.freePointMap.size > this.freePointLocationsUsedByRouteEdges.size) {
      const staleFreePairs = Array.from(this.freePointMap).filter((p) => !this.freePointLocationsUsedByRouteEdges.has(p[0]))
      for (const staleFreePair of staleFreePairs) {
        this.freePointMap.deleteP(staleFreePair[0])
      }
    }
  }

  ClearVisibility() {
    // Most of the retained freepoint stuff is about precalculated visibility.
    this.freePointMap.clear()
    for (const oport of this.obstaclePortMap.values()) {
      oport.ClearVisibility()
    }
  }

  BeginRouteEdges() {
    this.RemoveControlPointsFromGraph()
    // ensure there are no leftovers
    this.freePointLocationsUsedByRouteEdges.clear()
  }

  EndRouteEdges() {
    this.RemoveStaleFreePoints()
  }

  FindObstaclePort(port: Port): ObstaclePort {
    let oport: ObstaclePort = this.obstaclePortMap.get(port)
    if (oport) {
      // First see if the obstacle's port list has changed without UpdateObstacles() being called.
      // Unfortunately we don't have a way to update the obstacle's ports until we enter
      // this block; there is no direct Port->Shape/Obstacle mapping.  So UpdateObstacle must still
      // be called, but at least this check here will remove obsolete ObstaclePorts.
      const t: {removedPorts: Set<Port>; addedPorts: Set<Port>} = {
        removedPorts: null,
        addedPorts: null,
      }
      if (oport.Obstacle.GetPortChanges(t)) {
        for (const newPort of t.addedPorts) {
          this.CreateObstaclePort(oport.Obstacle, newPort)
        }

        for (const oldPort of t.removedPorts) {
          this.RemoveObstaclePort(oldPort)
        }

        // If it's not still there, it was moved outside the obstacle so we'll just add it as a FreePoint.
        oport = this.obstaclePortMap.get(port)
      }
    }

    return oport
  }

  private AddPortToGraph(port: Port, oport: ObstaclePort) {
    if (oport != null) {
      this.AddObstaclePortToGraph(oport)
      return
    }

    // This is a FreePoint, either a Waypoint or a Port not in an Obstacle.Ports list.
    this.AddFreePointToGraph(port.Location)
  }

  private AddObstaclePortToGraph(oport: ObstaclePort) {
    // If the port's position has changed without UpdateObstacles() being called, recreate it.
    if (oport.LocationHasChanged) {
      this.RemoveObstaclePort(oport.Port)
      oport = this.CreateObstaclePort(oport.Obstacle, oport.Port)
      if (oport == null) {
        // Port has been moved outside obstacle; return and let caller add it as a FreePoint.
        return
      }
    }

    oport.AddToGraph(this.TransUtil, this.RouteToCenterOfObstacles)
    this.obstaclePortsInGraph.push(oport)
    this.CreateObstaclePortEntrancesIfNeeded(oport)
    // We've determined the entrypoints on the obstacle boundary for each PortEntry,
    // so now add them to the VisGraph.
    for (const entrance of oport.PortEntrances) {
      this.AddObstaclePortEntranceToGraph(entrance)
    }

    return
  }

  private CreateObstaclePortEntrancesIfNeeded(oport: ObstaclePort) {
    if (oport.PortEntrances.length > 0) {
      return
    }

    // Create the PortEntrances with initial information:  border intersect and outer edge direction.
    this.CreateObstaclePortEntrancesFromPoints(oport)
  }

  public GetPortVisibilityIntersection(edgeGeometry: GeomEdge): Point[] {
    const sourceOport = this.FindObstaclePort(edgeGeometry.sourcePort)
    const targetOport = this.FindObstaclePort(edgeGeometry.targetPort)
    if (sourceOport == null || targetOport == null) {
      return null
    }

    if (sourceOport.Obstacle.IsInConvexHull || targetOport.Obstacle.IsInConvexHull) {
      return null
    }

    this.CreateObstaclePortEntrancesIfNeeded(sourceOport)
    this.CreateObstaclePortEntrancesIfNeeded(targetOport)
    if (!sourceOport.VisibilityRectangle.intersects(targetOport.VisibilityRectangle)) {
      return null
    }

    for (const sourceEntrance of sourceOport.PortEntrances) {
      if (!sourceEntrance.WantVisibilityIntersection) {
        continue
      }

      for (const targetEntrance of targetOport.PortEntrances) {
        if (!targetEntrance.WantVisibilityIntersection) {
          continue
        }

        const points =
          sourceEntrance.IsVertical === targetEntrance.IsVertical
            ? PortManager.GetPathPointsFromOverlappingCollinearVisibility(sourceEntrance, targetEntrance)
            : PortManager.GetPathPointsFromIntersectingVisibility(sourceEntrance, targetEntrance)

        if (points != null) {
          return points
        }
      }
    }

    return null
  }

  private static GetPathPointsFromOverlappingCollinearVisibility(
    sourceEntrance: ObstaclePortEntrance,
    targetEntrance: ObstaclePortEntrance,
  ): Point[] {
    // If the segments are the same they'll be in reverse.  Note: check for IntervalsOverlap also, if we support FreePoints here.
    if (
      !StaticGraphUtility.IntervalsAreSame(
        sourceEntrance.MaxVisibilitySegment.start,
        sourceEntrance.MaxVisibilitySegment.end,
        targetEntrance.MaxVisibilitySegment.end,
        targetEntrance.MaxVisibilitySegment.start,
      )
    ) {
      return null
    }

    if (sourceEntrance.HasGroupCrossings || targetEntrance.HasGroupCrossings) {
      return null
    }

    if (Point.closeDistEps(sourceEntrance.UnpaddedBorderIntersect, targetEntrance.UnpaddedBorderIntersect)) {
      // Probably one obstacle contained within another; we handle that elsewhere.
      return null
    }

    return [sourceEntrance.UnpaddedBorderIntersect, targetEntrance.UnpaddedBorderIntersect]
  }

  private static GetPathPointsFromIntersectingVisibility(
    sourceEntrance: ObstaclePortEntrance,
    targetEntrance: ObstaclePortEntrance,
  ): Point[] {
    const intersect: Point = StaticGraphUtility.SegmentsIntersectLL(
      sourceEntrance.MaxVisibilitySegment,
      targetEntrance.MaxVisibilitySegment,
    )
    if (!intersect) {
      return null
    }

    if (sourceEntrance.HasGroupCrossingBeforePoint(intersect) || targetEntrance.HasGroupCrossingBeforePoint(intersect)) {
      return null
    }

    return [sourceEntrance.UnpaddedBorderIntersect, intersect, targetEntrance.UnpaddedBorderIntersect]
  }

  private CreateObstaclePortEntrancesFromPoints(oport: ObstaclePort) {
    const graphBox = this.graphGenerator.ObstacleTree.GraphBox
    const curveBox = Rectangle.mkPP(
      Point.RoundPoint(oport.PortCurve.boundingBox.leftBottom),
      Point.RoundPoint(oport.PortCurve.boundingBox.rightTop),
    )
    // This Port does not have a PortEntry, so we'll have visibility edges to its location
    // in the Horizontal and Vertical directions (possibly all 4 directions, if not on boundary).
    //
    // First calculate the intersection with the obstacle in all directions.  Do nothing in the
    // horizontal direction for port locations that are on the unpadded vertical extremes, because
    // this will have a path that moves alongside a rectilinear obstacle side in less than the
    // padding radius and will thus create the PaddedBorderIntersection on the side rather than top
    // (and vice-versa for the vertical direction).  We'll have an edge in the vertical direction
    // to the padded extreme boundary ScanSegment, and the Nudger will modify paths as appropriate
    // to remove unnecessary bends.
    // Use the unrounded port location to intersect with its curve.
    const location: Point = Point.RoundPoint(oport.PortLocation)
    let found = false
    const t: {xx0: Point; xx1: Point} = {xx0: null, xx1: null}

    if (!PointComparer.Equal(location.y, curveBox.top) && !PointComparer.Equal(location.y, curveBox.bottom)) {
      found = true
      const hSeg = new LineSegment(graphBox.left, location.y, graphBox.right, location.y)
      this.GetBorderIntersections(location, hSeg, oport.PortCurve, t)
      let wBorderIntersect = new Point(Math.min(t.xx0.x, t.xx1.x), location.y)
      if (wBorderIntersect.x < curveBox.left) {
        // Handle rounding error
        wBorderIntersect = new Point(curveBox.left, wBorderIntersect.y)
      }

      let eBorderIntersect = new Point(Math.max(t.xx0.x, t.xx1.x), location.y)
      if (eBorderIntersect.x > curveBox.right) {
        eBorderIntersect = new Point(curveBox.right, eBorderIntersect.y)
      }

      this.CreatePortEntrancesAtBorderIntersections(curveBox, oport, location, wBorderIntersect, eBorderIntersect)
    }

    // endif horizontal pass is not at vertical extreme
    if (!PointComparer.Equal(location.x, curveBox.left) && !PointComparer.Equal(location.x, curveBox.right)) {
      found = true
      const vSeg = new LineSegment(location.x, graphBox.bottom, location.x, graphBox.top)
      this.GetBorderIntersections(location, vSeg, oport.PortCurve, t)
      let sBorderIntersect = new Point(location.x, Math.min(t.xx0.y, t.xx1.y))
      if (sBorderIntersect.y < graphBox.bottom) {
        // Handle rounding error
        sBorderIntersect = new Point(sBorderIntersect.x, graphBox.bottom)
      }

      let nBorderIntersect = new Point(location.x, Math.max(t.xx0.y, t.xx1.y))
      if (nBorderIntersect.y > graphBox.top) {
        nBorderIntersect = new Point(nBorderIntersect.x, graphBox.top)
      }

      this.CreatePortEntrancesAtBorderIntersections(curveBox, oport, location, sBorderIntersect, nBorderIntersect)
    }

    // endif vertical pass is not at horizontal extreme
    if (!found) {
      // This must be on a corner, else one of the above would have matched.
      this.CreateEntrancesForCornerPort(curveBox, oport, location)
    }
  }

  private GetBorderIntersections(location: Point, lineSeg: LineSegment, curve: ICurve, t: {xx0: Point; xx1: Point}) {
    // Important:  the LineSegment must be the first arg to GetAllIntersections so RawIntersection works.
    const xxs = Curve.getAllIntersections(lineSeg, curve, true)
    /*Assert.assert(2 === xxs.length, 'Expected two intersections')*/
    t.xx0 = Point.RoundPoint(xxs[0].x)
    t.xx1 = Point.RoundPoint(xxs[1].x)
  }

  private CreatePortEntrancesAtBorderIntersections(
    curveBox: Rectangle,
    oport: ObstaclePort,
    location: Point,
    unpaddedBorderIntersect0: Point,
    unpaddedBorderIntersect1: Point,
  ) {
    // Allow entry from both sides, except from the opposite side of a point on the border.
    const dir: Direction = PointComparer.GetDirections(unpaddedBorderIntersect0, unpaddedBorderIntersect1)
    if (!PointComparer.EqualPP(unpaddedBorderIntersect0, location)) {
      this.CreatePortEntrance(curveBox, oport, unpaddedBorderIntersect1, dir)
    }

    if (!PointComparer.EqualPP(unpaddedBorderIntersect1, location)) {
      this.CreatePortEntrance(curveBox, oport, unpaddedBorderIntersect0, CompassVector.OppositeDir(dir))
    }
  }

  private static GetDerivative(oport: ObstaclePort, borderPoint: Point): Point {
    // This is only used for ObstaclePorts, which have ensured Port.Curve is not null.
    const param: number = oport.PortCurve.closestParameter(borderPoint)
    let deriv = oport.PortCurve.derivative(param)
    const parMid = (oport.PortCurve.parStart + oport.PortCurve.parEnd) / 2
    if (!InteractiveObstacleCalculator.CurveIsClockwise(oport.PortCurve, oport.PortCurve.value(parMid))) {
      deriv = deriv.mul(-1)
    }

    return deriv
  }

  private CreatePortEntrance(curveBox: Rectangle, oport: ObstaclePort, unpaddedBorderIntersect: Point, outDir: Direction) {
    oport.CreatePortEntrance(unpaddedBorderIntersect, outDir, this.ObstacleTree)
    const scanDir: ScanDirection = ScanDirection.GetInstance(outDir)
    let axisDistanceBetweenIntersections: number =
      StaticGraphUtility.GetRectangleBound(curveBox, outDir) - scanDir.Coord(unpaddedBorderIntersect)
    if (axisDistanceBetweenIntersections < 0) {
      axisDistanceBetweenIntersections = -axisDistanceBetweenIntersections
    }

    if (axisDistanceBetweenIntersections > GeomConstants.intersectionEpsilon) {
      // This is not on an extreme boundary of the unpadded curve (it's on a sloping (nonrectangular) boundary),
      // so we need to generate another entrance in one of the perpendicular directions (depending on which
      // way the side slopes).  Derivative is always clockwise.
      const perpDirs: Direction = CompassVector.VectorDirection(PortManager.GetDerivative(oport, unpaddedBorderIntersect))
      let perpDir: Direction
      outDir | CompassVector.OppositeDir(outDir)
      if (Direction.None !== (outDir & perpDirs)) {
        // If the derivative is in the same direction as outDir then perpDir is toward the obstacle
        // interior and must be reversed.
        perpDir = CompassVector.OppositeDir(perpDir)
      }

      oport.CreatePortEntrance(unpaddedBorderIntersect, perpDir, this.ObstacleTree)
    }
  }

  private CreateEntrancesForCornerPort(curveBox: Rectangle, oport: ObstaclePort, location: Point) {
    // This must be a corner or it would have been within one of the bounds and handled elsewhere.
    // Therefore create an entrance in both directions, with the first direction selected so that
    // the second can be obtained via RotateRight.
    let outDir: Direction = Direction.North
    if (PointComparer.EqualPP(location, curveBox.leftBottom)) {
      outDir = Direction.South
    } else if (PointComparer.EqualPP(location, curveBox.leftTop)) {
      outDir = Direction.West
    } else if (PointComparer.EqualPP(location, curveBox.rightTop)) {
      outDir = Direction.North
    } else if (PointComparer.EqualPP(location, curveBox.rightBottom)) {
      outDir = Direction.East
    } else {
      /*Assert.assert(false, 'Expected Port to be on corner of curveBox')*/
    }

    oport.CreatePortEntrance(location, outDir, this.ObstacleTree)
    oport.CreatePortEntrance(location, CompassVector.RotateRight(outDir), this.ObstacleTree)
  }

  private AddObstaclePortEntranceToGraph(entrance: ObstaclePortEntrance) {
    // Note: As discussed in ObstaclePortEntrance.AddToGraph, oport.VisibilityBorderIntersect may be
    // on a border shared with another obstacle, in which case we'll extend into that obstacle.  This
    // should be fine if we're consistent about "touching means overlapped", so that a path that comes
    // through the other obstacle on the shared border is OK.
    const borderVertex: VisibilityVertex = this.VisGraph.FindVertex(entrance.VisibilityBorderIntersect)
    if (borderVertex) {
      entrance.ExtendEdgeChain(this.TransUtil, borderVertex, borderVertex, this.portSpliceLimitRectangle, this.RouteToCenterOfObstacles)
      return
    }

    // There may be no scansegment to splice to before we hit an adjacent obstacle, so if the edge
    // is null there is nothing to do.
    const t: {targetVertex: VisibilityVertex} = {targetVertex: null}
    const weight: number = entrance.IsOverlapped ? ScanSegment.OverlappedWeight : ScanSegment.NormalWeight

    const edge: VisibilityEdge = this.FindorCreateNearestPerpEdgePPDNT(
      entrance.MaxVisibilitySegment.end,
      entrance.VisibilityBorderIntersect,
      entrance.OutwardDirection,
      weight,
      t,
    )
    if (edge != null) {
      entrance.AddToAdjacentVertex(this.TransUtil, t.targetVertex, this.portSpliceLimitRectangle, this.RouteToCenterOfObstacles)
    }
  }

  private InBoundsGraphBoxIntersect(point: Point, dir: Direction): Point {
    return StaticGraphUtility.RectangleBorderIntersect(this.graphGenerator.ObstacleTree.GraphBox, point, dir)
  }

  FindorCreateNearestPerpEdgePPDN(first: Point, second: Point, dir: Direction, weight: number): VisibilityEdge {
    const t: {targetVertex: VisibilityVertex} = {targetVertex: null}
    return this.FindorCreateNearestPerpEdgePPDNT(first, second, dir, weight, t)
  }

  private FindorCreateNearestPerpEdgePPDNT(
    first: Point,
    second: Point,
    dir: Direction,
    weight: number,
    t: {targetVertex: VisibilityVertex},
  ): VisibilityEdge {
    // Find the closest perpendicular ScanSegment that intersects a segment with endpoints
    // first and second, then find the closest parallel ScanSegment that intersects that
    // perpendicular ScanSegment.  This gives us a VisibilityVertex location from which we
    // can walk to the closest perpendicular VisibilityEdge that intersects first->second.
    const couple = StaticGraphUtility.SortAscending(first, second)
    const low: Point = couple[0]
    const high: Point = couple[1]
    const perpendicularScanSegments: ScanSegmentTree = StaticGraphUtility.IsVerticalD(dir) ? this.HScanSegments : this.VScanSegments
    // Look up the nearest intersection.  For obstacles, we cannot just look for the bounding box
    // corners because nonrectilinear obstacles may have other obstacles overlapping the bounding
    // box (at either the corners or between the port border intersection and the bounding box
    // side), and of course obstacles may overlap too.
    const nearestPerpSeg: ScanSegment = StaticGraphUtility.IsAscending(dir)
      ? perpendicularScanSegments.FindLowestIntersector(low, high)
      : perpendicularScanSegments.FindHighestIntersector(low, high)
    if (nearestPerpSeg == null) {
      // No ScanSegment between this and visibility limits.
      t.targetVertex = null
      return null
    }

    const edgeIntersect: Point = StaticGraphUtility.SegmentIntersectionSP(nearestPerpSeg, low)
    // We now know the nearest perpendicular segment that intersects start->end.  Next we'll find a close
    // parallel scansegment that intersects the perp segment, then walk to find the nearest perp edge.
    return this.FindOrCreateNearestPerpEdgeFromNearestPerpSegment(
      StaticGraphUtility.IsAscending(dir) ? low : high,
      nearestPerpSeg,
      edgeIntersect,
      weight,
      t,
    )
  }

  private FindOrCreateNearestPerpEdgeFromNearestPerpSegment(
    pointLocation: Point,
    scanSeg: ScanSegment,
    edgeIntersect: Point,
    weight: number,
    t: {targetVertex: VisibilityVertex},
  ): VisibilityEdge {
    // Given: a ScanSegment scanSeg perpendicular to pointLocation->edgeIntersect and containing edgeIntersect.
    // To find: a VisibilityEdge perpendicular to pointLocation->edgeIntersect which may be on scanSeg, or may
    //          be closer to pointLocation than the passed edgeIntersect is.
    // Since there may be TransientEdges between pointLocation and edgeIntersect, we start by finding
    // a scanSeg-intersecting (i.e. parallel to pointLocation->edgeIntersect) ScanSegment, then starting from
    // the intersection of those segments, walk the VisibilityGraph until we find the closest VisibilityEdge
    // perpendicular to pointLocation->edgeIntersect.  If there is a vertex on that edge collinear to
    // pointLocation->edgeIntersect, return the edge for which it is Source, else split the edge.
    // If there is already a vertex at edgeIntersect, we do not need to look for the intersecting ScanSegment.
    const tt: {
      segsegVertex: VisibilityVertex
      targetVertex: VisibilityVertex
    } = {
      segsegVertex: this.VisGraph.FindVertex(edgeIntersect),
      targetVertex: null,
    }
    if (tt.segsegVertex == null) {
      const edge = this.FindOrCreateSegmentIntersectionVertexAndAssociatedEdge(pointLocation, edgeIntersect, scanSeg, weight, tt)
      if (edge != null) {
        return edge
      }
    } else if (PointComparer.EqualPP(pointLocation, edgeIntersect)) {
      // The initial pointLocation was on scanSeg at an existing vertex so return an edge
      // from that vertex along scanSeg. Look in both directions in case of dead ends.
      t.targetVertex = tt.segsegVertex
      return this.TransUtil.FindNextEdge(t.targetVertex, CompassVector.OppositeDir(scanSeg.ScanDirection.Dir))
    }

    // pointLocation is not on the initial scanSeg, so see if there is a transient edge between
    // pointLocation and edgeIntersect.  edgeIntersect === segsegVertex.Point if pointLocation is
    // collinear with intSegBefore (pointLocation is before or after intSegBefore's VisibilityVertices).
    const dirTowardLocation: Direction = PointComparer.GetDirections(edgeIntersect, pointLocation)
    let perpDir: Direction = PointComparer.GetDirections(tt.segsegVertex.point, pointLocation)
    if (dirTowardLocation === perpDir) {
      // intSegBefore is collinear with pointLocation so walk to the vertex closest to pointLocation.
      const ot: {
        bracketTarget: VisibilityVertex
        bracketSource: VisibilityVertex
      } = {bracketTarget: null, bracketSource: null}
      TransientGraphUtility.FindBracketingVertices(tt.segsegVertex, pointLocation, dirTowardLocation, ot)
      // Return an edge. Look in both directions in case of dead ends.
      return (
        this.TransUtil.FindNextEdge(ot.bracketSource, CompassVector.RotateLeft(dirTowardLocation)) ??
        this.TransUtil.FindNextEdge(ot.bracketSource, CompassVector.RotateRight(dirTowardLocation))
      )
    }

    // Now make perpDir have only the perpendicular component.
    perpDir &= ~dirTowardLocation // if this is Directions. None, pointLocation === edgeIntersect
    // StaticGraphUtility.Assert((Direction.None !== perpDir), "pointLocation === initial segsegVertex.Point should already have exited", this.ObstacleTree, this.VisGraph);
    // Other TransientVE edge chains may have been added between the control point and the
    // ScanSegment (which is always non-transient), and they may have split ScanSegment VEs.
    // Fortunately we know we'll always have all transient edge chains extended to or past any
    // control point (due to LimitRectangle), so we can just move up lowestIntSeg toward
    // pointLocation, updating segsegVertex and edgeIntersect.  There are 3 possibilities:
    //  - location is not on an edge - the usual case, we just create an edge perpendicular
    //    to an edge on scanSeg, splitting that scanSeg edge in the process.
    //  - location is on a VE that is parallel to scanSeg.  This is essentially the same thing
    //    but we don't need the first perpendicular edge to scanSeg.
    //  - location is on a VE that is perpendicular to scanSeg.  In that case the vertex on ScanSeg
    //    already exists; TransUtil.FindOrAddEdge just returns the edge starting at that intersection.
    // FreePoint tests of this are in RectilinearTests.FreePortLocationRelativeToTransientVisibilityEdges*.
    const perpendicularEdge: VisibilityEdge = this.TransUtil.FindNearestPerpendicularOrContainingEdge(
      tt.segsegVertex,
      perpDir,
      pointLocation,
    )
    if (perpendicularEdge == null) {
      // Dead end; we're above the highest point at which there is an intersection of scanSeg.
      // Create a new vertex and edge higher than the ScanSegment's HighestVisibilityVertex
      // if that doesn't cross an obstacle (if we are between two ScanSegment dead-ends, we may).
      // We hit this in RectilinearFileTests.Nudger_Many_Paths_In_Channel and .Nudger_Overlap*.
      // StaticGraphUtility.Assert((edgeIntersect > scanSeg.HighestVisibilityVertex.point), "edgeIntersect is not > scanSeg.HighestVisibilityVertex", this.ObstacleTree, this.VisGraph);
      t.targetVertex = this.TransUtil.AddVertex(edgeIntersect)
      return this.TransUtil.FindOrAddEdge(t.targetVertex, scanSeg.HighestVisibilityVertex, scanSeg.Weight)
    }

    // We have an intersecting perp edge, which may be on the original scanSeg or closer to pointLocation.
    // Get one of its vertices and re-find the intersection on it (it doesn't matter which vertex of the
    // edge we use, but for consistency use the "lower in perpDir" one).
    tt.segsegVertex = StaticGraphUtility.GetEdgeEnd(perpendicularEdge, CompassVector.OppositeDir(perpDir))
    edgeIntersect = StaticGraphUtility.SegmentIntersectionPPP(pointLocation, edgeIntersect, tt.segsegVertex.point)
    // By this point we've verified there's no intervening Transient edge, so if we have an identical
    // point, we're done.
    if (PointComparer.EqualPP(tt.segsegVertex.point, edgeIntersect)) {
      t.targetVertex = tt.segsegVertex
      return this.TransUtil.FindNextEdge(tt.segsegVertex, perpDir)
    }

    // The targetVertex doesn't exist; this will split the edge and add it.
    t.targetVertex = this.TransUtil.FindOrAddVertex(edgeIntersect)
    return this.TransUtil.FindOrAddEdge(tt.segsegVertex, t.targetVertex, weight)
  }

  private FindOrCreateSegmentIntersectionVertexAndAssociatedEdge(
    pointLocation: Point,
    edgeIntersect: Point,
    scanSeg: ScanSegment,
    weight: number,
    t: {segsegVertex: VisibilityVertex; targetVertex: VisibilityVertex},
  ): VisibilityEdge {
    const intersectingSegments: ScanSegmentTree = scanSeg.IsVertical ? this.HScanSegments : this.VScanSegments
    const intSegBefore: ScanSegment = intersectingSegments.FindHighestIntersector(scanSeg.Start, edgeIntersect)
    if (intSegBefore == null) {
      // Dead end; we're below the lowest point at which there is an intersection of scanSeg.
      // Create a new vertex and edge lower than the ScanSegment's LowestVisibilityVertex.
      // Test: RectilinearFileTests.Overlap_Rotate_SplicePort_FreeObstaclePorts.
      t.segsegVertex = null
      t.targetVertex = this.TransUtil.AddVertex(edgeIntersect)
      return this.TransUtil.FindOrAddEdge(t.targetVertex, scanSeg.LowestVisibilityVertex, scanSeg.Weight)
    }

    // Get the VisibilityVertex at the intersection of the two segments we just found;
    // edgeIntersect is between that vertex and another on the segment, and we'll split
    // the edge between those two vertices (or find one nearer to walk to).
    const segsegIntersect: Point = StaticGraphUtility.SegmentsIntersection(scanSeg, intSegBefore)
    t.segsegVertex = this.VisGraph.FindVertex(segsegIntersect)
    if (!t.segsegVertex) {
      // This happens only for UseSparseVisibilityGraph; in that case we must create the
      // intersection vertex in the direction of both segments so we can start walking.
      t.segsegVertex = this.TransUtil.AddVertex(segsegIntersect)
      const newEdge = this.AddEdgeToClosestSegmentEnd(scanSeg, t.segsegVertex, scanSeg.Weight)
      this.AddEdgeToClosestSegmentEnd(intSegBefore, t.segsegVertex, intSegBefore.Weight)
      if (PointComparer.EqualPP(t.segsegVertex.point, edgeIntersect)) {
        t.targetVertex = t.segsegVertex
        return newEdge
      }
    }

    if (PointComparer.EqualPP(pointLocation, edgeIntersect)) {
      // The initial pointLocation was on scanSeg and we had to create a new vertex for it,
      // so we'll find or create (by splitting) the edge on scanSeg that contains pointLocation.
      t.targetVertex = this.TransUtil.FindOrAddVertex(edgeIntersect)
      return this.TransUtil.FindOrAddEdge(t.segsegVertex, t.targetVertex, weight)
    }

    t.targetVertex = null
    return null
  }

  private AddEdgeToClosestSegmentEnd(scanSeg: ScanSegment, segsegVertex: VisibilityVertex, weight: number): VisibilityEdge {
    // FindOrAddEdge will walk until it finds the minimal bracketing vertices.
    if (PointComparer.IsPureLower(scanSeg.HighestVisibilityVertex.point, segsegVertex.point)) {
      return this.TransUtil.FindOrAddEdge(scanSeg.HighestVisibilityVertex, segsegVertex, weight)
    }

    if (PointComparer.IsPureLower(segsegVertex.point, scanSeg.LowestVisibilityVertex.point)) {
      return this.TransUtil.FindOrAddEdge(segsegVertex, scanSeg.LowestVisibilityVertex, weight)
    }

    return this.TransUtil.FindOrAddEdgeVV(scanSeg.LowestVisibilityVertex, segsegVertex)
  }

  private GetPortSpliceLimitRectangle(edgeGeom: GeomEdge) {
    if (!this.LimitPortVisibilitySpliceToEndpointBoundingBox) {
      this.portSpliceLimitRectangle = this.graphGenerator.ObstacleTree.GraphBox
      return
    }

    // Return the endpoint-containing rectangle marking the limits of edge-chain extension for a single path.
    this.portSpliceLimitRectangle = this.GetPortRectangle(edgeGeom.sourcePort)
    this.portSpliceLimitRectangle.addRecSelf(this.GetPortRectangle(edgeGeom.targetPort))
  }

  GetPortRectangle(port: Port): Rectangle {
    const oport: ObstaclePort = this.obstaclePortMap.get(port)
    if (oport) {
      return oport.Obstacle.VisibilityBoundingBox.clone()
    }

    // FreePoint.
    return Rectangle.mkOnPoints([Point.RoundPoint(port.Location)])
  }

  AddToLimitRectangle(location: Point) {
    if (this.graphGenerator.IsInBoundsP(location)) {
      this.portSpliceLimitRectangle.add(location)
    }
  }

  private FindOrCreateFreePoint(location: Point): FreePoint {
    let freePoint: FreePoint = this.freePointMap.get(location)
    if (!freePoint) {
      freePoint = new FreePoint(this.TransUtil, location)
      this.freePointMap.set(location, freePoint)
    } else {
      freePoint.GetVertex(this.TransUtil, location)
    }

    this.freePointsInGraph.add(freePoint)
    this.freePointLocationsUsedByRouteEdges.add(location)
    return freePoint
  }

  // This is private because it depends on LimitRectangle
  private AddFreePointToGraph(location: Point): FreePoint {
    // This is a FreePoint, either a Waypoint or a Port not in an Obstacle.Ports list.
    // We can't modify the Port.Location as the caller owns that, so Point.RoundPoint it
    // at the point at which we acquire it.
    location = Point.RoundPoint(location)
    // If the point already exists before FreePoint creation, there's nothing to do.
    const vertex = this.VisGraph.FindVertex(location)
    const freePoint = this.FindOrCreateFreePoint(location)
    if (vertex != null) {
      return freePoint
    }

    if (!this.graphGenerator.IsInBoundsP(location)) {
      this.CreateOutOfBoundsFreePoint(freePoint)
      return freePoint
    }

    // Vertex is inbounds and does not yet exist.  Possibilities are:
    //  - point is on one ScanSegment (perhaps a dead-end)
    //  - point is not on any edge (it's in free space so it's in the middle of some rectangle
    //    (possibly not closed) formed by ScanSegment intersections)
    let edge: VisibilityEdge = null
    freePoint.IsOverlapped = this.ObstacleTree.PointIsInsideAnObstacle(freePoint.Point, this.HScanSegments.ScanDirection)
    let scanSegment
    this.VScanSegments.FindSegmentContainingPoint(location, true)
    if (scanSegment != null) {
      // The location is on one ScanSegment.  Find the intersector and split an edge along the segment
      // (or extend the VisibilityEdges of the segment in the desired direction).
      const t: {targetVertex: VisibilityVertex} = {targetVertex: null}
      edge = this.FindOrCreateNearestPerpEdgeFromNearestPerpSegment(location, scanSegment, location, freePoint.InitialWeight, t)
    }

    let edgeDir: Direction = Direction.South
    if (edge != null) {
      // The freePoint is on one (but not two) segments, and has already been spliced into
      // that segment's edge chain.  Add edges laterally to the parallel edges.
      edgeDir = StaticGraphUtility.EdgeDirectionVE(edge)
      this.ConnectFreePointToLateralEdge(freePoint, CompassVector.RotateLeft(edgeDir))
      this.ConnectFreePointToLateralEdge(freePoint, CompassVector.RotateRight(edgeDir))
    } else {
      // The freePoint is not on ScanSegment so we must splice to 4 surrounding edges (or it may be on a
      // TransientVE). Look in each of the 4 directions, trying first to avoid crossing any obstacle
      // boundaries.  However if we cannot find an edge that does not cross an obstacle boundary, the
      // freepoint is inside a non-overlapped obstacle, so take a second pass to connect to the nearest
      // edge regardless of obstacle boundaries.
      for (let ii = 0; ii < 4; ii++) {
        this.ConnectFreePointToLateralEdge(freePoint, edgeDir)
        edgeDir = CompassVector.RotateLeft(edgeDir)
      }
    }

    return freePoint
  }

  private CreateOutOfBoundsFreePoint(freePoint: FreePoint) {
    // For an out of bounds (OOB) point, we'll link one edge from it to the inbounds edge if it's
    // out of bounds in only one direction; if in two, we'll add a bend. Currently we don't need
    // to do any more because multiple waypoints are processed as multiple subpaths.
    const oobLocation = freePoint.Point
    const inboundsLocation: Point = this.graphGenerator.MakeInBoundsLocation(oobLocation)
    const dirFromGraph: Direction = PointComparer.GetDirections(inboundsLocation, oobLocation)
    freePoint.OutOfBoundsDirectionFromGraph = dirFromGraph
    if (!PointComparer.IsPureDirectionD(dirFromGraph)) {
      // It's OOB in two directions so will need a bend, but we know inboundsLocation
      // is a graph corner so it has a vertex already and we don't need to look up sides.
      //StaticGraphUtility.Assert((this.VisGraph.FindVertex(inboundsLocation) != null), "graph corner vertex not found", this.ObstacleTree, this.VisGraph);
      freePoint.AddOobEdgesFromGraphCorner(this.TransUtil, inboundsLocation)
      return
    }

    // We know inboundsLocation is on the nearest graphBox border ScanSegment, so this won't return a
    // null edge, and we'll just do normal join-to-one-edge handling, extending in the direction to the graph.
    let inboundsVertex = this.VisGraph.FindVertex(inboundsLocation)
    const dirToGraph = CompassVector.OppositeDir(dirFromGraph)
    if (inboundsVertex != null) {
      freePoint.AddToAdjacentVertex(this.TransUtil, inboundsVertex, dirToGraph, this.portSpliceLimitRectangle)
    } else {
      const edge = this.FindorCreateNearestPerpEdgePPDN(oobLocation, inboundsLocation, dirFromGraph, ScanSegment.NormalWeight)
      if (edge != null) {
        inboundsVertex = freePoint.AddEdgeToAdjacentEdge(this.TransUtil, edge, dirToGraph, this.portSpliceLimitRectangle)
      }
    }

    // This may be an oob waypoint, in which case we want to add additional edges so we can
    // go outside graph, cross the waypoint, and come back in.  Shortest-paths will do the
    // work of determining the optimal path, to avoid backtracking.
    const inboundsLeftVertex = StaticGraphUtility.FindAdjacentVertex(inboundsVertex, CompassVector.RotateLeft(dirToGraph))
    if (inboundsLeftVertex != null) {
      this.TransUtil.ConnectVertexToTargetVertex(freePoint.Vertex, inboundsLeftVertex, dirToGraph, ScanSegment.NormalWeight)
    }

    const inboundsRightVertex = StaticGraphUtility.FindAdjacentVertex(inboundsVertex, CompassVector.RotateRight(dirToGraph))
    if (inboundsRightVertex != null) {
      this.TransUtil.ConnectVertexToTargetVertex(freePoint.Vertex, inboundsRightVertex, dirToGraph, ScanSegment.NormalWeight)
    }
  }

  private ConnectFreePointToLateralEdge(freePoint: FreePoint, lateralDir: Direction) {
    // Turn on pivot vertex to either side to find the next edge to connect to.  If the freepoint is
    // overlapped (inside an obstacle), just find the closest ScanSegment outside the obstacle and
    // start extending from there; otherwise, we can have the FreePoint calculate its max visibility.
    const end = freePoint.IsOverlapped
      ? this.InBoundsGraphBoxIntersect(freePoint.Point, lateralDir)
      : freePoint.MaxVisibilityInDirectionForNonOverlappedFreePoint(lateralDir, this.TransUtil)
    const lateralEdge = this.FindorCreateNearestPerpEdgePPDN(end, freePoint.Point, lateralDir, freePoint.InitialWeight)
    // There may be no VisibilityEdge between the current point and any adjoining obstacle in that direction.
    if (lateralEdge != null) {
      freePoint.AddEdgeToAdjacentEdge(this.TransUtil, lateralEdge, lateralDir, this.portSpliceLimitRectangle)
    }
  }
}
