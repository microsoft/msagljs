// import { Polyline, Point, Curve, Rectangle, LineSegment, ICurve, PointLocation } from "../../math/geometry";
// import { CornerSite } from "../../math/geometry/cornerSite";
// import { PlaneTransformation } from "../../math/geometry/planeTransformation";
// import { SmoothedPolyline } from "../../math/geometry/smoothedPolyline";
// import { EdgeRoutingMode } from "../../routing/EdgeRoutingMode";
// import { InteractiveEdgeRouter } from "../../routing/InteractiveEdgeRouter";
// import { RectilinearInteractiveEditor } from "../../routing/rectilinear/RectilinearInteractiveEditor";
// import { StraightLineEdges } from "../../routing/StraightLineEdges";
// import { Edge } from "../../structs/edge";
// import { Graph } from "../../structs/graph";
// import { GeomEdge, GeomGraph } from "../core";
// import { Arrowhead } from "../core/arrowhead";
// import { CurvePort } from "../core/curvePort";
// import { FloatingPort } from "../core/floatingPort";
// import { GeomObject } from "../core/geomObject";
// import { Port } from "../core/port";
// import { EdgeLabelPlacement } from "../edgeLabelPlacement";
// import { GeometryGraphEditor } from "./geomGraphEditor";
// import { IViewer } from "./iViewer";
// import { IViewerEdge } from "./iViewerEdge";
// import { IViewerNode } from "./iViewerNode";
// import { IViewerObject, getViewerObject } from "./iViewerObject";
// import { ModifierKeys } from "./modifierKeys";
// import { MouseButtons } from "./mouseButtons";
// import { ObjectUnderMouseCursorChangedEventArgs, EventArgs } from "./objectUnderMouseCursorChangedEventArgs";
// import { PolylineCornerType } from "./polylineCornerType";
// import { Relayout } from "./relayout";
// import { UndoRedoAction } from "./undoRedoAction";
// type DelegateForIViewerObject = (IViewerObject) =>void
// type DelegateForEdge = (Edge)=>void
// type MouseAndKeysAnalyzer = ( modifierKeys:ModifierKeys,  mouseButtons:MouseButtons, dragging:boolean) => void

// export class LayoutEditor {
//     aActiveDraggedObject: IViewerObject;
//     polylineVertex: CornerSite;
//     geomEdge: GeomEdge;
//     interactiveEdgeRouter: InteractiveEdgeRouter;
//     selectedEdge: IViewerEdge;
//     mouseDownScreenPoint: Point;
//     mouseButtons: MouseButtons;

//      get ActiveDraggedObject(): IViewerObject {
//         return this.aActiveDraggedObject
//     }
//      set ActiveDraggedObject(value: IViewerObject)  {
//         this.aActiveDraggedObject = value
//     }

//      get PolylineVertex(): CornerSite {
//         return this.polylineVertex
//     }
//      set PolylineVertex(value: CornerSite)  {
//         this.polylineVertex= value
//     }

//     cornerInfo: [CornerSite, PolylineCornerType];

//     decoratorRemovalsDict: Map<IViewerObject, ()=>void> = new Map<IViewerObject, ()=>void>();

//     dragGroup: Set<IViewerObject> = new Set<IViewerObject>();

//     geomGraphEditor: GeometryGraphEditor = new GeometryGraphEditor();

//     graph: Graph;

//     looseObstaclesToTheirViewerNodes: Map<Polyline, Array<IViewerNode>>;

//     mouseDownGraphPoint: Point;

//     mouseMoveThreshold: number = 0.05;

//     mouseRightButtonDownPoint: Point;

//     removeEdgeDraggingDecorations: DelegateForEdge;

//     sourceLoosePolyline: Polyline;

//     sourceOfInsertedEdge: IViewerNode;

//     sourcePort: Port;

//     targetOfInsertedEdge: IViewerNode;

//     targetPort: Port;

//     viewer: IViewer;

//     get GeomEdge(): GeomEdge {
//         return this.geomEdge
//     }
//     set GeomEdge(value: GeomEdge)  {
//         this.geomEdge = value
//     }

//     get InteractiveEdgeRouter(): InteractiveEdgeRouter {
//         return this.interactiveEdgeRouter
//     }
//     set InteractiveEdgeRouter(value: InteractiveEdgeRouter)  {
//         this.interactiveEdgeRouter = value
//     }

//     ///  <summary>
//     ///  Constructor
//     ///  </summary>
//     ///  <param name="viewerPar">the viewer that the editor communicates with</param>
//      constructor (viewerPar: IViewer) {
//         this.viewer = viewerPar;
//         this.HookUpToViewerEvents();
//         this.ToggleEntityPredicate =(modifierKeys, mouseButtons, draggingParameter) => LayoutEditor.LeftButtonIsPressed(mouseButtons);
//         this.NodeInsertPredicate = (modifierKeys, mouseButtons, draggingParameter) =>
//              LayoutEditor.MiddleButtonIsPressed(mouseButtons) && draggingParameter == false;

//         this.DecorateObjectForDragging = this.TheDefaultObjectDecorator;
//         this.RemoveObjDraggingDecorations = this.TheDefaultObjectDecoratorRemover;
//         this.DecorateEdgeForDragging = LayoutEditor.TheDefaultEdgeDecoratorStub;
//         this.DecorateEdgeLabelForDragging = LayoutEditor.TheDefaultEdgeLabelDecoratorStub;
//         this.RemoveEdgeDraggingDecorations = LayoutEditor.TheDefaultEdgeDecoratorStub;
//         this.geomGraphEditor.ChangeInUndoRedoList.subscribe(this.LayoutEditorChangeInUndoRedoList);
//     }

//     HookUpToViewerEvents() {
//         this.viewer.MouseDown.subscribe(this.ViewerMouseDown);
//         this.viewer.MouseMove.subscribe(this.ViewerMouseMove);
//         this.viewer.MouseUp.subscribe(this.ViewerMouseUp);
//         this.viewer.ObjectUnderMouseCursorChanged.subscribe(this.ViewerObjectUnderMouseCursorChanged);
//         this.viewer.GraphChanged.subscribe(this.ViewerGraphChanged);
//         this.viewer.ViewChangeEvent.subscribe(this.ViewChangeEventHandler);
//     }

//     ViewerObjectUnderMouseCursorChanged(sender:any, e:ObjectUnderMouseCursorChangedEventArgs) {
//             if (this.TargetPort != null) {
//                 this.viewer.RemoveTargetPortEdgeRouting();
//                 this.TargetPort = null;
//             }
//     }

//     ViewChangeEventHandler(sender: Object, e: any) {
//         if ((this.graph == null)) {
//             return;
//         }
//     }

//     ///  <summary>
//     ///  current graph of under editin
//     ///  </summary>
//      get Graph(): Graph {
//         return this.graph;
//     }
//      set Graph(value: Graph)  {
//         this.graph = value;
//         if ((this.graph != null)) {
//             this.geomGraphEditor.graph = GeomGraph.getGeom(this.graph)

//         }

//     }

//     ///  <summary>
//     ///  the current selected edge
//     ///  </summary>
//      get SelectedEdge(): IViewerEdge {
//         return this.selectedEdge
//     }
//      set SelectedEdge(value: IViewerEdge)  {
//         this.selectedEdge=value;
//     }

//     ///  <summary>
//     ///  If the distance between the mouse down point and the mouse up point is greater than the threshold
//     ///  then we have a mouse move. Otherwise we have a click.
//     ///  </summary>
//      get MouseMoveThreshold(): number {
//         return this.mouseMoveThreshold;
//     }
//      set MouseMoveThreshold(value: number)  {
//         this.mouseMoveThreshold = value;
//     }

//     ///  <summary>
//     ///  the delegate to decide if an entity is dragged or we just zoom of the viewer
//     ///  </summary>
//      private toggleEntityPredicate: MouseAndKeysAnalyzer;
//     public get ToggleEntityPredicate(): MouseAndKeysAnalyzer {
//         return this.toggleEntityPredicate;
//     }
//     public set ToggleEntityPredicate(value: MouseAndKeysAnalyzer) {
//         this.toggleEntityPredicate = value;
//     }

//     private dragging: boolean;
//     public get Dragging(): boolean {
//         return this.dragging;
//     }
//     public set Dragging(value: boolean) {
//         this.dragging = value;
//     }

//     get MouseDownScreenPoint(): Point {
//         return this.mouseDownScreenPoint;
//     }
//     set MouseDownScreenPoint(value: Point)  {
//         this.mouseDownScreenPoint = value
//     }

//     ///  <summary>
//     ///  current pressed mouse buttons
//     ///  </summary>
//      get PressedMouseButtons(): MouseButtons {
//        return this.mouseButtons
//     }
//      set PressedMouseButtons(value: MouseButtons)  {
//         this.mouseButtons = value
//     }

//     ///  <summary>
//     ///  a delegate to decorate a node for dragging
//     ///  </summary>
//      private decorateObjectForDragging: DelegateForIViewerObject;
//     public get DecorateObjectForDragging(): DelegateForIViewerObject {
//         return this.decorateObjectForDragging;
//     }
//     public set DecorateObjectForDragging(value: DelegateForIViewerObject) {
//         this.decorateObjectForDragging = value;
//     }

//     ///  <summary>
//     ///  a delegate decorate an edge for editing
//     ///  </summary>
//      private decorateEdgeForDragging: DelegateForEdge;
//     public get DecorateEdgeForDragging(): DelegateForEdge {
//         return this.decorateEdgeForDragging;
//     }
//     public set DecorateEdgeForDragging(value: DelegateForEdge) {
//         this.decorateEdgeForDragging = value;
//     }

//     ///  <summary>
//     ///  a delegate decorate a label for editing
//     ///  </summary>
//      private decorateEdgeLabelForDragging: DelegateForIViewerObject;
//     public get DecorateEdgeLabelForDragging(): DelegateForIViewerObject {
//         return this.decorateEdgeLabelForDragging;
//     }
//     public set DecorateEdgeLabelForDragging(value: DelegateForIViewerObject) {
//         this.decorateEdgeLabelForDragging = value;
//     }
//     ///  <summary>
//     ///  a delegate to remove node decorations
//     ///  </summary>
//      private removeObjDraggingDecorations: DelegateForIViewerObject;
//     public get RemoveObjDraggingDecorations(): DelegateForIViewerObject {
//         return this.removeObjDraggingDecorations;
//     }
//     public set RemoveObjDraggingDecorations(value: DelegateForIViewerObject) {
//         this.removeObjDraggingDecorations = value;
//     }

//     ///  <summary>
//     ///  a delegate to remove edge decorations
//     ///  </summary>
//      get RemoveEdgeDraggingDecorations(): DelegateForEdge {
//         return this.removeEdgeDraggingDecorations;
//     }
//      set RemoveEdgeDraggingDecorations(value: DelegateForEdge)  {
//         this.removeEdgeDraggingDecorations = value;
//     }

//     ///  <summary>
//     ///  The method analysing keys and mouse buttons to decide if we are inserting a node
//     ///  </summary>
//      private nodeInsertPredicate: MouseAndKeysAnalyzer;
//     public get NodeInsertPredicate(): MouseAndKeysAnalyzer {
//         return this.nodeInsertPredicate;
//     }
//     public set NodeInsertPredicate(value: MouseAndKeysAnalyzer) {
//         this.nodeInsertPredicate = value;
//     }

//     private leftMouseButtonWasPressed: boolean;
//     public get LeftMouseButtonWasPressed(): boolean {
//         return this.leftMouseButtonWasPressed;
//     }
//     public set LeftMouseButtonWasPressed(value: boolean) {
//         this.leftMouseButtonWasPressed = value;
//     }

//      get SourceOfInsertedEdge(): IViewerNode {
//         return this.sourceOfInsertedEdge;
//     }
//      set SourceOfInsertedEdge(value: IViewerNode)  {
//         this.sourceOfInsertedEdge = value;
//     }

//      get TargetOfInsertedEdge(): IViewerNode {
//         return this.targetOfInsertedEdge;
//     }
//      set TargetOfInsertedEdge(value: IViewerNode)  {
//         this.targetOfInsertedEdge = value;
//     }

//     get SourcePort(): Port {
//         return this.sourcePort;
//     }
//     set SourcePort(value: Port)  {
//         this.sourcePort = value;
//     }

//     get TargetPort(): Port {
//         return this.targetPort;
//     }
//     set TargetPort(value: Port)  {
//         this.targetPort = value;
//     }

//     ///  <summary>
//     ///  returns true if Undo is available
//     ///  </summary>
//      get CanUndo(): boolean {
//         return this.geomGraphEditor.CanUndo;
//     }

//     ///  <summary>
//     ///  return true if Redo is available
//     ///  </summary>
//      get CanRedo(): boolean {
//         return this.geomGraphEditor.CanRedo;
//     }

//     ///  <summary>
//     ///  If set to true then we are of a mode for node insertion
//     ///  </summary>
//      get InsertingEdge(): boolean {
//         if ((this.viewer == null)) {
//             return false;
//         }

//         return this.viewer.InsertingEdge;
//     }
//      set InsertingEdge(value: boolean)  {
//         if ((this.viewer == null)) {
//             return;
//         }

//         this.viewer.InsertingEdge = value;
//     }

//     ///  <summary>
//     ///  current undo action
//     ///  </summary>
//      get CurrentUndoAction(): UndoRedoAction {
//         return this.geomGraphEditor.UndoMode ? this.geomGraphEditor.CurrentUndoAction : this.geomGraphEditor.CurrentRedoAction;
//     }

//     EdgeAttr:any

//      ViewerGraphChanged(sender: Object, e: any) {
//     const isIViewer = sender.hasOwnProperty('IncrementalDraggingModeAlways')
//     if (isIViewer ) {
//         const iViewer= <IViewer>sender
//         this.graph = iViewer.Graph;
//         if (((this.graph != null)
//                     && GeomGraph.getGeom(this.graph)!= null)) {
//             this.geomGraphEditor.graph = GeomGraph.getGeom(this.graph)
//             this.AttachInvalidateEventsToGeometryObjects();
//         }

//     }

//     this.ActiveDraggedObject = null;
//     this.decoratorRemovalsDict.clear();
//     this.dragGroup.clear();
//     this.CleanObstacles();
// }

// ///  <summary>
// ///
// ///  </summary>
//  CleanObstacles() {
//     this.InteractiveEdgeRouter = null;
//     this.looseObstaclesToTheirViewerNodes = null;
//     this.SourceOfInsertedEdge = null;
//     this.TargetOfInsertedEdge = null;
//     this.SourcePort = null;
//     this.TargetPort = null;
//     this.viewer.RemoveSourcePortEdgeRouting();
//     this.viewer.RemoveTargetPortEdgeRouting();
// }

// AttachInvalidateEventsToGeometryObjects() {
//     for (let entity of this.viewer.Entities) {
//         this.AttachLayoutChangeEvent(entity);
//     }

// }

// ///  <summary>
// ///
// ///  </summary>
// ///  <param name="viewerObject"></param>
//  AttachLayoutChangeEvent(viewerObject: IViewerObject) {
//     let drawingObject = getViewerObject(viewerObject)
//     if (drawingObject != null) {
//         var geom = GeomObject.getGeom(drawingObject.entity);
//         if (geom != null)
//             geom.BeforeLayoutChangeEvent.subscribe((a, b) => this.ReportBeforeChange(viewerObject));
//         if (geom instanceof GeomGraph)
//          {
//             var iViewerNode = <IViewerNode> viewerObject;
//             iViewerNode.IsCollapsedChanged.subscribe(this.RelayoutOnIsCollapsedChanged)
//         }
//     }
//  }

// RelayoutOnIsCollapsedChanged(iCluster: IViewerNode) {
//     this.geomGraphEditor.PrepareForClusterCollapseChange([iCluster])
//     let cluster = GeomGraph.getGeom(iCluster.node as Graph)
//     if (cluster.isCollapsed) {
//         this.CollapseCluster(cluster);
//     }
//     else {
//         this.ExpandCluster(cluster);
//     }

//     // LayoutAlgorithmSettings.ShowGraph(viewer.Graph.GeometryGraph);
//     for (let o: IViewerObject of this.geomGraphEditor.CurrentUndoAction.affectedObjects) {
//         this.viewer.Invalidate(o);
//     }

// }

// /*
//  var relayout = new Relayout(viewer.Graph.GeometryGraph, new[] { cluster }, null, cl =>
//             {
//                 var subgraph = cl.UserData as Subgraph;
//                 if (subgraph != null && subgraph.LayoutSettings != null) return subgraph.LayoutSettings;
//                 return viewer.Graph.LayoutAlgorithmSettings;
//             });
// */
// ExpandCluster(cluster: GeomGraph) {
//     // todo: try to find a better method for expanding, mst tree? Procrustes transofrm
//     let relayout = new Relayout(GeomGraph.getGeom(this.viewer.Graph), [cluster],[], (cl)=>
//            cl.layoutSettings? cl.layoutSettings: GeomGraph.getGeom(this.viewer.Graph).layoutSettings)

//     relayout.run();
//     this.MakeExpandedNodesVisible(cluster);
//     this.MakeExpandedEdgesVisible(cluster);
// }

// MakeExpandedNodesVisible(cluster: Graph) {
//     for (let node of cluster.shallowNodes) {
//         // (<Node>(node.UserData)).IsVisible = true;
//         throw new Error('not implemented')
//     }

//     for (let cl of cluster.Clusters) {
//         (<Node>(cl.UserData)).IsVisible = true;
//         if (!cl.IsCollapsed) {
//             this.MakeExpandedNodesVisible(cl);
//         }

//     }

// }

// MakeExpandedEdgesVisible(cluster: Cluster) {
//     Debug.Assert((cluster.IsCollapsed == false));
//     for (let node of cluster.Nodes) {
//         LayoutEditor.UnhideNodeEdges((<Node>(node.UserData)));
//     }

//     for (let cl of cluster.Clusters) {
//         LayoutEditor.UnhideNodeEdges((<Node>(cl.UserData)));
//         if (!cl.IsCollapsed) {
//             this.MakeExpandedEdgesVisible(cl);
//         }

//     }

// }

// static UnhideNodeEdges(drn: Node) {
//     for (let e of drn.SelfEdges) {
//         e.IsVisible = true;
//     }

//     for (let e of drn.OutEdges.Where(() => {  }, e.TargetNode.IsVisible)) {
//         e.IsVisible = true;
//     }

//     for (let e of drn.InEdges.Where(() => {  }, e.SourceNode.IsVisible)) {
//         e.IsVisible = true;
//     }

// }

// CollapseCluster(cluster: Cluster) {
//     LayoutEditor.HideCollapsed(cluster);
//     let center = cluster.RectangularBoundary.Rect.Center;
//     let del = (center - cluster.CollapsedBoundary.BoundingBox.Center);
//     cluster.CollapsedBoundary.Translate(del);
//     // todo: try to find a better method for collapsing, mst tree?
//     let relayout = new Relayout(this.viewer.Graph.GeometryGraph, new, [);
//     cluster;
//     null;
//     let subgraph = (<Subgraph>(cl.UserData));
//     if (((subgraph != null)
//                 && (subgraph.LayoutSettings != null))) {
//         return subgraph.LayoutSettings;
//     }

//     return this.viewer.Graph.LayoutAlgorithmSettings;
//     relayout.Run();
// }

// static HideCollapsed(cluster: Cluster) {
//     for (let n of cluster.Nodes) {
//         let drawingNode = (<Node>(n.UserData));
//         drawingNode.IsVisible = false;
//     }

//     for (let cl of cluster.Clusters) {
//         let drawingNode = (<Node>(cl.UserData));
//         drawingNode.IsVisible = false;
//         if (!cl.IsCollapsed) {
//             LayoutEditor.HideCollapsed(cl);
//         }

//     }

// }

// ReportBeforeChange(viewerObject: IViewerObject) {
//     if (((this.CurrentUndoAction == null)
//                 || this.CurrentUndoAction.ContainsAffectedObject(viewerObject))) {
//         return;
//     }

//     this.CurrentUndoAction.AddAffectedObject(viewerObject);
//     this.CurrentUndoAction.AddRestoreData(viewerObject.DrawingObject.GeometryObject, RestoreHelper.GetRestoreData(viewerObject.DrawingObject.GeometryObject));
// }

// ///  <summary>
// ///  Unsubscibes from the viewer events
// ///  </summary>
//  DetouchFromViewerEvents() {
//     this.viewer.MouseDown = (this.viewer.MouseDown - this.ViewerMouseDown);
//     this.viewer.MouseMove = (this.viewer.MouseMove - this.ViewerMouseMove);
//     this.viewer.MouseUp = (this.viewer.MouseUp - this.ViewerMouseUp);
//     this.viewer.GraphChanged = (this.viewer.GraphChanged - this.ViewerGraphChanged);
//     this.viewer.ViewChangeEvent = (this.viewer.ViewChangeEvent - this.ViewChangeEventHandler);
//     this.geomGraphEditor.ChangeInUndoRedoList = (this.geomGraphEditor.ChangeInUndoRedoList - this.LayoutEditorChangeInUndoRedoList);
// }

// LayoutEditorChangeInUndoRedoList(sender: Object, e: EventArgs) {
//     if ((ChangeInUndoRedoList != null)) {
//         ChangeInUndoRedoList(this, null);
//     }

// }

// TheDefaultObjectDecorator(obj: IViewerObject) {
//     let node = (<IViewerNode>(obj));
//     if ((node != null)) {
//         let drawingNode = node.node;
//         let w = drawingNode.Attr.LineWidth;
//         if (!this.decoratorRemovalsDict.ContainsKey(node)) {
//             drawingNode.Attr.LineWidth = w;
//         }

//         drawingNode.Attr.LineWidth = (<number>(Math.max(this.viewer.LineThicknessForEditing, (w * 2))));
//     }
//     else {
//         let edge = (<IViewerEdge>(obj));
//         if ((edge != null)) {
//             let drawingEdge = edge.edge;
//             let w = drawingEdge.Attr.LineWidth;
//             if (!this.decoratorRemovalsDict.ContainsKey(edge)) {
//                 drawingEdge.Attr.LineWidth = w;
//             }

//             drawingEdge.Attr.LineWidth = (<number>(Math.max(this.viewer.LineThicknessForEditing, (w * 2))));
//         }

//     }

//     this.viewer.Invalidate(obj);
// }

// TheDefaultObjectDecoratorRemover(obj: IViewerObject) {
//     let decoratorRemover: ()=>void;
//     if (this.decoratorRemovalsDict.TryGetValue(obj, /* out */decoratorRemover)) {
//         decoratorRemover();
//         this.decoratorRemovalsDict.Remove(obj);
//         this.viewer.Invalidate(obj);
//     }

//     let node = (<IViewerNode>(obj));
//     if ((node != null)) {
//         for (let edge of LayoutEditor.Edges(node)) {
//             this.RemoveObjDraggingDecorations(edge);
//         }

//     }

// }

// static TheDefaultEdgeDecoratorStub(edge: IViewerEdge) {

// }

// static TheDefaultEdgeLabelDecoratorStub(label: IViewerObject) {

// }

// static LeftButtonIsPressed(mouseButtons: MouseButtons): boolean {
//     return ((mouseButtons & MouseButtons.Left)
//                 == MouseButtons.Left);
// }

// static MiddleButtonIsPressed(mouseButtons: MouseButtons): boolean {
//     return ((mouseButtons & MouseButtons.Middle)
//                 == MouseButtons.Middle);
// }

// MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(e: MsaglMouseEventArgs): boolean {
//     let x: number = e.X;
//     let y: number = e.Y;
//     let dx: number = ((this.MouseDownScreenPoint.x - x)
//                 / this.viewer.DpiX);
//     let dy: number = ((this.MouseDownScreenPoint.y - y)
//                 / this.viewer.DpiY);
//     return (Math.sqrt(((dx * dx)
//                     + (dy * dy)))
//                 > (this.MouseMoveThreshold / 3));
// }

// AnalyzeLeftMouseButtonClick() {
//     let modifierKeyIsPressed: boolean = this.ModifierKeyIsPressed();
//     let obj: IViewerObject = this.viewer.ObjectUnderMouseCursor;
//     if ((obj != null)) {
//         let editableEdge = (<IViewerEdge>(obj));
//         if ((editableEdge != null)) {
//             let drawingEdge = (<Edge>(editableEdge.DrawingObject));
//             if ((drawingEdge != null)) {
//                 let geomEdge = drawingEdge.GeometryEdge;
//                 if (((geomEdge != null)
//                             && this.viewer.LayoutEditingEnabled)) {
//                     if ((geomEdge.UnderlyingPolyline == null)) {
//                         geomEdge.UnderlyingPolyline = LayoutEditor.CreateUnderlyingPolyline(geomEdge);
//                     }

//                     this.SwitchToEdgeEditing(editableEdge);
//                 }

//             }

//         }
//         else {
//             if (obj.MarkedForDragging) {
//                 this.UnselectObjectForDragging(obj);
//             }
//             else {
//                 if (!modifierKeyIsPressed) {
//                     this.UnselectEverything();
//                 }

//                 this.SelectObjectForDragging(obj);
//             }

//             this.UnselectEdge();
//         }

//     }

// }

// static CreateUnderlyingPolyline(geomEdge: Core.Layout.Edge): SmoothedPolyline {
//     let ret = SmoothedPolyline.mkFromPoints(LayoutEditor.CurvePoints(geomEdge));
//     return ret;
// }

// static CurvePoints(geomEdge: Core.Layout.Edge): IEnumerable<Point> {
//     yield;
//     return geomEdge.Source.Center;
//     let curve = (<Curve>(geomEdge.Curve));
//     if ((curve != null)) {
//         if ((curve.Segments.Count > 0)) {
//             yield;
//         }

//         return curve.start;
//         for (let i: number = 0; (i < curve.Segments.Count); i++) {
//             yield;
//         }

//         return curve.Segments[i].End;
//     }

//     yield;
//     return geomEdge.Target.Center;
// }

// //         static void SetCoefficientsCorrecty(SmoothedPolyline ret, ICurve curve) {
// //            //  throw new NotImplementedException();
// //         }
// ModifierKeyIsPressed(): boolean {
//     let modifierKeyWasUsed: boolean = (((this.viewer.ModifierKeys & ModifierKeys.Control)
//                 == ModifierKeys.Control)
//                 || ((this.viewer.ModifierKeys & ModifierKeys.Shift)
//                 == ModifierKeys.Shift));
//     return modifierKeyWasUsed;
// }

// SwitchToEdgeEditing(edge: IViewerEdge) {
//     this.UnselectEverything();
//     let editableEdge = (<IEditableObject>(edge));
//     if ((editableEdge == null)) {
//         return;
//     }

//     this.SelectedEdge = edge;
//     editableEdge.SelectedForEditing = true;
//     edge.RadiusOfPolylineCorner = this.viewer.UnderlyingPolylineCircleRadius;
//     this.DecorateEdgeForDragging(edge);
//     this.viewer.Invalidate(edge);
// }

// ViewerNodes(): IEnumerable<IViewerNode> {
//     for (let o: IViewerObject of this.viewer.Entities) {
//         let n = (<IViewerNode>(o));
//         if ((n != null)) {
//             yield;
//         }

//         return n;
//     }

// }

// SelectObjectForDragging(obj: IViewerObject) {
//     if ((obj.MarkedForDragging == false)) {
//         obj.MarkedForDragging = true;
//         this.dragGroup.Insert(obj);
//         this.DecorateObjectForDragging(obj);
//     }

// }

// UnselectObjectForDragging(obj: IViewerObject) {
//     this.UnselectWithoutRemovingFromDragGroup(obj);
//     this.dragGroup.Remove(obj);
// }

// UnselectWithoutRemovingFromDragGroup(obj: IViewerObject) {
//     obj.MarkedForDragging = false;
//     this.RemoveObjDraggingDecorations(obj);
// }

// UnselectEverything() {
//     for (let obj: IViewerObject of this.dragGroup) {
//         this.viewer.Invalidate(obj);
//         this.UnselectWithoutRemovingFromDragGroup(obj);
//     }

//     this.dragGroup.clear();
//     this.UnselectEdge();
// }

// UnselectEdge() {
//     if ((this.SelectedEdge != null)) {
//         (<IEditableObject>(this.SelectedEdge)).SelectedForEditing = false;
//         this.removeEdgeDraggingDecorations(this.SelectedEdge);
//         this.viewer.Invalidate(this.SelectedEdge);
//         this.SelectedEdge = null;
//     }

// }

// static Edges(node: IViewerNode): IEnumerable<IViewerEdge> {
//     for (let edge: IViewerEdge of node.SelfEdges) {
//         yield;
//     }

//     return edge;
//     for (let edge: IViewerEdge of node.OutEdges) {
//         yield;
//     }

//     return edge;
//     for (let edge: IViewerEdge of node.InEdges) {
//         yield;
//     }

//     return edge;
// }

// ViewerMouseDown(sender: Object, e: MsaglMouseEventArgs) {
//     if ((!this.viewer.LayoutEditingEnabled
//                 || (this.viewer.Graph == null))) {
//         return;
//     }

//     this.PressedMouseButtons = LayoutEditor.GetPressedButtons(e);
//     this.mouseDownGraphPoint = this.viewer.ScreenToSource(e);
//     this.MouseDownScreenPoint = new Point(e.X, e.Y);
//     if (e.LeftButtonIsPressed) {
//         this.LeftMouseButtonWasPressed = true;
//         if (!this.InsertingEdge) {
//             if (!(this.viewer.ObjectUnderMouseCursor instanceof  IViewerEdge)) {
//                 this.ActiveDraggedObject = this.viewer.ObjectUnderMouseCursor;
//             }

//             if ((this.ActiveDraggedObject != null)) {
//                 e.Handled = true;
//             }

//             if ((this.SelectedEdge != null)) {
//                 this.CheckIfDraggingPolylineVertex(e);
//             }

//         }
//         else if (((this.SourceOfInsertedEdge != null)
//                     && ((this.SourcePort != null)
//                     && this.DraggingStraightLine()))) {
//             this.viewer.StartDrawingRubberLine(this.sourcePort.Location);
//         }

//     }
//     else if (e.RightButtonIsPressed) {
//         if ((this.SelectedEdge != null)) {
//             this.ProcessRightClickOnSelectedEdge(e);
//         }

//     }

// }

// ViewerMouseMove(sender: Object, e: MsaglMouseEventArgs) {
//     if (this.viewer.LayoutEditingEnabled) {
//         if (e.LeftButtonIsPressed) {
//             if (((this.ActiveDraggedObject != null)
//                         || (this.PolylineVertex != null))) {
//                 this.DragSomeObjects(e);
//             }
//             else if (this.InsertingEdge) {
//                 this.MouseMoveWhenInsertingEdgeAndPressingLeftButton(e);
//             }
//             else {
//                 this.MouseMoveLiveSelectObjectsForDragging(e);
//             }

//         }
//         else if (this.InsertingEdge) {
//             this.HandleMouseMoveWhenInsertingEdgeAndNotPressingLeftButton(e);
//         }

//     }

// }

// SetDraggingFlag(e: MsaglMouseEventArgs) {
//     if ((!this.Dragging
//                 && this.MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(e))) {
//         this.Dragging = true;
//     }

// }

// TrySetNodePort(e: MsaglMouseEventArgs, /* ref */node: IViewerNode, /* ref */port: Port, /* out */loosePolyline: Polyline): boolean {
//     Debug.Assert(this.InsertingEdge);
//     let mousePosition: Point = this.viewer.ScreenToSource(e);
//     loosePolyline = null;
//     if ((Graph != null)) {
//         if (this.DraggingStraightLine()) {
//             node = this.SetPortWhenDraggingStraightLine(/* ref */port, /* ref */mousePosition);
//         }
//         else {
//             if ((InteractiveEdgeRouter == null)) {
//                 this.PrepareForEdgeDragging();
//             }

//             loosePolyline = InteractiveEdgeRouter.GetHitLoosePolyline(this.viewer.ScreenToSource(e));
//             if ((loosePolyline != null)) {
//                 this.SetPortUnderLoosePolyline(mousePosition, loosePolyline, /* ref */node, /* ref */port);
//             }
//             else {
//                 node = null;
//                 port = null;
//             }

//         }

//     }

//     return (port != null);
// }

// SetPortWhenDraggingStraightLine(/* ref */port: Port, /* ref */mousePosition: Point): IViewerNode {
//     let viewerNode = (<IViewerNode>(this.viewer.ObjectUnderMouseCursor));
//     if ((viewerNode != null)) {
//         let t: number;
//         let geomNode: GeometryNode = (<Node>(viewerNode.DrawingObject)).GeometryNode;
//         if (this.NeedToCreateBoundaryPort(mousePosition, viewerNode, /* out */t)) {
//             port = this.CreateOrUpdateCurvePort(t, geomNode, port);
//         }
//         else {
//             port = this.CreateFloatingPort(geomNode, /* ref */mousePosition);
//         }

//         // TODO: Warning!!!, inline IF is not supported ?
//         LayoutEditor.PointIsInside(mousePosition, (<Node>(viewerNode.DrawingObject)).GeometryNode.BoundaryCurve);
//         null;
//     }
//     else {
//         port = null;
//     }

//     return viewerNode;
// }

// CreateOrUpdateCurvePort(t: number, geomNode: GeometryNode, port: Port): Port {
//     let cp = (<CurvePort>(port));
//     if ((cp == null)) {
//         return new CurvePort(geomNode.BoundaryCurve, t);
//     }

//     cp.Parameter = t;
//     cp.Curve = geomNode.BoundaryCurve;
//     return port;
// }

// CreateFloatingPort(geomNode: GeometryNode, /* ref */location: Point): FloatingPort {
//     return new FloatingPort(geomNode.BoundaryCurve, location);
// }

// SetPortUnderLoosePolyline(mousePosition: Point, loosePoly: Polyline, /* ref */node: IViewerNode, /* ref */port: Port) {
//     let dist: number = double.PositiveInfinity;
//     let par: number = 0;
//     for (let viewerNode of this.GetViewerNodesInsideOfLooseObstacle(loosePoly)) {
//         let curve = (<Node>(viewerNode.DrawingObject)).GeometryNode.BoundaryCurve;
//         if (LayoutEditor.PointIsInside(mousePosition, curve)) {
//             node = viewerNode;
//             this.SetPortForMousePositionInsideOfNode(mousePosition, node, /* ref */port);
//             return;
//         }

//         let p: number = curve.ClosestParameter(mousePosition);
//         let d: number = (curve[p] - mousePosition).Length;
//         if ((d < dist)) {
//             par = p;
//             dist = d;
//             node = viewerNode;
//         }

//     }

//     port = this.CreateOrUpdateCurvePort(par, (<Node>(node.DrawingObject)).GeometryNode, port);
// }

// GetViewerNodesInsideOfLooseObstacle(loosePoly: Polyline): IEnumerable<IViewerNode> {
//     if ((this.looseObstaclesToTheirViewerNodes == null)) {
//         this.InitLooseObstaclesToViewerNodeMap();
//     }

//     return this.looseObstaclesToTheirViewerNodes[loosePoly];
// }

// InitLooseObstaclesToViewerNodeMap() {
//     this.looseObstaclesToTheirViewerNodes = new Map<Polyline, Array<IViewerNode>>();
//     for (let viewerNode: IViewerNode of this.ViewerNodes()) {
//         let loosePoly: Polyline = InteractiveEdgeRouter.GetHitLoosePolyline(LayoutEditor.GeometryNode(viewerNode).Center);
//         let loosePolyNodes: Array<IViewerNode>;
//         if (!this.looseObstaclesToTheirViewerNodes.TryGetValue(loosePoly, /* out */loosePolyNodes)) {
//             loosePolyNodes = new Array<IViewerNode>();
//         }

//         this.looseObstaclesToTheirViewerNodes[loosePoly] = new Array<IViewerNode>();
//         loosePolyNodes.Add(viewerNode);
//     }

// }

// SetPortForMousePositionInsideOfNode(mousePosition: Point, node: IViewerNode, /* ref */port: Port) {
//     let geomNode: GeometryNode = LayoutEditor.GeometryNode(node);
//     let t: number;
//     if (this.NeedToCreateBoundaryPort(mousePosition, node, /* out */t)) {
//         port = this.CreateOrUpdateCurvePort(t, geomNode, port);
//     }
//     else {
//         port = this.CreateFloatingPort(geomNode, /* ref */mousePosition);
//     }

// }

// static GeometryNode(node: IViewerNode): GeometryNode {
//     let geomNode: GeometryNode = (<Node>(node.DrawingObject)).GeometryNode;
//     return geomNode;
// }

// static PointIsInside(point: Point, iCurve: ICurve): boolean {
//     return (Curve.PointRelativeToCurveLocation(point, iCurve) == PointLocation.Inside);
// }

// NeedToCreateBoundaryPort(mousePoint: Point, node: IViewerNode, /* out */portParameter: number): boolean {
//     let drawingNode = (<Node>(node.DrawingObject));
//     let curve: ICurve = drawingNode.GeometryNode.BoundaryCurve;
//     portParameter = curve.closestParameter(mousePoint);
//     let pointOnCurve: Point = curve[portParameter];
//     let length: number = (mousePoint - pointOnCurve).Length;
//     if ((length
//                 <= ((this.viewer.UnderlyingPolylineCircleRadius * 2)
//                 + (drawingNode.Attr.LineWidth / 2)))) {
//         this.TryToSnapToTheSegmentEnd(/* ref */portParameter, curve, pointOnCurve);
//         return true;
//     }

//     return false;
// }

// TryToSnapToTheSegmentEnd(/* ref */portParameter: number, curve: ICurve, pointOnCurve: Point) {
//     let c = (<Curve>(curve));
//     if ((c != null)) {
//         let seg: ICurve;
//         let segPar: number;
//         c.GetSegmentAndParameter(portParameter, /* out */segPar, /* out */seg);
//         if (((segPar - seg.parStart)
//                     < (seg.parEnd - segPar))) {
//             if (((seg.start - pointOnCurve).Length
//                         < (this.viewer.UnderlyingPolylineCircleRadius * 2))) {
//                 portParameter = (portParameter
//                             - (segPar - seg.parStart));
//             }
//             else if (((seg.end - pointOnCurve).Length
//                         < (this.viewer.UnderlyingPolylineCircleRadius * 2))) {
//                 portParameter = (portParameter
//                             + (seg.parEnd - segPar));
//             }

//         }

//     }

// }

// _lastDragPoint: Point;

// DragSomeObjects(e: MsaglMouseEventArgs) {
//     if (!this.Dragging) {
//         if (this.MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(e)) {
//             this.Dragging = true;
//             // first time we are of Dragging mode
//             if ((this.PolylineVertex != null)) {
//                 this.geomGraphEditor.PrepareForEdgeCornerDragging((<Core.Layout.Edge>(this.SelectedEdge.DrawingObject.GeometryObject)), this.PolylineVertex);
//             }
//             else if ((this.ActiveDraggedObject != null)) {
//                 this.UnselectEdge();
//                 if (!this.ActiveDraggedObject.MarkedForDragging) {
//                     this.UnselectEverything();
//                 }

//                 this.SelectObjectForDragging(this.ActiveDraggedObject);
//                 this.geomGraphEditor.PrepareForObjectDragging(this.DraggedGeomObjects(), this.GetDraggingMode());
//             }

//         }

//         this._lastDragPoint = this.mouseDownGraphPoint;
//     }

//     if (!this.Dragging) {
//         return;
//     }

//     let currentDragPoint = this.viewer.ScreenToSource(e);
//     this.geomGraphEditor.Drag((currentDragPoint - this._lastDragPoint), this.GetDraggingMode(), this._lastDragPoint);
//     for (let affectedObject of this.CurrentUndoAction.affectedObjects) {
//         this.viewer.Invalidate(affectedObject);
//     }

//     if (this.geomGraphEditor.GraphBoundingBoxGetsExtended) {
//         this.viewer.Invalidate();
//     }

//     e.Handled = true;
//     this._lastDragPoint = currentDragPoint;
// }

// GetDraggingMode(): DraggingMode {
//     let incremental: boolean = (((this.viewer.ModifierKeys & ModifierKeys.Shift)
//                 == ModifierKeys.Shift)
//                 || this.viewer.IncrementalDraggingModeAlways);
//     return DraggingMode.Incremental;
//     // TODO: Warning!!!, inline IF is not supported ?
//     incremental;
//     DraggingMode.Default;
// }

// /// <summary>
// /// </summary>
//  static RouteEdgesRectilinearly(viewer: IViewer) {
//     let geomGraph = viewer.Graph.GeometryGraph;
//     let settings = viewer.Graph.LayoutAlgorithmSettings;
//     RectilinearInteractiveEditor.CreatePortsAndRouteEdges((settings.NodeSeparation / 3), 1, geomGraph.Nodes, geomGraph.Edges, settings.EdgeRoutingSettings.EdgeRoutingMode, true, settings.EdgeRoutingSettings.BendPenalty);
//     let labelPlacer = new EdgeLabelPlacement(geomGraph);
//     labelPlacer.run();
// }

// DraggedGeomObjects(): IEnumerable<GeometryObject> {
//     // restrict the dragged elements to be under the same cluster
//     let activeObjCluster: Cluster = LayoutEditor.GetActiveObjectCluster(this.ActiveDraggedObject);
//     for (let draggObj: IViewerObject of this.dragGroup) {
//         if ((LayoutEditor.GetActiveObjectCluster(draggObj) == activeObjCluster)) {
//             yield;
//         }

//     }

//     return draggObj.DrawingObject.GeometryObject;
// }

// static GetActiveObjectCluster(viewerObject: IViewerObject): Cluster {
//     let node = (<GeometryNode>(viewerObject.DrawingObject.GeometryObject));
//     return node.ClusterParent;
//     // TODO: Warning!!!, inline IF is not supported ?
//     (node != null);
//     null;
// }

// ViewerMouseUp(sender: Object, args: MsaglMouseEventArgs) {
//     if (args.Handled) {
//         return;
//     }

//     if (this.viewer.LayoutEditingEnabled) {
//         this.HandleMouseUpOnLayoutEnabled(args);
//     }

// }

// HandleMouseUpOnLayoutEnabled(args: MsaglMouseEventArgs) {
//     let click: boolean = !this.MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(args);
//     if ((click && this.LeftMouseButtonWasPressed)) {
//         if ((this.viewer.ObjectUnderMouseCursor != null)) {
//             this.AnalyzeLeftMouseButtonClick();
//             args.Handled = true;
//         }
//         else {
//             this.UnselectEverything();
//         }

//     }
//     else if (this.Dragging) {
//         if (!this.InsertingEdge) {
//             this.geomGraphEditor.OnDragEnd((this.viewer.ScreenToSource(args) - this.mouseDownGraphPoint));
//             InteractiveEdgeRouter = null;
//             this.looseObstaclesToTheirViewerNodes = null;
//         }
//         else {
//             this.InsertEdgeOnMouseUp();
//         }

//         args.Handled = true;
//     }

//     this.Dragging = false;
//     this.geomGraphEditor.ForgetDragging();
//     this.PolylineVertex = null;
//     this.ActiveDraggedObject = null;
//     this.LeftMouseButtonWasPressed = false;
//     if ((this.TargetPort != null)) {
//         this.viewer.RemoveTargetPortEdgeRouting();
//     }

//     if ((this.SourcePort != null)) {
//         this.viewer.RemoveSourcePortEdgeRouting();
//     }

//     this.TargetOfInsertedEdge = null;
//     this.SourceOfInsertedEdge = null;
//     this.TargetPort = null;
//     this.SourcePort = null;
// }

// edgeAttr: EdgeAttr = new this.EdgeAttr();

// InsertEdgeOnMouseUp() {
//     if (this.DraggingStraightLine()) {
//         this.viewer.StopDrawingRubberLine();
//         this.viewer.RemoveSourcePortEdgeRouting();
//         this.viewer.RemoveTargetPortEdgeRouting();
//         if (((this.SourcePort != null)
//                     && ((this.TargetOfInsertedEdge != null)
//                     && (this.TargetPort != null)))) {
//             let drawingEdge = new Edge((<Node>(this.SourceOfInsertedEdge.DrawingObject)), (<Node>(this.TargetOfInsertedEdge.DrawingObject)), ConnectionToGraph.Connected);
//             let edge: IViewerEdge = this.viewer.RouteEdge(drawingEdge);
//             this.viewer.AddEdge(edge, true);
//             this.AttachLayoutChangeEvent(edge);
//         }

//     }
//     else {
//         this.viewer.StopDrawingRubberEdge();
//         if ((this.TargetPort != null)) {
//             this.FinishRoutingEdge();
//             this.AddEdge();
//         }

//         InteractiveEdgeRouter.Clean();
//     }

// }

// AddEdge() {
//     let drawingEdge = new Edge((<Node>(this.SourceOfInsertedEdge.DrawingObject)), (<Node>(this.TargetOfInsertedEdge.DrawingObject)), ConnectionToGraph.Disconnected, this.EdgeAttr.Clone());
//     let geomEdge = new Core.Layout.Edge(LayoutEditor.GeometryNode(this.SourceOfInsertedEdge), LayoutEditor.GeometryNode(this.TargetOfInsertedEdge));
//     drawingEdge.GeometryEdge = geomEdge;
//     drawingEdge.SourcePort = this.SourcePort;
//     drawingEdge.TargetPort = this.TargetPort;
//     let edge = this.viewer.CreateEdgeWithGivenGeometry(drawingEdge);
//     this.viewer.AddEdge(edge, true);
//     this.AttachLayoutChangeEvent(edge);
// }

// FinishRoutingEdge() {
//     GeomEdge.SourceArrowhead = null;
//     // TODO: Warning!!!, inline IF is not supported ?
//     (this.EdgeAttr.ArrowheadAtSource == ArrowStyle.None);
//     new Arrowhead();
//     GeomEdge.TargetArrowhead = null;
//     // TODO: Warning!!!, inline IF is not supported ?
//     (this.EdgeAttr.ArrowheadAtTarget == ArrowStyle.None);
//     new Arrowhead();
//     if ((this.TargetOfInsertedEdge != this.SourceOfInsertedEdge)) {
//         InteractiveEdgeRouter.TryToRemoveInflectionsAndCollinearSegments(GeomEdge.SmoothedPolyline);
//         InteractiveEdgeRouter.SmoothCorners(GeomEdge.SmoothedPolyline);
//         GeomEdge.Curve = GeomEdge.SmoothedPolyline.CreateCurve();
//         Arrowheads.TrimSplineAndCalculateArrowheads(GeomEdge, LayoutEditor.GeometryNode(this.SourceOfInsertedEdge).BoundaryCurve, LayoutEditor.GeometryNode(this.TargetOfInsertedEdge).BoundaryCurve, GeomEdge.Curve, true);
//     }
//     else {
//         GeomEdge = LayoutEditor.CreateEdgeGeometryForSelfEdge(this.graph.GeometryGraph, LayoutEditor.GeometryNode(this.SourceOfInsertedEdge));
//     }

//     this.viewer.RemoveSourcePortEdgeRouting();
//     this.viewer.RemoveTargetPortEdgeRouting();
// }

// static CreateEdgeGeometryForSelfEdge(geometryGraph: GeometryObject, node: GeometryNode): GeomEdge {
//     let tempEdge = new Core.Layout.Edge(node, node);
//     StraightLineEdges.CreateSimpleEdgeCurveWithUnderlyingPolyline(tempEdge);
//     return tempEdge.GeomEdge;
// }

// SelectEntitiesForDraggingWithRectangle(args: MsaglMouseEventArgs) {
//     let rect = new Rectangle(this.mouseDownGraphPoint, this.viewer.ScreenToSource(args));
//     for (let node: IViewerNode of this.ViewerNodes()) {
//         if (rect.intersects(node.Node.BoundingBox)) {
//             this.SelectObjectForDragging(node);
//         }

//     }

//     args.Handled = true;
// }

// ProcessRightClickOnSelectedEdge(e: MsaglMouseEventArgs) {
//     this.mouseRightButtonDownPoint = viewer.ScreenToSource(e);
//     this.cornerInfo = this.AnalyzeInsertOrDeletePolylineCorner(this.mouseRightButtonDownPoint, this.SelectedEdge.RadiusOfPolylineCorner);
//     if ((this.cornerInfo == null)) {
//         return;
//     }

//     e.Handled = true;
//     let edgeRemoveCouple = new [string, ()=>void>("Remove edge", () =] {  }, viewer.RemoveEdge(this.SelectedEdge, true));
//     if ((this.cornerInfo.Item2 == PolylineCornerType.PreviousCornerForInsertion)) {
//         viewer.PopupMenus(new [string, ()=>void]("Insert polyline corner", this.InsertPolylineCorner), edgeRemoveCouple);
//     }
//     else if ((this.cornerInfo.Item2 == PolylineCornerType.CornerToDelete)) {
//         viewer.PopupMenus(new [string, ()=>void]("Delete polyline corner", this.DeleteCorner), edgeRemoveCouple);
//     }

// }

// CheckIfDraggingPolylineVertex(e: MsaglMouseEventArgs) {
//     if (((this.SelectedEdge != null)
//                 && (this.SelectedEdge.edge.GeometryEdge.UnderlyingPolyline != null))) {
//         let site: CornerSite = this.SelectedEdge.edge.GeometryEdge.UnderlyingPolyline.HeadSite;
//         for (
//         ; (site != null);
//         ) {
//             if (this.MouseScreenPointIsCloseEnoughToVertex(site.point, (this.SelectedEdge.RadiusOfPolylineCorner
//                             + (this.SelectedEdge.edge.Attr.LineWidth / 2)))) {
//                 this.PolylineVertex = site;
//                 e.Handled = true;
//                 break;
//             }

//             site = site.next;
//         }

//     }

// }

// MouseScreenPointIsCloseEnoughToVertex(point: Point, radius: number): boolean {
//     return ((point - this.mouseDownGraphPoint).Length < radius);
// }

// static GetPressedButtons(e: MsaglMouseEventArgs): MouseButtons {
//     let ret = MouseButtons.None;
//     if (e.LeftButtonIsPressed) {
//         ret = (ret | MouseButtons.Left);
//     }

//     if (e.MiddleButtonIsPressed) {
//         ret = (ret | MouseButtons.Middle);
//     }

//     if (e.RightButtonIsPressed) {
//         ret = (ret | MouseButtons.Right);
//     }

//     return ret;
// }

// ///  <summary>
// ///  Undoes the editing
// ///  </summary>

//  Undo() {
//     if (this.geomGraphEditor.CanUndo) {
//         let action: UndoRedoAction = this.geomGraphEditor.CurrentUndoAction;
//         this.geomGraphEditor.Undo();
//         for (let o of action.affectedObjects) {
//             this.viewer.Invalidate(o);
//         }

//         if (action.GraphBoundingBoxHasChanged) {
//             this.viewer.Invalidate();
//         }

//     }

// }

// ///  <summary>
// ///  Redoes the editing
// ///  </summary>
//  Redo() {
//     if (this.geomGraphEditor.CanRedo) {
//         this.geomGraphEditor.UndoMode = false;
//         let action: UndoRedoAction = this.geomGraphEditor.CurrentRedoAction;
//         this.geomGraphEditor.Redo();
//         for (let o of action.affectedObjects) {
//             this.viewer.Invalidate(o);
//         }

//         if (action.GraphBoundingBoxHasChanged) {
//             this.viewer.Invalidate();
//         }

//         this.geomGraphEditor.UndoMode = true;
//     }

// }

// ///  <summary>
// ///  Clear the editor
// ///  </summary>
//  Clear() {
//     this.UnselectEverything();
// }

// ///  <summary>
// ///  Finds a corner to delete or insert
// ///  </summary>
// ///  <param name="point"></param>
// ///  <param name="tolerance"></param>
// ///  <returns>null if a corner is not found</returns>

// //  AnalyzeInsertOrDeletePolylineCorner(point: Point, tolerance: number): [CornerSite, PolylineCornerType] {
// //     if ((this.SelectedEdge == null)) {
// //         return null;
// //     }

// //     tolerance = (tolerance + this.SelectedEdge.edge.Attr.LineWidth);
// //     let corner: CornerSite = GeometryGraphEditor.FindCornerForEdit(this.SelectedEdge.edge.GeometryEdge.UnderlyingPolyline, point, tolerance);
// //     if ((corner != null)) {
// //         return new [CornerSite, PolylineCornerType](corner, PolylineCornerType.CornerToDelete);
// //     }

// //     corner = GeometryGraphEditor.GetPreviousSite(this.SelectedEdge.edge.GeometryEdge, point);
// //     if ((corner != null)) {
// //         return new [CornerSite, PolylineCornerType](corner, PolylineCornerType.PreviousCornerForInsertion);
// //     }

// //     return null;
// // }

// // ///  <summary>
// // ///  create a tight bounding box for the graph
// // ///  </summary>
// // ///  <param name="graphToFit"></param>
// //  FitGraphBoundingBox(graphToFit: IViewerObject) {
// //     if ((graphToFit != null)) {
// //         this.geomGraphEditor.FitGraphBoundingBox(graphToFit, (<GeometryGraph>(graphToFit.DrawingObject.GeometryObject)));
// //         this.viewer.Invalidate();
// //     }

// // }

// // ///  <summary>
// // ///
// // ///  </summary>
// // ///  <param name="node"></param>
// //  RegisterNodeAdditionForUndo(node: IViewerNode) {
// //     let undoAction = new AddNodeUndoAction(this.graph, this.viewer, node);
// //     this.geomGraphEditor.InsertToListAndSetTheBoxBefore(undoAction);
// // }

// // ///  <summary>
// // ///  registers the edge addition for undo
// // ///  </summary>
// // ///  <param name="edge"></param>
// //  RegisterEdgeAdditionForUndo(edge: IViewerEdge) {
// //     this.geomGraphEditor.InsertToListAndSetTheBoxBefore(new AddEdgeUndoAction(this.viewer, edge));
// // }

// // ///  <summary>
// // ///
// // ///  </summary>
// // ///  <param name="edge"></param>
// //  RegisterEdgeRemovalForUndo(edge: IViewerEdge) {
// //     this.geomGraphEditor.InsertToListAndSetTheBoxBefore(new RemoveEdgeUndoAction(this.graph, this.viewer, edge));
// // }

// // ///  <summary>
// // ///
// // ///  </summary>
// // ///  <param name="node"></param>
// //  RegisterNodeForRemoval(node: IViewerNode) {
// //     this.geomGraphEditor.InsertToListAndSetTheBoxBefore(new RemoveNodeUndoAction(this.viewer, node));
// // }

// //  static RectRouting(mode: EdgeRoutingMode): boolean {
// //     return ((mode == EdgeRoutingMode.Rectilinear)
// //                 || (mode == EdgeRoutingMode.RectilinearToCenter));
// // }

// // EnumerateNodeBoundaryCurves(): IEnumerable<ICurve> {
// //     return from;
// //     vn;
// //     this.ViewerNodes();
// //     let GeometryNode: select;
// //     vn.BoundaryCurve;
// // }

// //  ForgetEdgeDragging() {
// //     if ((this.viewer.Graph == null)) {
// //         return;
// //     }

// //     if (this.DraggingStraightLine()) {
// //         return;
// //     }

// //     if (!LayoutEditor.RectRouting(this.viewer.Graph.LayoutAlgorithmSettings.EdgeRoutingSettings.EdgeRoutingMode)) {
// //         InteractiveEdgeRouter = null;
// //         this.looseObstaclesToTheirViewerNodes = null;
// //     }

// // }

// // ///  <summary>
// // ///  prepares for edge dragging
// // ///  </summary>
// //  PrepareForEdgeDragging() {
// //     if ((this.viewer.Graph == null)) {
// //         return;
// //     }

// //     if (this.DraggingStraightLine()) {
// //         return;
// //     }

// //     let settings = this.viewer.Graph.LayoutAlgorithmSettings;
// //     if (!LayoutEditor.RectRouting(settings.EdgeRoutingSettings.EdgeRoutingMode)) {
// //         if ((InteractiveEdgeRouter == null)) {
// //             let padding = (settings.NodeSeparation / 3);
// //             let loosePadding = (0.65 * padding);
// //             InteractiveEdgeRouter = new InteractiveEdgeRouter(this.EnumerateNodeBoundaryCurves(), padding, loosePadding, 0);
// //         }

// //     }

// // }

// // ///  <summary>
// // ///  insert a polyline corner at the point befor the prevCorner
// // ///  </summary>
// // ///  <param name="point"></param>
// // ///  <param name="previousCorner"></param>

// //  InsertPolylineCorner(point: Point, previousCorner: CornerSite) {
// //     this.geomGraphEditor.InsertSite(this.SelectedEdge.edge.GeometryEdge, point, previousCorner, this.SelectedEdge);
// //     this.viewer.Invalidate(this.SelectedEdge);
// // }

// // InsertPolylineCorner() {
// //     this.geomGraphEditor.InsertSite(this.SelectedEdge.edge.GeometryEdge, this.mouseRightButtonDownPoint, this.cornerInfo.Item1, this.SelectedEdge);
// //     this.viewer.Invalidate(this.SelectedEdge);
// // }

// // ///  <summary>
// // ///  delete the polyline corner, shortcut it.
// // ///  </summary>
// // ///  <param name="corner"></param>
// //  DeleteCorner(corner: CornerSite) {
// //     this.geomGraphEditor.DeleteSite(this.SelectedEdge.edge.GeometryEdge, corner, this.SelectedEdge);
// //     this.viewer.Invalidate(this.SelectedEdge);
// //     this.viewer.OnDragEnd([
// //                 this.SelectedEdge]);
// // }

// // DeleteCorner() {
// //     this.geomGraphEditor.DeleteSite(this.SelectedEdge.edge.GeometryEdge, this.cornerInfo.Item1, this.SelectedEdge);
// //     this.viewer.Invalidate(this.SelectedEdge);
// //     this.viewer.OnDragEnd([
// //                 this.SelectedEdge]);
// // }

// // HandleMouseMoveWhenInsertingEdgeAndNotPressingLeftButton(e: MsaglMouseEventArgs) {
// //     let oldNode: IViewerNode = this.SourceOfInsertedEdge;
// //     if (this.TrySetNodePort(e, /* ref */this.sourceOfInsertedEdge, /* ref */this.sourcePort, /* out */this.sourceLoosePolyline)) {
// //         this.viewer.SetSourcePortForEdgeRouting(this.sourcePort.Location);
// //     }
// //     else if ((oldNode != null)) {
// //         this.viewer.RemoveSourcePortEdgeRouting();
// //     }

// // }

// // MouseMoveWhenInsertingEdgeAndPressingLeftButton(e: MsaglMouseEventArgs) {
// //     if ((this.SourcePort != null)) {
// //         this.SetDraggingFlag(e);
// //         if (this.Dragging) {
// //             let loosePolyline: Polyline;
// //             if (this.TrySetNodePort(e, /* ref */this.targetOfInsertedEdge, /* ref */this.targetPort, /* out */loosePolyline)) {
// //                 this.viewer.SetTargetPortForEdgeRouting(this.targetPort.Location);
// //                 if (this.DraggingStraightLine()) {
// //                     this.viewer.DrawRubberLine(this.TargetPort.Location);
// //                 }
// //                 else {
// //                     this.DrawEdgeInteractivelyToPort(this.TargetPort, loosePolyline);
// //                 }

// //             }
// //             else {
// //                 this.viewer.RemoveTargetPortEdgeRouting();
// //                 if (this.DraggingStraightLine()) {
// //                     this.viewer.DrawRubberLine(e);
// //                 }
// //                 else {
// //                     this.DrawEdgeInteractivelyToLocation(e);
// //                 }

// //             }

// //         }

// //         e.Handled = true;
// //     }

// // }

// // MouseMoveLiveSelectObjectsForDragging(e: MsaglMouseEventArgs) {
// //     this.UnselectEverything();
// //     if ((this.ToggleEntityPredicate(this.viewer.ModifierKeys, this.PressedMouseButtons, true)
// //                 && ((this.viewer.ModifierKeys & ModifierKeys.Shift)
// //                 != ModifierKeys.Shift))) {
// //         this.SelectEntitiesForDraggingWithRectangle(e);
// //     }

// // }

// // DrawEdgeInteractivelyToLocation(e: MsaglMouseEventArgs) {
// //     this.DrawEdgeInteractivelyToLocation(this.viewer.ScreenToSource(e));
// // }

// // DrawEdgeInteractivelyToLocation(point: Point) {
// //     this.viewer.DrawRubberEdge(GeomEdge=this.CalculateEdgeInteractivelyToLocation(pointUnknown);
// // }

// // CalculateEdgeInteractivelyToLocation(location: Point): GeomEdge {
// //     if ((InteractiveEdgeRouter.SourcePort == null)) {
// //         InteractiveEdgeRouter.SetSourcePortAndSourceLoosePolyline(this.SourcePort, this.sourceLoosePolyline);
// //     }

// //     return InteractiveEdgeRouter.RouteEdgeToLocation(location);
// // }

// // DrawEdgeInteractivelyToPort(targetPortParameter: Port, portLoosePolyline: Polyline) {
// //     this.viewer.DrawRubberEdge(GeomEdge=this.CalculateEdgeInteractively(targetPortParameter,portLoosePolylineUnknown);
// // }

// // DraggingStraightLine(): boolean {
// //     if ((this.viewer.Graph == null)) {
// //         return true;
// //     }

// //     return ((InteractiveEdgeRouter != null)
// //                 && InteractiveEdgeRouter.OverlapsDetected);
// // }

// // CalculateEdgeInteractively(targetPortParameter: Port, portLoosePolyline: Polyline): GeomEdge {
// //     if ((InteractiveEdgeRouter.SourcePort == null)) {
// //         InteractiveEdgeRouter.SetSourcePortAndSourceLoosePolyline(this.SourcePort, this.sourceLoosePolyline);
// //     }

// //     let curve: ICurve;
// //     let smoothedPolyline: SmoothedPolyline = null;
// //     if ((this.SourceOfInsertedEdge == this.TargetOfInsertedEdge)) {
// //         curve = new LineSegment(this.SourcePort.Location, this.TargetPort.Location);
// //     }
// //     else {
// //         curve = InteractiveEdgeRouter.RouteEdgeToPort(targetPortParameter, portLoosePolyline, false, /* out */smoothedPolyline);
// //     }

// //     return [][
// //             Curve=curve,
// //             SmoothedPolyline=smoothedPolyline];
// // }

// //  ScaleNodeAroundCenter(viewerNode: IViewerNode, scale: number) {
// //     let nodePosition = viewerNode.node.BoundingBox.Center;
// //     let scaleMatrix = new PlaneTransformation(scale, 0, 0, 0, scale, 0);
// //     let translateToOrigin = new PlaneTransformation(1, 0, (nodePosition.X * -1), 0, 1, (nodePosition.Y * -1));
// //     let translateToNode = new PlaneTransformation(1, 0, nodePosition.X, 0, 1, nodePosition.Y);
// //     let matrix = (translateToNode
// //                 * (scaleMatrix * translateToOrigin));
// //     viewerNode.node.GeometryNode.BoundaryCurve = viewerNode.node.GeometryNode.BoundaryCurve.Transform(matrix);
// //     this.viewer.Invalidate(viewerNode);
// //     for (let edge of viewerNode.OutEdges.Concat(viewerNode.InEdges).Concat(viewerNode.SelfEdges)) {
// //         this.RecoverEdge(edge);
// //     }

// // }

// // RecoverEdge(edge: IViewerEdge) {
// //     let curve = edge.edge.GeometryEdge.UnderlyingPolyline.CreateCurve();
// //     Arrowheads.TrimSplineAndCalculateArrowheads(edge.edge.GeometryEdge, curve, true, this.Graph.LayoutAlgorithmSettings.EdgeRoutingSettings.KeepOriginalSpline);
// //     this.viewer.Invalidate(edge);
// // }

// // ///  <summary>
// // ///
// // ///  </summary>
// // ///  <param name="node"></param>
// //  DetachNode(node: IViewerNode) {
// //     if ((node == null)) {
// //         return;
// //     }

// //     this.decoratorRemovalsDict.Remove(node);
// //     for (let edge of LayoutEditor.Edges(node)) {
// //         this.RemoveObjDraggingDecorations(edge);
// //     }

// // }
// }
