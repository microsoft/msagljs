///      the editor of a graph layout

import {Point, Curve, LineSegment, Rectangle, ICurve} from '../../math/geometry'
import {IntersectionInfo} from '../../math/geometry/intersectionInfo'
import {SmoothedPolyline} from '../../math/geometry/smoothedPolyline'
import {EdgeRoutingMode} from '../../routing/EdgeRoutingMode'
import {SplineRouter} from '../../routing/splineRouter'
import {StraightLineEdges} from '../../routing/StraightLineEdges'
import {GeomLabel, GeomNode} from '../core'
import {GeomEdge} from '../core/geomEdge'
import {GeomGraph} from '../core/GeomGraph'
import {GeomObject} from '../core/geomObject'
import {EdgeLabelPlacement} from '../edgeLabelPlacement'
import {LayoutSettings} from '../layered/SugiyamaLayoutSettings'
import {IncrementalDragger} from './incrementalDragger'
import {IViewerObject} from './iViewerObject'
import {UndoRedoAction} from './undoRedoAction'
import {UndoRedoActionsList} from './undoRedoActionsList'

export class GeometryGraphEditor {
  edgesDraggedWithSource: Set<GeomEdge> = new Set<GeomEdge>()

  edgesDraggedWithTarget: Set<GeomEdge> = new Set<GeomEdge>()

  graph: GeomGraph

  layoutSettings: LayoutSettings

  objectsToDrag: Set<GeomObject> = new Set<GeomObject>()

  undoRedoActionsList: UndoRedoActionsList = new UndoRedoActionsList()

  undoMode = true

  incrementalDragger: IncrementalDragger

  private get /* internal */ UndoRedoActionsList(): UndoRedoActionsList {
    return this.undoRedoActionsList
  }
  private set /* internal */ UndoRedoActionsList(value: UndoRedoActionsList) {
    this.undoRedoActionsList = value
  }

  ///      return the current undo action

  public get CurrentUndoAction(): UndoRedoAction {
    return this.UndoRedoActionsList.CurrentUndo
  }

  ///      return the current redo action

  public get CurrentRedoAction(): UndoRedoAction {
    return this.UndoRedoActionsList.CurrentRedo
  }

  // ///      Will be set to true if an entity was dragged out of the graph bounding box

  // public get GraphBoundingBoxGetsExtended(): boolean {
  // }
  // public set GraphBoundingBoxGetsExtended(value: boolean)  {
  // }

  // ///      Current graph under editing

  // public get Graph(): GeomGraph {
  //     return this.graph;
  // }
  // public set Graph(value: GeomGraph)  {
  //     this.graph = value;
  //     this.Clear();
  //     this.RaiseChangeInUndoList();
  // }

  // public get LayoutSettings(): LayoutAlgorithmSettings {
  //     return this.layoutSettings;
  // }
  // public set LayoutSettings(value: LayoutAlgorithmSettings)  {
  //     this.layoutSettings = value;
  //     LgLayoutSettings = (<LgLayoutSettings>(this.layoutSettings));
  // }

  // private /* internal */ get LgLayoutSettings(): LgLayoutSettings {
  // }
  // private /* internal */ set LgLayoutSettings(value: LgLayoutSettings)  {
  // }

  // protected get EdgeRoutingMode(): EdgeRoutingMode {
  //     return this.LayoutSettings.EdgeRoutingSettings.EdgeRoutingMode;
  // }

  // ///      The edge data of the edge selected for editing

  // private /* internal */ get EditedEdge(): GeomEdge {
  // }
  // private /* internal */ set EditedEdge(value: GeomEdge)  {
  // }

  // ///      enumerates over the nodes chosen for dragging

  // public get ObjectsToDrag(): IEnumerable<GeomObject> {
  //     return this.objectsToDrag;
  // }

  // ///      returns true if "undo" is available

  // public get CanUndo(): boolean {
  //     return (this.UndoRedoActionsList.CurrentUndo != null);
  // }

  // ///      returns true if "redo" is available

  // public get CanRedo(): boolean {
  //     return (this.UndoRedoActionsList.CurrentRedo != null);
  // }

  // ///  indicates if the editor is under the undo mode

  // private /* internal */ get UndoMode(): boolean {
  //     return this.undoMode;
  // }
  // private /* internal */ set UndoMode(value: boolean)  {
  //     this.undoMode = value;
  // }

  // ///      signals that there is a change in the undo/redo list
  // ///      There are four possibilities: Undo(Redo) becomes available (unavailable)

  // public /*event*/ ChangeInUndoRedoList: EventHandler;

  // private /* internal */ static DragLabel(label: GeomLabel, delta: Point) {
  //     label.Center = (label.Center + delta);
  //     let edge = (<GeomEdge>(label.GeometryParent));
  //     if ((edge != null)) {
  //         GeometryGraphEditor.CalculateAttachedSegmentEnd(label, edge);
  //         if (!ApproximateComparer.Close(label.AttachmentSegmentEnd, label.Center)) {
  //             let x: IntersectionInfo = Curve.CurveCurveIntersectionOne(label.BoundingBox.Perimeter(), new LineSegment(label.AttachmentSegmentEnd, label.Center), false);
  //             label.AttachmentSegmentStart = x.IntersectionPoint;
  //             // TODO: Warning!!!, inline IF is not supported ?
  //             (x != null);
  //             label.Center;
  //         }
  //         else {
  //             label.AttachmentSegmentStart = label.Center;
  //         }

  //     }

  // }

  // static CalculateAttachedSegmentEnd(label: GeomLabel, edge: GeomEdge) {
  //     label.AttachmentSegmentEnd = edge.Curve[edge.Curve.ClosestParameter(label.Center)];
  // }

  // ///      drags elements by the delta

  // ///  <param name="delta"></param>
  // ///  <param name="draggingMode">describes the way we process the dragging </param>
  // ///  <param name="lastMousePosition">the last position of the mouse pointer </param>
  // private /* internal */ Drag(delta: Point, draggingMode: DraggingMode, lastMousePosition: Point) {
  //     this.GraphBoundingBoxGetsExtended = false;
  //     if (((delta.X != 0)
  //                 || (delta.Y != 0))) {
  //         if ((this.EditedEdge == null)) {
  //             if (((this.EdgeRoutingMode != this.EdgeRoutingMode.Rectilinear)
  //                         && (this.EdgeRoutingMode != this.EdgeRoutingMode.RectilinearToCenter))) {
  //                 this.DragObjectsForNonRectilinearCase(delta, draggingMode);
  //             }
  //             else {
  //                 this.DragObjectsForRectilinearCase(delta);
  //             }

  //         }
  //         else {
  //             this.DragEdgeEdit(lastMousePosition, delta);
  //             this.UpdateGraphBoundingBoxWithCheck(this.EditedEdge);
  //         }

  //     }

  // }

  // DragObjectsForRectilinearCase(delta: Point) {
  //     for (let node: GeomNode in this.objectsToDrag.Where(() => {  }, (n instanceof  GeomNode))) {
  //         node.Center = (node.Center + delta);
  //     }

  //     RectilinearInteractiveEditor.CreatePortsAndRouteEdges((this.LayoutSettings.NodeSeparation / 3), 1, this.graph.Nodes, this.graph.Edges, this.LayoutSettings.EdgeRoutingSettings.EdgeRoutingMode, true, this.LayoutSettings.EdgeRoutingSettings.UseObstacleRectangles, this.LayoutSettings.EdgeRoutingSettings.BendPenalty);
  //     (new EdgeLabelPlacement(this.graph) + Run());
  //     for (let e: GeomEdge in this.Graph.Edges) {
  //         this.UpdateGraphBoundingBoxWithCheck(e);
  //     }

  //     for (let n: GeomNode in this.Graph.Nodes) {
  //         this.UpdateGraphBoundingBoxWithCheck(n);
  //     }

  //     for (let node in this.objectsToDrag.OfType<Cluster>()) {
  //         node.DeepContentsTranslation(delta, false);
  //         node.RectangularBoundary.TranslateRectangle(delta);
  //     }

  //     this.PropagateChangesToClusterParents();
  // }

  // DragObjectsForNonRectilinearCase(delta: Point, draggingMode: DraggingMode) {
  //     if ((draggingMode == DraggingMode.Incremental)) {
  //         this.DragIncrementally(delta);
  //     }
  //     else if (((this.EdgeRoutingMode == this.EdgeRoutingMode.Spline)
  //                 || (this.EdgeRoutingMode == this.EdgeRoutingMode.SplineBundling))) {
  //         this.DragWithSplinesOrBundles(delta);
  //     }
  //     else {
  //         this.DragWithStraightLines(delta);
  //     }

  // }

  // DragWithStraightLines(delta: Point) {
  //     for (let geomObj in this.objectsToDrag) {
  //         let node = (<GeomNode>(geomObj));
  //         if ((node != null)) {
  //             node.Center = (node.Center + delta);
  //             let cl = (<Cluster>(node));
  //             if ((cl != null)) {
  //                 cl.DeepContentsTranslation(delta, /* translateEdges:*/ false);
  //                 cl.RectangularBoundary.TranslateRectangle(delta);
  //             }

  //         }
  //         else {
  //             GeometryGraphEditor.ShiftDragEdge(delta, geomObj);
  //         }

  //         this.UpdateGraphBoundingBoxWithCheck(geomObj);
  //     }

  //     this.PropagateChangesToClusterParents();
  //     this.DragEdgesAsStraighLines(delta);
  // }

  // PropagateChangesToClusterParents() {
  //     let touchedClusters = new Set<Cluster>();
  //     for (let n in this.objectsToDrag) {
  //         let node = (<GeomNode>(n));
  //         if ((node == null)) {
  //             // TODO: Warning!!! continue If
  //         }

  //         for (let c in node.AllClusterAncestors) {
  //             if (((c != this.graph.RootCluster)
  //                         && !this.objectsToDrag.Contains(c))) {
  //                 touchedClusters.Insert(c);
  //             }

  //         }

  //     }

  //     if (touchedClusters.Any()) {
  //         for (let c in this.graph.RootCluster.AllClustersDepthFirstExcludingSelf()) {
  //             if (touchedClusters.Contains(c)) {
  //                 c.CalculateBoundsFromChildren(this.layoutSettings.ClusterMargin);
  //             }

  //         }

  //     }

  // }

  // static ShiftDragEdge(delta: Point, geomObj: GeomObject) {
  //     let edge = (<GeomEdge>(geomObj));
  //     if ((edge != null)) {
  //         edge.Translate(delta);
  //     }
  //     else {
  //         let label = (<GeomLabel>(geomObj));
  //         if ((label != null)) {
  //             GeometryGraphEditor.DragLabel(label, delta);
  //         }
  //         else {
  //             throw new NotImplementedException();
  //         }

  //     }

  // }

  // DragWithSplinesOrBundles(delta: Point) {
  //     for (let geomObj: GeomObject in this.objectsToDrag) {
  //         let node = (<GeomNode>(geomObj));
  //         if ((node != null)) {
  //             node.Center = (node.Center + delta);
  //         }

  //     }

  //     this.RunSplineRouterAndPutLabels();
  // }

  // RunSplineRouterAndPutLabels() {
  //     let router = new SplineRouter(this.graph, this.LayoutSettings.EdgeRoutingSettings.Padding, this.LayoutSettings.EdgeRoutingSettings.PolylinePadding, this.LayoutSettings.EdgeRoutingSettings.ConeAngle, this.LayoutSettings.EdgeRoutingSettings.BundlingSettings);
  //     router.Run();
  //     let elp = new EdgeLabelPlacement(this.graph);
  //     elp.Run();
  //     this.UpdateGraphBoundingBoxWithCheck();
  // }

  // DragEdgesAsStraighLines(delta: Point) {
  //     for (let edge: GeomEdge in this.edgesDraggedWithSource) {
  //         GeometryGraphEditor.DragEdgeAsStraightLine(delta, edge);
  //     }

  //     for (let edge: GeomEdge in this.edgesDraggedWithTarget) {
  //         GeometryGraphEditor.DragEdgeAsStraightLine(delta, edge);
  //     }

  //     let ep = new EdgeLabelPlacement(this.graph.Nodes, this.edgesDraggedWithSource.Union(this.edgesDraggedWithTarget));
  //     ep.Run();
  // }

  // static DragEdgeAsStraightLine(delta: Point, edge: GeomEdge) {
  //     StraightLineEdges.CreateSimpleEdgeCurveWithUnderlyingPolyline(edge);
  // }

  // UpdateGraphBoundingBoxWithCheck() {
  //     for (let node: GeomNode in this.graph.Nodes) {
  //         this.UpdateGraphBoundingBoxWithCheck(node);
  //     }

  //     for (let edge: GeomEdge in this.graph.Edges) {
  //         this.UpdateGraphBoundingBoxWithCheck(edge);
  //     }

  // }

  // DragIncrementally(delta: Point) {
  //     let box: Rectangle = this.graph.BoundingBox;
  //     if ((this.incrementalDragger == null)) {
  //         this.InitIncrementalDragger();
  //     }

  //     this.incrementalDragger.Drag(delta);
  //     this.GraphBoundingBoxGetsExtended = (box != this.graph.BoundingBox);
  // }

  // DragEdgeEdit(lastMousePosition: Point, delta: Point) {
  //     this.EditedEdge.RaiseLayoutChangeEvent(delta);
  //     let site: Site = GeometryGraphEditor.FindClosestCornerForEdit(this.EditedEdge.UnderlyingPolyline, lastMousePosition);
  //     site.Point = (site.Point + delta);
  //     GeometryGraphEditor.CreateCurveOnChangedPolyline(this.EditedEdge);
  // }

  // ///  <param name="delta">delta of the drag</param>
  // ///  <param name="e">the modified edge</param>
  // ///  <param name="site"></param>
  // private /* internal */ static DragEdgeWithSite(delta: Point, e: GeomEdge, site: Site) {
  //     e.RaiseLayoutChangeEvent(delta);
  //     site.Point = (site.Point + delta);
  //     GeometryGraphEditor.CreateCurveOnChangedPolyline(e);
  // }

  // static CreateCurveOnChangedPolyline(e: GeomEdge) {
  //     let curve: Curve = e.UnderlyingPolyline.CreateCurve();
  //     if (!Arrowheads.TrimSplineAndCalculateArrowheads(e.EdgeGeometry, e.Source.BoundaryCurve, e.Target.BoundaryCurve, curve, false)) {
  //         Arrowheads.CreateBigEnoughSpline(e);
  //     }

  // }

  // ///      prepares for node dragging

  // ///  <param name="markedObjects">markedObjects will be dragged</param>
  // ///  <param name="dragMode"> is shift is pressed then the mode changes </param>
  // ///  <returns></returns>
  // private /* internal */ PrepareForObjectDragging(markedObjects: IEnumerable<GeomObject>, dragMode: DraggingMode) {
  //     this.EditedEdge = null;
  //     this.CalculateDragSets(markedObjects);
  //     this.InsertToListAndSetTheBoxBefore(new ObjectDragUndoRedoAction(this.graph));
  //     if ((dragMode == DraggingMode.Incremental)) {
  //         this.InitIncrementalDragger();
  //     }

  // }

  // InitIncrementalDragger() {
  //     this.incrementalDragger = new IncrementalDragger(this.objectsToDrag.OfType<GeomNode>().ToArray(), this.graph, this.layoutSettings);
  // }

  // ClearDraggedSets() {
  //     this.objectsToDrag.Clear();
  //     this.edgesDraggedWithSource.Clear();
  //     this.edgesDraggedWithTarget.Clear();
  // }

  // CalculateDragSets(markedObjects: IEnumerable<GeomObject>) {
  //     this.ClearDraggedSets();
  //     for (let geometryObject: GeomObject in markedObjects) {
  //         this.objectsToDrag.Insert(geometryObject);
  //         let edge = (<GeomEdge>(geometryObject));
  //         if ((edge != null)) {
  //             this.objectsToDrag.Insert(edge.Source);
  //             this.objectsToDrag.Insert(edge.Target);
  //         }

  //     }

  //     this.RemoveClusterSuccessorsFromObjectsToDrag();
  //     this.CalculateDragSetsForEdges();
  // }

  // RemoveClusterSuccessorsFromObjectsToDrag() {
  //     let listToRemove = new List<GeomNode>();
  //     for (let node in this.objectsToDrag.OfType<GeomNode>()) {
  //         if (node.AllClusterAncestors.Any(() => {  }, this.objectsToDrag.Contains(anc))) {
  //             listToRemove.Add(node);
  //         }

  //     }

  //     for (let node in listToRemove) {
  //         this.objectsToDrag.Remove(node);
  //     }

  // }

  // UpdateGraphBoundingBoxWithCheck(geomObj: GeomObject) {
  //     let cl = (<Cluster>(geomObj));
  //     let bBox: Rectangle = cl.BoundaryCurve.BoundingBox;
  //     // TODO: Warning!!!, inline IF is not supported ?
  //     (cl != null);
  //     geomObj.BoundingBox;
  //     let edge = (<GeomEdge>(geomObj));
  //     if (((edge != null)
  //                 && (edge.Label != null))) {
  //         bBox.Add(edge.Label.BoundingBox);
  //     }

  //     let p = new Point((this.Graph.Margins * -1), this.Graph.Margins);
  //     #if (SHARPKIT)
  //     let bounds: Rectangle = this.Graph.BoundingBox.Clone();
  //     #else
  //     let bounds: Rectangle = this.Graph.BoundingBox;
  //     #endif
  //     this.GraphBoundingBoxGetsExtended = (this.GraphBoundingBoxGetsExtended | bounds.AddWithCheck((bBox.LeftTop + p)));
  //     this.GraphBoundingBoxGetsExtended = (this.GraphBoundingBoxGetsExtended | bounds.AddWithCheck((bBox.RightBottom - p)));
  //     this.Graph.BoundingBox = bounds;
  // }

  // CalculateDragSetsForEdges() {
  //     for (let geomObj: GeomObject in this.objectsToDrag.Clone()) {
  //         let node = (<GeomNode>(geomObj));
  //         if ((node != null)) {
  //             this.AssignEdgesOfNodeToEdgeDragSets(node);
  //         }

  //     }

  // }

  // AssignEdgesOfNodeToEdgeDragSets(node: GeomNode) {
  //     for (let edge: GeomEdge in node.SelfEdges) {
  //         this.objectsToDrag.Insert(edge);
  //     }

  //     for (let edge: GeomEdge in node.InEdges) {
  //         if ((this.objectsToDrag.Contains(edge.Source)
  //                     || ((edge.Source.ClusterParent != null)
  //                     && this.objectsToDrag.Contains(edge.Source.ClusterParent)))) {
  //             this.objectsToDrag.Insert(edge);
  //         }
  //         else {
  //             this.edgesDraggedWithTarget.Insert(edge);
  //         }

  //     }

  //     for (let edge: GeomEdge in node.OutEdges) {
  //         if ((this.objectsToDrag.Contains(edge.Target)
  //                     || ((edge.Target.ClusterParent != null)
  //                     && this.objectsToDrag.Contains(edge.Target.ClusterParent)))) {
  //             this.objectsToDrag.Insert(edge);
  //         }
  //         else {
  //             this.edgesDraggedWithSource.Insert(edge);
  //         }

  //     }

  //     GeometryGraphEditor.CalculateOffsetsForMultiedges(node, this.LayoutSettings.NodeSeparation);
  //     let cl = (<Cluster>(node));
  //     if ((cl != null)) {
  //         for (let n in cl.AllSuccessorsWidthFirst()) {
  //             this.AssignEdgesOfNodeToEdgeDragSets(n);
  //         }

  //     }

  // }

  // private /* internal */ static CalculateOffsetsForMultiedges(node: GeomNode, nodeSeparation: number): Dictionary<GeomEdge, number> {
  //     let offsetsInsideOfMultiedge = new Dictionary<GeomEdge, number>();
  //     for (let multiedge in GeometryGraphEditor.GetMultiEdges(node)) {
  //         GeometryGraphEditor.CalculateMiddleOffsetsForMultiedge(multiedge, node, offsetsInsideOfMultiedge, nodeSeparation);
  //     }

  //     return offsetsInsideOfMultiedge;
  // }

  // static CalculateMiddleOffsetsForMultiedge(multiedge: List<GeomEdge>, node: GeomNode, offsetsInsideOfMultiedge: Dictionary<GeomEdge, number>, nodeSeparation: number) {
  //     let middleAngles: Dictionary<GeomEdge, number> = GeometryGraphEditor.GetMiddleAnglesOfMultiedge(multiedge, node);
  //     let angles = new Array(middleAngles.Count);
  //     let edges = new Array(middleAngles.Count);
  //     let i: number = 0;
  //     for (let v in middleAngles) {
  //         angles[i] = v.Value;
  //         edges[i] = v.Key;
  //         i++;
  //     }

  //     Array.Sort(angles, edges);
  //     let separation: number = (nodeSeparation * 6);
  //     let k: number = (edges.Length / 2);
  //     let even: boolean = ((k * 2)
  //                 == edges.Length);
  //     let off: number;
  //     if (even) {
  //         off = ((separation / 2)
  //                     * -1);
  //         for (let j: number = (k - 1); (j >= 0); j--) {
  //             let edge: GeomEdge = edges[j];
  //             offsetsInsideOfMultiedge[edge] = off;
  //             off = (off
  //                         - (separation + edge.Label.Width));
  //             // TODO: Warning!!!, inline IF is not supported ?
  //             (edge.Label != null);
  //             0;
  //         }

  //         off = (separation / 2);
  //         for (let j: number = k; (j < edges.Length); j++) {
  //             let edge: GeomEdge = edges[j];
  //             offsetsInsideOfMultiedge[edge] = off;
  //             off = (off
  //                         + (separation + edge.Label.Width));
  //             // TODO: Warning!!!, inline IF is not supported ?
  //             (edge.Label != null);
  //             0;
  //         }

  //     }
  //     else {
  //         off = 0;
  //         for (let j: number = k; (j >= 0); j--) {
  //             let edge: GeomEdge = edges[j];
  //             offsetsInsideOfMultiedge[edge] = off;
  //             off = (off
  //                         - (separation + edge.Label.Width));
  //             // TODO: Warning!!!, inline IF is not supported ?
  //             (edge.Label != null);
  //             0;
  //         }

  //         off = separation;
  //         for (let j: number = (k + 1); (j < edges.Length); j++) {
  //             let edge: GeomEdge = edges[j];
  //             offsetsInsideOfMultiedge[edge] = off;
  //             off = (off
  //                         + (separation + edge.Label.Width));
  //             // TODO: Warning!!!, inline IF is not supported ?
  //             (edge.Label != null);
  //             0;
  //         }

  //     }

  // }

  // static GetMiddleAnglesOfMultiedge(multiedge: List<GeomEdge>, node: GeomNode): Dictionary<GeomEdge, number> {
  //     let ret = new Dictionary<GeomEdge, number>();
  //     let firstEdge: GeomEdge = multiedge[0];
  //     let a: Point = node.Center;
  //     let b: Point = GeometryGraphEditor.Middle(firstEdge.Curve);
  //     ret[firstEdge] = 0;
  //     for (let i: number = 1; (i < multiedge.Count); i++) {
  //         let edge: GeomEdge = multiedge[i];
  //         let c: Point = GeometryGraphEditor.Middle(edge.Curve);
  //         let angle: number = Point.Angle(b, a, c);
  //         if ((angle > Math.PI)) {
  //             angle = (angle
  //                         - (Math.PI * 2));
  //         }

  //         ret[edge] = angle;
  //     }

  //     return ret;
  // }

  // static Middle(iCurve: ICurve): Point {
  //     return iCurve[(iCurve.ParStart + (0.5
  //                 * (iCurve.ParEnd - iCurve.ParStart)))];
  // }

  // static GetMultiEdges(node: GeomNode): IEnumerable<List<GeomEdge>> {
  //     let nodeToMultiEdge = new Dictionary<GeomNode, List<GeomEdge>>();
  //     for (let edge: GeomEdge in node.OutEdges) {
  //         GeometryGraphEditor.GetOrCreateListOfMultiedge(nodeToMultiEdge, edge.Target).Add(edge);
  //     }

  //     for (let edge: GeomEdge in node.InEdges) {
  //         GeometryGraphEditor.GetOrCreateListOfMultiedge(nodeToMultiEdge, edge.Source).Add(edge);
  //     }

  //     for (let list in nodeToMultiEdge.Values) {
  //         if ((list.Count > 1)) {
  //             yield;
  //         }

  //     }

  //     return list;
  // }

  // static GetOrCreateListOfMultiedge(nodeToMultiEdge: Dictionary<GeomNode, List<GeomEdge>>, node: GeomNode): List<GeomEdge> {
  //     let list: List<GeomEdge>;
  //     if (nodeToMultiEdge.TryGetValue(node, /* out */list)) {
  //         return list;
  //     }

  //     return;
  // }

  // private /* internal */ InsertToListAndSetTheBoxBefore(action: UndoRedoAction): UndoRedoAction {
  //     this.UndoRedoActionsList.AddAction(action);
  //     action.GraphBoundingBoxBefore = action.Graph.BoundingBox;
  //     this.RaiseChangeInUndoList();
  //     return action;
  // }

  // RaiseChangeInUndoList() {
  //     if ((ChangeInUndoRedoList != null)) {
  //         ChangeInUndoRedoList(this, null);
  //     }

  // }

  // ///      preparing for an edge corner dragging

  // ///  <param name="geometryEdge"></param>
  // ///  <param name="site"></param>
  // ///  <returns></returns>
  // public PrepareForEdgeCornerDragging(geometryEdge: GeomEdge, site: Site): UndoRedoAction {
  //     this.EditedEdge = geometryEdge;
  //     let edgeDragUndoRedoAction: UndoRedoAction = this.CreateEdgeEditUndoRedoAction();
  //     //             var edgeRestoreDate = (EdgeRestoreData) edgeDragUndoRedoAction.GetRestoreData(geometryEdge);
  //     //             edgeRestoreDate.Site = site;
  //     return this.InsertToListAndSetTheBoxBefore(edgeDragUndoRedoAction);
  // }

  // ///      prepares for the polyline corner removal

  // ///  <param name="affectedEdge"></param>
  // ///  <param name="site"></param>
  // ///  <returns></returns>
  // @SuppressMessage("Microsoft.Naming", "CA1704:IdentifiersShouldBeSpelledCorrectly", MessageId="Polyline")
  // public PrepareForPolylineCornerRemoval(affectedEdge: IViewerObject, site: Site): UndoRedoAction {
  //     let action = new SiteRemoveUndoAction(this.EditedEdge);
  //     action.AddAffectedObject(affectedEdge);
  //     return this.InsertToListAndSetTheBoxBefore(action);
  // }

  // ///      prepare for polyline corner insertion

  // ///  <param name="affectedObj">edited objects</param>
  // ///  <param name="site">the site to insert</param>
  // ///  <returns></returns>
  // private /* internal */ PrepareForPolylineCornerInsertion(affectedObj: IViewerObject, site: Site): UndoRedoAction {
  //     let action = new SiteInsertUndoAction(this.EditedEdge);
  //     action.AddAffectedObject(affectedObj);
  //     return this.InsertToListAndSetTheBoxBefore(action);
  // }

  // CreateEdgeEditUndoRedoAction(): UndoRedoAction {
  //     return new EdgeDragUndoRedoAction(this.EditedEdge);
  // }

  // ///      Undoes the last editing.

  // public Undo() {
  //     if (this.CanUndo) {
  //         this.UndoRedoActionsList.CurrentUndo.Undo();
  //         this.UndoRedoActionsList.CurrentRedo = this.UndoRedoActionsList.CurrentUndo;
  //         this.UndoRedoActionsList.CurrentUndo = this.UndoRedoActionsList.CurrentUndo.Previous;
  //         this.RaiseChangeInUndoList();
  //     }

  // }

  // ///      redo the dragging

  // public Redo() {
  //     if (this.CanRedo) {
  //         this.UndoRedoActionsList.CurrentRedo.Redo();
  //         this.UndoRedoActionsList.CurrentUndo = this.UndoRedoActionsList.CurrentRedo;
  //         this.UndoRedoActionsList.CurrentRedo = this.UndoRedoActionsList.CurrentRedo.Next;
  //         this.RaiseChangeInUndoList();
  //     }

  // }

  // ///      clear the editor

  // public Clear() {
  //     this.objectsToDrag = new Set<GeomObject>();
  //     this.edgesDraggedWithSource.Clear();
  //     this.edgesDraggedWithTarget.Clear();
  //     this.UndoRedoActionsList = new UndoRedoActionsList();
  //     this.EditedEdge = null;
  // }

  // ///      gets the enumerator pointing to the polyline corner before the point

  // ///  <param name="edge"></param>
  // ///  <param name="point"></param>
  // ///  <returns></returns>
  // public static GetPreviousSite(edge: GeomEdge, point: Point): Site {
  //     let prevSite: Site = edge.UnderlyingPolyline.HeadSite;
  //     let nextSite: Site = prevSite.Next;
  //     for (
  //     ; (nextSite != null);
  //     ) {
  //         if (GeometryGraphEditor.BetweenSites(prevSite, nextSite, point)) {
  //             return prevSite;
  //         }

  //         prevSite = nextSite;
  //         nextSite = nextSite.Next;
  //     }

  //     return null;
  // }

  // static BetweenSites(prevSite: Site, nextSite: Site, point: Point): boolean {
  //     let par: number = Point.ClosestParameterOnLineSegment(point, prevSite.Point, nextSite.Point);
  //     return ((par > 0.1)
  //                 && (par < 0.9));
  // }

  // ///      insert a polyline corner

  // ///  <param name="edge"></param>
  // ///  <param name="point">the point to insert the corner</param>
  // ///  <param name="siteBeforeInsertion"></param>
  // ///  <param name="affectedEntity">an object to be stored in the undo action</param>
  // public InsertSite(edge: GeomEdge, point: Point, siteBeforeInsertion: Site, affectedEntity: IViewerObject) {
  //     this.EditedEdge = edge;
  //     // creating the new site
  //     let first: Site = siteBeforeInsertion;
  //     let second: Site = first.Next;
  //     let s = new Site(first, point, second);
  //     this.PrepareForPolylineCornerInsertion(affectedEntity, s);
  //     // just to recalc everything in a correct way
  //     GeometryGraphEditor.DragEdgeWithSite(new Point(0, 0), edge, s);
  // }

  // ///      deletes the polyline corner

  // ///  <param name="edge"></param>
  // ///  <param name="site"></param>
  // ///  <param name="userData">an object to be stored in the unde action</param>
  // public DeleteSite(edge: GeomEdge, site: Site, userData: IViewerObject) {
  //     this.EditedEdge = edge;
  //     this.PrepareForPolylineCornerRemoval(userData, site);
  //     site.Previous.Next = site.Next;
  //     // removing the site from the list
  //     site.Next.Previous = site.Previous;
  //     // just to recalc everything in a correct way
  //     GeometryGraphEditor.DragEdgeWithSite(new Point(0, 0), edge, site.Previous);
  // }

  // ///      finds the polyline corner near the mouse position

  // ///  <param name="underlyingPolyline"></param>
  // ///  <param name="mousePoint"></param>
  // ///  <param name="tolerance"></param>
  // ///  <returns></returns>
  // @SuppressMessage("Microsoft.Naming", "CA1704:IdentifiersShouldBeSpelledCorrectly", MessageId="Polyline")
  // public static FindCornerForEdit(underlyingPolyline: SmoothedPolyline, mousePoint: Point, tolerance: number): Site {
  //     let site: Site = underlyingPolyline.HeadSite.Next;
  //     tolerance = (tolerance * tolerance);
  //     // square the tolerance
  //     for (
  //     ; (site.Next != null);
  //     ) {
  //         if (((site.Previous == null)
  //                     || (site.Next == null))) {
  //             // TODO: Warning!!! continue If
  //         }

  //         // don't return the first and the last corners
  //         let diff: Point = (mousePoint - site.Point);
  //         if (((diff * diff)
  //                     <= tolerance)) {
  //             return site;
  //         }

  //         site = site.Next;
  //     }

  //     return null;
  // }

  // ///      finds the polyline corner near the mouse position

  // ///  <param name="underlyingPolyline"></param>
  // ///  <param name="mousePoint"></param>
  // ///  <returns></returns>
  // @SuppressMessage("Microsoft.Naming", "CA1704:IdentifiersShouldBeSpelledCorrectly", MessageId="Polyline")
  // static FindClosestCornerForEdit(underlyingPolyline: SmoothedPolyline, mousePoint: Point): Site {
  //     let site = underlyingPolyline.HeadSite.Next;
  //     let bestSite = site;
  //     let dist = (bestSite.Point - mousePoint).LengthSquared;
  //     while ((site.Next != null)) {
  //         site = site.Next;
  //         let d = (mousePoint - site.Point).LengthSquared;
  //         if ((d < dist)) {
  //             bestSite = site;
  //             dist = d;
  //         }

  //     }

  //     return bestSite;
  // }

  // ///      creates a "tight" bounding box

  // ///  <param name="affectedEntity">the object corresponding to the graph</param>
  // ///  <param name="geometryGraph"></param>
  // public FitGraphBoundingBox(affectedEntity: IViewerObject, geometryGraph: GeomGraph) {
  //     if ((geometryGraph != null)) {
  //         let uAction = new UndoRedoAction(geometryGraph);
  //         this.UndoRedoActionsList.AddAction(uAction);
  //         let r = new Rectangle();
  //         for (let n: GeomNode in geometryGraph.Nodes) {
  //             r = n.BoundingBox;
  //             break;
  //         }

  //         for (let n: GeomNode in geometryGraph.Nodes) {
  //             r.Add(n.BoundingBox);
  //         }

  //         for (let e: GeomEdge in geometryGraph.Edges) {
  //             r.Add(e.BoundingBox);
  //             if ((e.Label != null)) {
  //                 r.Add(e.Label.BoundingBox);
  //             }

  //         }

  //         r.Left = (r.Left - geometryGraph.Margins);
  //         r.Top = (r.Top + geometryGraph.Margins);
  //         r.Bottom = (r.Bottom - geometryGraph.Margins);
  //         r.Right = (r.Right + geometryGraph.Margins);
  //         uAction.ClearAffectedObjects();
  //         uAction.AddAffectedObject(affectedEntity);
  //         geometryGraph.BoundingBox = r;
  //         uAction.GraphBoundingBoxAfter = r;
  //     }

  // }

  // ///  <param name="delta"></param>
  // public OnDragEnd(delta: Point) {
  //     if ((this.CurrentUndoAction != null)) {
  //         let action = this.CurrentUndoAction;
  //         action.GraphBoundingBoxAfter = action.Graph.BoundingBox;
  //     }

  // }

  // private /* internal */ ReactOnViewChange() {
  //     this.LgLayoutSettings.Interactor.RunOnViewChange();
  // }

  // private /* internal */ ForgetDragging() {
  //     this.incrementalDragger = null;
  // }

  // ///

  // ///  <param name="changedClusters"></param>
  // public PrepareForClusterCollapseChange(changedClusters: IEnumerable<IViewerNode>) {
  //     this.InsertToListAndSetTheBoxBefore(new ClustersCollapseExpandUndoRedoAction(this.graph));
  //     for (let iCluster in changedClusters) {
  //         this.CurrentUndoAction.AddAffectedObject(iCluster);
  //     }

  // }
}

///

// export class ClustersCollapseExpandUndoRedoAction extends UndoRedoAction {

//     ///

//     ///  <param name="geometryGraph"></param>
//     public constructor (geometryGraph: GeomGraph) :
//             base(geometryGraph) {

//     }
// }
