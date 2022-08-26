//      the editor of a graph layout
import {SortedMap} from '@esfx/collections-sortedmap'
import {Point, Curve, LineSegment, Rectangle, ICurve} from '../../math/geometry'
import {CornerSite} from '../../math/geometry/cornerSite'
import {IntersectionInfo} from '../../math/geometry/intersectionInfo'
import {SmoothedPolyline} from '../../math/geometry/smoothedPolyline'
import {EdgeRoutingMode} from '../../routing/EdgeRoutingMode'
import {RectilinearInteractiveEditor} from '../../routing/rectilinear/RectilinearInteractiveEditor'
import {SplineRouter} from '../../routing/splineRouter'
import {StraightLineEdges} from '../../routing/StraightLineEdges'
import {GeomLabel, GeomNode} from '../core'
import {Arrowhead} from '../core/arrowhead'
import {GeomEdge} from '../core/geomEdge'
import {GeomGraph} from '../core/geomGraph'
import {GeomObject} from '../core/geomObject'
import {EdgeLabelPlacement} from '../edgeLabelPlacement'
import {CommonLayoutSettings} from '../layered/commonLayoutSettings'
import {ClustersCollapseExpandUndoRedoAction} from './clustersCollapseExpandUndoRedoAction'
import {EdgeDragUndoRedoAction} from './edgeDragUndoRedoAction'
import {EventHandler} from './eventHandler'
import {IncrementalDragger} from './incrementalDragger'
import {IViewerNode} from './iViewerNode'
import {IViewerObject} from './iViewerObject'
import {ObjectDragUndoRedoAction} from './objectDragUndoRedoAction'
import {SiteInsertUndoAction} from './siteInsertUndoAction'
import {SiteRemoveUndoAction} from './siteRemoveUndoAction'
import {UndoRedoAction} from './undoRedoAction'
import {UndoRedoActionsList} from './undoRedoActionsList'

enum DraggingMode {
  Incremental,
  Default,
}
export class GeometryGraphEditor {
  edgesDraggedWithSource: Set<GeomEdge> = new Set<GeomEdge>()

  edgesDraggedWithTarget: Set<GeomEdge> = new Set<GeomEdge>()

  graph: GeomGraph

  layoutSettings: CommonLayoutSettings

  objectsToDrag: Set<GeomObject> = new Set<GeomObject>()

  undoRedoActionsList: UndoRedoActionsList = new UndoRedoActionsList()

  undoMode = true

  incrementalDragger: IncrementalDragger
  ChangeInUndoRedoList: EventHandler

  get UndoRedoActionsList(): UndoRedoActionsList {
    return this.undoRedoActionsList
  }
  set UndoRedoActionsList(value: UndoRedoActionsList) {
    this.undoRedoActionsList = value
  }

  /**      return the current undo action*/

  public get CurrentUndoAction(): UndoRedoAction {
    return this.UndoRedoActionsList.CurrentUndo
  }

  /**  return the current redo action*/

  public get CurrentRedoAction(): UndoRedoAction {
    return this.UndoRedoActionsList.CurrentRedo
  }

  /**  Will be set to true if an entity was dragged out of the graph bounding box*/

  graphBoundingBoxGetsExtended_: boolean
  public get GraphBoundingBoxGetsExtended(): boolean {
    return this.graphBoundingBoxGetsExtended_
  }
  public set GraphBoundingBoxGetsExtended(value: boolean) {
    this.graphBoundingBoxGetsExtended_ = value
  }

  //      Current graph under editing

  public get geomGraph(): GeomGraph {
    return this.graph
  }
  public set geomGraph(value: GeomGraph) {
    this.graph = value
    this.Clear()
    this.RaiseChangeInUndoList()
  }

  public get LayoutSettings(): CommonLayoutSettings {
    return this.layoutSettings
  }
  public set LayoutSettings(value: CommonLayoutSettings) {
    this.layoutSettings = value
  }

  protected get EdgeRoutingMode(): EdgeRoutingMode {
    return this.LayoutSettings.edgeRoutingSettings.EdgeRoutingMode
  }

  //      The edge data of the edge selected for editing
  editedEdge: GeomEdge
  get EditedEdge(): GeomEdge {
    return this.editedEdge
  }
  set EditedEdge(value: GeomEdge) {
    this.editedEdge = value
  }

  /**  enumerates over the nodes chosen for dragging */
  public *ObjectsToDrag(): IterableIterator<GeomObject> {
    return this.objectsToDrag
  }

  /**       returns true if "undo" is available */
  public get CanUndo(): boolean {
    return this.UndoRedoActionsList.CurrentUndo != null
  }

  /**  returns true if "redo" is available*/
  public get CanRedo(): boolean {
    return this.UndoRedoActionsList.CurrentRedo != null
  }

  /**  indicates if the editor is under the undo mode*/

  get UndoMode(): boolean {
    return this.undoMode
  }
  set UndoMode(value: boolean) {
    this.undoMode = value
  }

  /**
   * Signals that there is a change  of the undo/redo list.
   * There are four possibilities: Undo(Redo) becomes available (unavailable)
   * */

  // public /*event*/ ChangeInUndoRedoList: EventHandler;  // not sure what happens with events

  static DragLabel(label: GeomLabel, delta: Point) {
    label.positionCenter(label.center.add(delta))
    const edge = <GeomEdge>GeomObject.getGeom(label.parent.entity)
    if (edge != null) {
      GeometryGraphEditor.CalculateAttachedSegmentEnd(label, edge)
      if (!Point.closeDistEps(label.AttachmentSegmentEnd, label.center)) {
        const x: IntersectionInfo = Curve.intersectionOne(
          label.boundingBox.perimeter(),
          LineSegment.mkPP(label.AttachmentSegmentEnd, label.center),
          false,
        )
        label.AttachmentSegmentStart = x != null ? x.x : label.center
      } else {
        label.AttachmentSegmentStart = label.center
      }
    }
  }

  static CalculateAttachedSegmentEnd(label: GeomLabel, edge: GeomEdge) {
    label.AttachmentSegmentEnd = edge.curve.value(edge.curve.closestParameter(label.center))
  }

  //      drags elements by the delta

  Drag(delta: Point, draggingMode: DraggingMode, lastMousePosition: Point) {
    this.GraphBoundingBoxGetsExtended = false
    if (delta.x !== 0 || delta.y !== 0) {
      if (this.EditedEdge == null) {
        if (this.EdgeRoutingMode !== EdgeRoutingMode.Rectilinear && this.EdgeRoutingMode !== EdgeRoutingMode.RectilinearToCenter) {
          this.DragObjectsForNonRectilinearCase(delta, draggingMode)
        } else {
          this.DragObjectsForRectilinearCase(delta)
        }
      } else {
        this.DragEdgeEdit(lastMousePosition, delta)
        this.UpdateGraphBoundingBoxWithCheck(this.EditedEdge)
      }
    }
  }

  DragObjectsForRectilinearCase(delta: Point) {
    for (const node of this.objectsToDrag) {
      if (node instanceof GeomNode) {
        node.translate(delta)
      }
    }

    RectilinearInteractiveEditor.CreatePortsAndRouteEdges(
      this.LayoutSettings.NodeSeparation / 3,
      1,
      this.graph.deepNodes,
      this.graph.deepEdges,
      this.LayoutSettings.edgeRoutingSettings.EdgeRoutingMode,
    )
    EdgeLabelPlacement.constructorG(this.graph).run()

    for (const e of this.geomGraph.deepEdges) {
      this.UpdateGraphBoundingBoxWithCheck(e)
    }

    for (const n of this.geomGraph.deepNodes) {
      this.UpdateGraphBoundingBoxWithCheck(n)
    }

    this.PropagateChangesToClusterParents()
  }

  DragObjectsForNonRectilinearCase(delta: Point, draggingMode: DraggingMode) {
    if (draggingMode === DraggingMode.Incremental) {
      this.DragIncrementally(delta)
    } else if (this.EdgeRoutingMode === EdgeRoutingMode.Spline || this.EdgeRoutingMode === EdgeRoutingMode.SplineBundling) {
      this.DragWithSplinesOrBundles(delta)
    } else {
      this.DragWithStraightLines(delta)
    }
  }

  DragWithStraightLines(delta: Point) {
    for (const geomObj of this.objectsToDrag) {
      if (geomObj instanceof GeomNode) {
        geomObj.translate(delta)
      } else {
        GeometryGraphEditor.ShiftDragEdge(delta, geomObj)
      }

      this.UpdateGraphBoundingBoxWithCheck(geomObj)
    }

    this.PropagateChangesToClusterParents()
    this.DragEdgesAsStraighLines(delta)
  }

  PropagateChangesToClusterParents() {
    const touchedClusters = new Set<GeomGraph>()
    for (const n of this.objectsToDrag) {
      if (n instanceof GeomNode === false) continue
      const geomNode = n as GeomNode
      for (const c of geomNode.node.getAncestors()) {
        const gc = GeomObject.getGeom(c)
        if (gc !== this.geomGraph && !this.objectsToDrag.has(gc)) {
          touchedClusters.add(gc as GeomGraph)
        }
      }
    }

    if (touchedClusters.size > 0) {
      for (const c of this.graph.subgraphs()) {
        if (touchedClusters.has(c)) {
          c.boundingBox = c.calculateBoundsFromChildren()
        }
      }
    }
  }

  static ShiftDragEdge(delta: Point, geomObj: GeomObject) {
    const edge = geomObj instanceof GeomEdge
    if (edge) {
      geomObj.translate(delta)
    } else {
      const label = geomObj.label
      if (label != null) {
        GeometryGraphEditor.DragLabel(label, delta)
      } else {
        throw new Error()
      }
    }
  }

  DragWithSplinesOrBundles(delta: Point) {
    for (const geomObj of this.objectsToDrag) {
      if (geomObj instanceof GeomNode) {
        geomObj.translate(delta)
      }
    }

    this.RunSplineRouterAndPutLabels()
  }

  RunSplineRouterAndPutLabels() {
    const router = SplineRouter.mk5(
      this.graph,
      this.LayoutSettings.edgeRoutingSettings.Padding,
      this.LayoutSettings.edgeRoutingSettings.PolylinePadding,
      this.LayoutSettings.edgeRoutingSettings.ConeAngle,
      this.LayoutSettings.edgeRoutingSettings.bundlingSettings,
    )
    router.run()
    const elp = EdgeLabelPlacement.constructorG(this.graph)
    elp.run()
    this.UpdateGraphBoundingBoxWithCheck_()
  }

  DragEdgesAsStraighLines(delta: Point) {
    for (const edge of this.edgesDraggedWithSource) {
      GeometryGraphEditor.DragEdgeAsStraightLine(delta, edge)
    }

    for (const edge of this.edgesDraggedWithTarget) {
      GeometryGraphEditor.DragEdgeAsStraightLine(delta, edge)
    }

    const ep = EdgeLabelPlacement.constructorGA(
      this.graph,
      Array.from(this.edgesDraggedWithSource).concat(Array.from(this.edgesDraggedWithTarget)),
    )
    ep.run()
  }

  static DragEdgeAsStraightLine(delta: Point, edge: GeomEdge) {
    StraightLineEdges.CreateSimpleEdgeCurveWithUnderlyingPolyline(edge)
  }

  UpdateGraphBoundingBoxWithCheck_() {
    for (const node of this.graph.shallowNodes) {
      // shallow or deep?
      this.UpdateGraphBoundingBoxWithCheck(node)
    }

    for (const edge of this.graph.edges()) {
      // shallow or deep?
      this.UpdateGraphBoundingBoxWithCheck(edge)
    }
  }

  DragIncrementally(delta: Point) {
    const box: Rectangle = this.graph.boundingBox
    if (this.incrementalDragger == null) {
      this.InitIncrementalDragger()
    }

    this.incrementalDragger.Drag(delta)
    this.GraphBoundingBoxGetsExtended = box !== this.graph.boundingBox
  }

  DragEdgeEdit(lastMousePosition: Point, delta: Point) {
    // this.EditedEdge.RaiseLayoutChangeEvent(delta); Todo : implement
    const site: CornerSite = GeometryGraphEditor.FindClosestCornerForEdit(this.EditedEdge.underlyingPolyline, lastMousePosition)
    site.point = site.point.add(delta)
    GeometryGraphEditor.CreateCurveOnChangedPolyline(this.EditedEdge)
  }

  static DragEdgeWithSite(delta: Point, e: GeomEdge, site: CornerSite) {
    e.RaiseLayoutChangeEvent(delta)
    site.point = site.point.add(delta)
    GeometryGraphEditor.CreateCurveOnChangedPolyline(e)
  }

  static CreateCurveOnChangedPolyline(e: GeomEdge) {
    const curve: Curve = e.underlyingPolyline.createCurve()
    if (!Arrowhead.trimSplineAndCalculateArrowheadsII(e, e.source.boundaryCurve, e.target.boundaryCurve, curve, false)) {
      Arrowhead.createBigEnoughSpline(e)
    }
  }

  //      prepares for node dragging

  PrepareForObjectDragging(markedObjects: Iterable<GeomObject>, dragMode: DraggingMode) {
    this.EditedEdge = null
    this.CalculateDragSets(markedObjects)
    this.InsertToListAndSetTheBoxBefore(new ObjectDragUndoRedoAction(this.graph))
    if (dragMode === DraggingMode.Incremental) {
      this.InitIncrementalDragger()
    }
  }
  PrepareForClusterCollapseChange(changedClusters: Iterable<IViewerNode>) {
    this.InsertToListAndSetTheBoxBefore(new ClustersCollapseExpandUndoRedoAction(this.graph))
    for (const iCluster of changedClusters) {
      this.CurrentUndoAction.AddAffectedObject(iCluster)
    }
  }

  InitIncrementalDragger() {
    this.incrementalDragger = new IncrementalDragger(
      Array.from(this.objectsToDrag).filter((o) => o instanceof GeomNode) as Array<GeomNode>,
      this.graph,
      this.layoutSettings,
    )
  }

  ClearDraggedSets() {
    this.objectsToDrag.clear()
    this.edgesDraggedWithSource.clear()
    this.edgesDraggedWithTarget.clear()
  }

  CalculateDragSets(markedObjects: Iterable<GeomObject>) {
    this.ClearDraggedSets()
    for (const geometryObject of markedObjects) {
      this.objectsToDrag.add(geometryObject)
      const edge = <GeomEdge>geometryObject
      if (edge != null) {
        this.objectsToDrag.add(edge.source)
        this.objectsToDrag.add(edge.target)
      }
    }

    this.RemoveClusterSuccessorsFromObjectsToDrag()
    this.CalculateDragSetsForEdges()
  }

  RemoveClusterSuccessorsFromObjectsToDrag() {
    const listToRemove = new Array<GeomNode>()
    for (const node of this.objectsToDrag) {
      if (node instanceof GeomNode)
        for (const nodeAnc of node.getAncestors()) {
          if (this.objectsToDrag.has(nodeAnc)) {
            listToRemove.push(node)
            break
          }
        }
    }

    for (const node of listToRemove) {
      this.objectsToDrag.delete(node)
    }
  }

  UpdateGraphBoundingBoxWithCheck(geomObj: GeomObject) {
    const bBox = geomObj.boundingBox.clone()
    const leftTop = new Point(-this.geomGraph.margins.left, this.geomGraph.margins.top)
    const rightBottom = new Point(-this.geomGraph.margins.right, -this.geomGraph.margins.bottom)
    const bounds = this.geomGraph.boundingBox.clone()
    this.GraphBoundingBoxGetsExtended ||=
      bounds.addWithCheck(bBox.leftTop.add(leftTop)) || bounds.addWithCheck(bBox.rightBottom.add(rightBottom))
    this.geomGraph.boundingBox = bounds
  }

  CalculateDragSetsForEdges() {
    const clonedObjectsToDrag = Array.from(this.objectsToDrag)
    for (const geomObj of clonedObjectsToDrag) {
      if (geomObj instanceof GeomNode) {
        this.AssignEdgesOfNodeToEdgeDragSets(geomObj)
      }
    }
  }

  AssignEdgesOfNodeToEdgeDragSets(node: GeomNode) {
    for (const edge of node.selfEdges()) {
      this.objectsToDrag.add(edge)
    }

    for (const edge of node.inEdges()) {
      if (this.objectsToDrag.has(edge.source) || (edge.source.parent && this.objectsToDrag.has(edge.source.parent))) {
        this.objectsToDrag.add(edge)
      } else {
        this.edgesDraggedWithTarget.add(edge)
      }
    }

    for (const edge of node.outEdges()) {
      if (this.objectsToDrag.has(edge.target) || (edge.target.parent != null && this.objectsToDrag.has(edge.target.parent))) {
        this.objectsToDrag.add(edge)
      } else {
        this.edgesDraggedWithSource.add(edge)
      }
    }

    GeometryGraphEditor.CalculateOffsetsForMultiedges(node, this.LayoutSettings.NodeSeparation)
    if (node instanceof GeomGraph) {
      for (const n of node.allSuccessorsWidthFirst()) {
        this.AssignEdgesOfNodeToEdgeDragSets(n)
      }
    }
  }

  static CalculateOffsetsForMultiedges(node: GeomNode, nodeSeparation: number): Map<GeomEdge, number> {
    const offsetsInsideOfMultiedge = new Map<GeomEdge, number>()
    for (const multiedge of GeometryGraphEditor.GetMultiEdges(node)) {
      GeometryGraphEditor.CalculateMiddleOffsetsForMultiedge(multiedge, node, offsetsInsideOfMultiedge, nodeSeparation)
    }

    return offsetsInsideOfMultiedge
  }

  static CalculateMiddleOffsetsForMultiedge(
    multiedge: Array<GeomEdge>,
    node: GeomNode,
    offsetsInsideOfMultiedge: Map<GeomEdge, number>,
    nodeSeparation: number,
  ) {
    const middleAngles = GeometryGraphEditor.GetMiddleAnglesOfMultiedge(multiedge, node)
    const edges = Array.from(middleAngles.values()) // the edges should be sorted here

    const separation: number = nodeSeparation * 6
    const k: number = edges.length / 2
    const even: boolean = k * 2 === edges.length
    let off: number
    if (even) {
      off = (separation / 2) * -1
      for (let j: number = k - 1; j >= 0; j--) {
        const edge: GeomEdge = edges[j]
        offsetsInsideOfMultiedge.set(edge, off)
        off -= separation + (edge.label ? edge.label.width : 0)
      }

      off = separation / 2
      for (let j: number = k; j < edges.length; j++) {
        const edge: GeomEdge = edges[j]
        offsetsInsideOfMultiedge.set(edge, off)
        off += separation + (edge.label ? edge.label.width : 0)
      }
    } else {
      off = 0
      for (let j: number = k; j >= 0; j--) {
        const edge: GeomEdge = edges[j]
        offsetsInsideOfMultiedge.set(edge, off)
        off = separation + (edge.label ? edge.label.width : 0)
      }

      off = separation
      for (let j: number = k + 1; j < edges.length; j++) {
        const edge: GeomEdge = edges[j]
        offsetsInsideOfMultiedge.set(edge, off)
        off += separation + (edge.label ? edge.label.width : 0)
      }
    }
  }

  static GetMiddleAnglesOfMultiedge(multiedge: Array<GeomEdge>, node: GeomNode): SortedMap<number, GeomEdge> {
    const ret = new SortedMap<number, GeomEdge>()
    const firstEdge: GeomEdge = multiedge[0]
    const a: Point = node.center
    const b: Point = GeometryGraphEditor.Middle(firstEdge.curve)
    ret.set(0, firstEdge)
    for (let i = 1; i < multiedge.length; i++) {
      const edge: GeomEdge = multiedge[i]
      const c: Point = GeometryGraphEditor.Middle(edge.curve)
      let angle: number = Point.anglePCP(b, a, c)
      if (angle > Math.PI) {
        angle -= Math.PI * 2
      }

      ret.set(angle, edge)
    }

    return ret
  }

  static Middle(iCurve: ICurve): Point {
    return iCurve[iCurve.parStart + 0.5 * (iCurve.parEnd - iCurve.parStart)]
  }

  static *GetMultiEdges(node: GeomNode): IterableIterator<Array<GeomEdge>> {
    const nodeToMultiEdge = new Map<GeomNode, Array<GeomEdge>>()
    for (const edge of node.outEdges()) {
      GeometryGraphEditor.GetOrCreateListOfMultiedge(nodeToMultiEdge, edge.target).push(edge)
    }

    for (const edge of node.inEdges()) {
      GeometryGraphEditor.GetOrCreateListOfMultiedge(nodeToMultiEdge, edge.source).push(edge)
    }

    for (const list of nodeToMultiEdge.values()) {
      if (list.length > 1) {
        yield list
      }
    }
  }

  static GetOrCreateListOfMultiedge(nodeToMultiEdge: Map<GeomNode, Array<GeomEdge>>, node: GeomNode): Array<GeomEdge> {
    return nodeToMultiEdge.get(node)
  }

  InsertToListAndSetTheBoxBefore(action: UndoRedoAction): UndoRedoAction {
    this.UndoRedoActionsList.AddAction(action)
    action.GraphBoundingBoxBefore = action.graph.boundingBox
    this.RaiseChangeInUndoList()
    return action
  }

  RaiseChangeInUndoList() {
    if (this.ChangeInUndoRedoList != null) {
      this.ChangeInUndoRedoList.forEach((a) => a(this, null))
    }
  }

  //      preparing for an edge corner dragging

  public PrepareForEdgeCornerDragging(geometryEdge: GeomEdge, site: CornerSite): UndoRedoAction {
    this.EditedEdge = geometryEdge
    const edgeDragUndoRedoAction: UndoRedoAction = this.CreateEdgeEditUndoRedoAction()
    //             var edgeRestoreDate = (EdgeRestoreData) edgeDragUndoRedoAction.GetRestoreData(geometryEdge);
    //             edgeRestoreDate.CornerSite = site;
    return this.InsertToListAndSetTheBoxBefore(edgeDragUndoRedoAction)
  }

  //      prepares for the polyline corner removal

  public PrepareForPolylineCornerRemoval(affectedEdge: IViewerObject, site: CornerSite): UndoRedoAction {
    const action = new SiteRemoveUndoAction(this.EditedEdge)
    action.AddAffectedObject(affectedEdge)
    return this.InsertToListAndSetTheBoxBefore(action)
  }

  //      prepare for polyline corner insertion

  PrepareForPolylineCornerInsertion(affectedObj: IViewerObject, site: CornerSite): UndoRedoAction {
    const action = new SiteInsertUndoAction(this.EditedEdge)
    action.AddAffectedObject(affectedObj)
    return this.InsertToListAndSetTheBoxBefore(action)
  }

  CreateEdgeEditUndoRedoAction(): UndoRedoAction {
    return new EdgeDragUndoRedoAction(this.EditedEdge)
  }

  //      Undoes the last editing.

  public Undo() {
    if (this.CanUndo) {
      this.UndoRedoActionsList.CurrentUndo.Undo()
      this.UndoRedoActionsList.CurrentRedo = this.UndoRedoActionsList.CurrentUndo
      this.UndoRedoActionsList.CurrentUndo = this.UndoRedoActionsList.CurrentUndo.prev
      this.RaiseChangeInUndoList()
    }
  }

  //      redo the dragging

  public Redo() {
    if (this.CanRedo) {
      this.UndoRedoActionsList.CurrentRedo.Redo()
      this.UndoRedoActionsList.CurrentUndo = this.UndoRedoActionsList.CurrentRedo
      this.UndoRedoActionsList.CurrentRedo = this.UndoRedoActionsList.CurrentRedo.Next
      this.RaiseChangeInUndoList()
    }
  }

  //      clear the editor

  public Clear() {
    this.objectsToDrag = new Set<GeomObject>()
    this.edgesDraggedWithSource.clear()
    this.edgesDraggedWithTarget.clear()
    this.UndoRedoActionsList = new UndoRedoActionsList()
    this.EditedEdge = null
  }

  //      gets the enumerator pointing to the polyline corner before the point

  public static GetPreviousSite(edge: GeomEdge, point: Point): CornerSite {
    let prevSite: CornerSite = edge.underlyingPolyline.headSite
    let nextSite: CornerSite = prevSite.next
    for (; nextSite != null; ) {
      if (GeometryGraphEditor.BetweenSites(prevSite, nextSite, point)) {
        return prevSite
      }

      prevSite = nextSite
      nextSite = nextSite.next
    }

    return null
  }

  static BetweenSites(prevSite: CornerSite, nextSite: CornerSite, point: Point): boolean {
    const par: number = LineSegment.closestParameterOnLineSegment(point, prevSite.point, nextSite.point)
    return par > 0.1 && par < 0.9
  }

  //      insert a polyline corner

  public InsertSite(edge: GeomEdge, point: Point, siteBeforeInsertion: CornerSite, affectedEntity: IViewerObject) {
    this.EditedEdge = edge
    // creating the new site
    const first: CornerSite = siteBeforeInsertion
    const second: CornerSite = first.next
    const s = CornerSite.mkSiteSPS(first, point, second)
    this.PrepareForPolylineCornerInsertion(affectedEntity, s)
    // just to recalc everything  of a correct way
    GeometryGraphEditor.DragEdgeWithSite(new Point(0, 0), edge, s)
  }

  //      deletes the polyline corner

  public DeleteSite(edge: GeomEdge, site: CornerSite, userData: IViewerObject) {
    this.EditedEdge = edge
    this.PrepareForPolylineCornerRemoval(userData, site)
    site.prev.next = site.next
    // removing the site from the list
    site.next.prev = site.prev
    // just to recalc everything  of a correct way
    GeometryGraphEditor.DragEdgeWithSite(new Point(0, 0), edge, site.prev)
  }

  //      finds the polyline corner near the mouse position

  public static FindCornerForEdit(underlyingPolyline: SmoothedPolyline, mousePoint: Point, tolerance: number): CornerSite {
    let site = underlyingPolyline.headSite.next
    tolerance *= tolerance //square the tolerance

    do {
      if (site.prev == null || site.next == null) continue //don't return the first and the last corners
      const diff = mousePoint.sub(site.point)
      if (diff.dot(diff) <= tolerance) return site

      site = site.next
    } while (site.next != null)
    return null
  }

  //      finds the polyline corner near the mouse position

  static FindClosestCornerForEdit(underlyingPolyline: SmoothedPolyline, mousePoint: Point): CornerSite {
    let site = underlyingPolyline.headSite.next
    let bestSite = site
    let dist = bestSite.point.sub(mousePoint).lengthSquared
    while (site.next != null) {
      site = site.next
      const d = mousePoint.sub(site.point).lengthSquared
      if (d < dist) {
        bestSite = site
        dist = d
      }
    }

    return bestSite
  }

  //      creates a "tight" bounding box

  public FitGraphBoundingBox(affectedEntity: IViewerObject, geometryGraph: GeomGraph) {
    if (geometryGraph != null) {
      const uAction = new UndoRedoAction(geometryGraph)
      this.UndoRedoActionsList.AddAction(uAction)
      const r = Rectangle.mkEmpty()
      for (const n of geometryGraph.shallowNodes) {
        r.addRecSelf(n.boundingBox)
      }

      for (const e of geometryGraph.edges()) {
        r.addRecSelf(e.boundingBox)
        if (e.label != null) {
          r.addRecSelf(e.label.boundingBox)
        }
      }

      r.left -= geometryGraph.margins.left
      r.top += geometryGraph.margins.top
      r.bottom -= -geometryGraph.margins.bottom
      r.right += geometryGraph.margins.right
      uAction.ClearAffectedObjects()
      uAction.AddAffectedObject(affectedEntity)
      geometryGraph.boundingBox = r
      uAction.GraphBoundingBoxAfter = r
    }
  }

  public OnDragEnd(delta: Point) {
    if (this.CurrentUndoAction != null) {
      const action = this.CurrentUndoAction
      action.GraphBoundingBoxAfter = action.graph.boundingBox
    }
  }

  ReactOnViewChange() {
    //this.LayoutSettings.Interactor.RunOnViewChange();
  }

  ForgetDragging() {
    this.incrementalDragger = null
  }
}
