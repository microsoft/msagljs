import { DrawingNode } from "../../drawing/drawingNode";
import { DrawingObject } from "../../drawing/drawingObject";
import { Polyline, Point, Curve, Rectangle, LineSegment, ICurve, PointLocation } from "../../math/geometry";
import { CornerSite } from "../../math/geometry/cornerSite";
import { SmoothedPolyline } from "../../math/geometry/smoothedPolyline";
import { InteractiveEdgeRouter } from "../../routing/InteractiveEdgeRouter";
import { RectilinearInteractiveEditor } from "../../routing/rectilinear/RectilinearInteractiveEditor";
import { StraightLineEdges } from "../../routing/StraightLineEdges";
import { AttributeRegistry } from "../../structs/attributeRegister";
import { Edge } from "../../structs/edge";
import { Entity } from "../../structs/entity";
import { Graph } from "../../structs/graph";
import { Node } from "../../structs/node";
import { Assert } from "../../utils/assert";
import { GeomEdge, GeomGraph, GeomNode } from "../core";
import { Arrowhead } from "../core/arrowhead";
import { CurvePort } from "../core/curvePort";
import { FloatingPort } from "../core/floatingPort";
import { GeomObject } from "../core/geomObject";
import { Port } from "../core/port";
import { layoutGeomGraph } from "../driver";
import { EdgeLabelPlacement } from "../edgeLabelPlacement";
import { EdgeRestoreData } from "./edgeRestoreData";
import { DraggingMode, GeometryGraphEditor } from "./geomGraphEditor";
import { IMsaglMouseEventArgs } from "./IMsaglMouseEventArgs";
import { IViewer } from "./iViewer";
import { IViewerEdge } from "./iViewerEdge";
import { IViewerNode } from "./iViewerNode";
import { IViewerObject, getViewerDrawingObject } from "./iViewerObject";
import { ModifierKeys } from "./modifierKeys";
import { MouseButtons } from "./mouseButtons";
import { NodeRestoreData } from "./nodeRestoreData";
import { ObjectUnderMouseCursorChangedEventArgs, EventArgs } from "./objectUnderMouseCursorChangedEventArgs";
import { PolylineCornerType } from "./polylineCornerType";
import { UndoRedoAction } from "./undoRedoAction";
type DelegateForIViewerObject = (o:IViewerObject) =>void
type DelegateForEdge = (e:IViewerEdge)=>void
type MouseAndKeysAnalyzer = ( modifierKeys:ModifierKeys,  mouseButtons:MouseButtons, dragging:boolean) => void

function getViewerObj(entity:Entity) :IViewerObject {
    return entity.getAttr(AttributeRegistry.ViewerIndex) as IViewerObject
}

function geomObjFromIViewerObj(obj:IViewerObject): GeomObject {
    return GeomObject.getGeom(obj.entity)
}

function isIViewerNode(obj:IViewerObject): boolean {
    return obj.hasOwnProperty("node")
}


function getRestoreData(entity: Entity): any {
    if (entity instanceof Graph) return null
    if (entity instanceof Node)
       return new NodeRestoreData((GeomObject.getGeom(entity) as GeomNode).boundaryCurve)
    if (entity instanceof Edge)  return new EdgeRestoreData(GeomObject.getGeom(entity) as GeomEdge)
    throw new Error('not implemented')
}


export class LayoutEditor {
    aActiveDraggedObject: IViewerObject;
    polylineVertex: CornerSite;
    geomEdge: GeomEdge;
    interactiveEdgeRouter: InteractiveEdgeRouter;
    selectedEdge: IViewerEdge;
    mouseDownScreenPoint: Point;
    mouseButtons: MouseButtons;

     get ActiveDraggedObject(): IViewerObject {
        return this.aActiveDraggedObject
    }
     set ActiveDraggedObject(value: IViewerObject)  {
        this.aActiveDraggedObject = value
    }

     get PolylineVertex(): CornerSite {
        return this.polylineVertex
    }
     set PolylineVertex(value: CornerSite)  {
        this.polylineVertex= value
    }

    cornerInfo: [CornerSite, PolylineCornerType];

    decoratorRemovalsDict: Map<IViewerObject, ()=>void> = new Map<IViewerObject, ()=>void>();

    dragGroup: Set<IViewerObject> = new Set<IViewerObject>();

    geomGraphEditor: GeometryGraphEditor = new GeometryGraphEditor();

    graph: Graph;

    looseObstaclesToTheirViewerNodes: Map<Polyline, Array<IViewerNode>>;

    mouseDownGraphPoint: Point;

    mouseMoveThreshold: number = 0.05;

    mouseRightButtonDownPoint: Point;

    removeEdgeDraggingDecorations: DelegateForEdge;

    sourceLoosePolyline: Polyline;

    sourceOfInsertedEdge: IViewerNode;

    sourcePort: Port;

    targetOfInsertedEdge: IViewerNode;

    targetPort: Port;

    viewer: IViewer;

    get GeomEdge(): GeomEdge {
        return this.geomEdge
    }
    set GeomEdge(value: GeomEdge)  {
        this.geomEdge = value
    }

    get InteractiveEdgeRouter(): InteractiveEdgeRouter {
        return this.interactiveEdgeRouter
    }
    set InteractiveEdgeRouter(value: InteractiveEdgeRouter)  {
        this.interactiveEdgeRouter = value
    }

    //  Constructor

     constructor (viewerPar: IViewer) {
        this.viewer = viewerPar;
        this.HookUpToViewerEvents();
        this.ToggleEntityPredicate =(modifierKeys, mouseButtons, draggingParameter) => LayoutEditor.LeftButtonIsPressed(mouseButtons);
        this.NodeInsertPredicate = (modifierKeys, mouseButtons, draggingParameter) =>
             LayoutEditor.MiddleButtonIsPressed(mouseButtons) && draggingParameter == false;

        this.DecorateObjectForDragging = this.TheDefaultObjectDecorator;
        this.RemoveObjDraggingDecorations = this.TheDefaultObjectDecoratorRemover;
        this.DecorateEdgeForDragging = LayoutEditor.TheDefaultEdgeDecoratorStub;
        this.DecorateEdgeLabelForDragging = LayoutEditor.TheDefaultEdgeLabelDecoratorStub;
        this.RemoveEdgeDraggingDecorations = LayoutEditor.TheDefaultEdgeDecoratorStub;
        this.geomGraphEditor.ChangeInUndoRedoList.subscribe(this.LayoutEditorChangeInUndoRedoList);
    }

    HookUpToViewerEvents() {
        this.viewer.MouseDown.subscribe(this.ViewerMouseDown);
        this.viewer.MouseMove.subscribe(this.ViewerMouseMove);
        this.viewer.MouseUp.subscribe(this.ViewerMouseUp);
        this.viewer.ObjectUnderMouseCursorChanged.subscribe(this.ViewerObjectUnderMouseCursorChanged);
        this.viewer.GraphChanged.subscribe(this.ViewerGraphChanged);
        this.viewer.ViewChangeEvent.subscribe(this.ViewChangeEventHandler);
    }

    ViewerObjectUnderMouseCursorChanged(sender:any, e:ObjectUnderMouseCursorChangedEventArgs) {
            if (this.TargetPort != null) {
                this.viewer.RemoveTargetPortEdgeRouting();
                this.TargetPort = null;
            }
    }

    ViewChangeEventHandler(sender: Object, e: any) {
        if ((this.graph == null)) {
            return;
        }
    }

    //  current graph of under editin

     get Graph(): Graph {
        return this.graph;
    }
     set Graph(value: Graph)  {
        this.graph = value;
        if ((this.graph != null)) {
            this.geomGraphEditor.graph = GeomGraph.getGeom(this.graph)

        }

    }

    //  the current selected edge

     get SelectedEdge(): IViewerEdge {
        return this.selectedEdge
    }
     set SelectedEdge(value: IViewerEdge)  {
        this.selectedEdge=value;
    }

    //  If the distance between the mouse down point and the mouse up point is greater than the threshold
    //  then we have a mouse move. Otherwise we have a click.

     get MouseMoveThreshold(): number {
        return this.mouseMoveThreshold;
    }
     set MouseMoveThreshold(value: number)  {
        this.mouseMoveThreshold = value;
    }

    //  the delegate to decide if an entity is dragged or we just zoom of the viewer

     private toggleEntityPredicate: MouseAndKeysAnalyzer;
    public get ToggleEntityPredicate(): MouseAndKeysAnalyzer {
        return this.toggleEntityPredicate;
    }
    public set ToggleEntityPredicate(value: MouseAndKeysAnalyzer) {
        this.toggleEntityPredicate = value;
    }

    private dragging: boolean;
    public get Dragging(): boolean {
        return this.dragging;
    }
    public set Dragging(value: boolean) {
        this.dragging = value;
    }

    get MouseDownScreenPoint(): Point {
        return this.mouseDownScreenPoint;
    }
    set MouseDownScreenPoint(value: Point)  {
        this.mouseDownScreenPoint = value
    }

    //  current pressed mouse buttons

     get PressedMouseButtons(): MouseButtons {
       return this.mouseButtons
    }
     set PressedMouseButtons(value: MouseButtons)  {
        this.mouseButtons = value
    }

    //  a delegate to decorate a node for dragging

     private decorateObjectForDragging: DelegateForIViewerObject;
    public get DecorateObjectForDragging(): DelegateForIViewerObject {
        return this.decorateObjectForDragging;
    }
    public set DecorateObjectForDragging(value: DelegateForIViewerObject) {
        this.decorateObjectForDragging = value;
    }

    //  a delegate decorate an edge for editing

     private decorateEdgeForDragging: DelegateForEdge;
    public get DecorateEdgeForDragging(): DelegateForEdge {
        return this.decorateEdgeForDragging;
    }
    public set DecorateEdgeForDragging(value: DelegateForEdge) {
        this.decorateEdgeForDragging = value;
    }

    //  a delegate decorate a label for editing

     private decorateEdgeLabelForDragging: DelegateForIViewerObject;
    public get DecorateEdgeLabelForDragging(): DelegateForIViewerObject {
        return this.decorateEdgeLabelForDragging;
    }
    public set DecorateEdgeLabelForDragging(value: DelegateForIViewerObject) {
        this.decorateEdgeLabelForDragging = value;
    }

    //  a delegate to remove node decorations

     private removeObjDraggingDecorations: DelegateForIViewerObject;
    public get RemoveObjDraggingDecorations(): DelegateForIViewerObject {
        return this.removeObjDraggingDecorations;
    }
    public set RemoveObjDraggingDecorations(value: DelegateForIViewerObject) {
        this.removeObjDraggingDecorations = value;
    }

    //  a delegate to remove edge decorations

     get RemoveEdgeDraggingDecorations(): DelegateForEdge {
        return this.removeEdgeDraggingDecorations;
    }
     set RemoveEdgeDraggingDecorations(value: DelegateForEdge)  {
        this.removeEdgeDraggingDecorations = value;
    }

    //  The method analysing keys and mouse buttons to decide if we are inserting a node

     private nodeInsertPredicate: MouseAndKeysAnalyzer;
    public get NodeInsertPredicate(): MouseAndKeysAnalyzer {
        return this.nodeInsertPredicate;
    }
    public set NodeInsertPredicate(value: MouseAndKeysAnalyzer) {
        this.nodeInsertPredicate = value;
    }

    private leftMouseButtonWasPressed: boolean;
    public get LeftMouseButtonWasPressed(): boolean {
        return this.leftMouseButtonWasPressed;
    }
    public set LeftMouseButtonWasPressed(value: boolean) {
        this.leftMouseButtonWasPressed = value;
    }

     get SourceOfInsertedEdge(): IViewerNode {
        return this.sourceOfInsertedEdge;
    }
     set SourceOfInsertedEdge(value: IViewerNode)  {
        this.sourceOfInsertedEdge = value;
    }

     get TargetOfInsertedEdge(): IViewerNode {
        return this.targetOfInsertedEdge;
    }
     set TargetOfInsertedEdge(value: IViewerNode)  {
        this.targetOfInsertedEdge = value;
    }

    get SourcePort(): Port {
        return this.sourcePort;
    }
    set SourcePort(value: Port)  {
        this.sourcePort = value;
    }

    get TargetPort(): Port {
        return this.targetPort;
    }
    set TargetPort(value: Port)  {
        this.targetPort = value;
    }

    //  returns true if Undo is available

     get CanUndo(): boolean {
        return this.geomGraphEditor.CanUndo;
    }

    //  return true if Redo is available

     get CanRedo(): boolean {
        return this.geomGraphEditor.CanRedo;
    }

    //  If set to true then we are of a mode for node insertion

     get InsertingEdge(): boolean {
        if ((this.viewer == null)) {
            return false;
        }

        return this.viewer.InsertingEdge;
    }
     set InsertingEdge(value: boolean)  {
        if ((this.viewer == null)) {
            return;
        }

        this.viewer.InsertingEdge = value;
    }

    //  current undo action

     get CurrentUndoAction(): UndoRedoAction {
        return this.geomGraphEditor.UndoMode ? this.geomGraphEditor.CurrentUndoAction : this.geomGraphEditor.CurrentRedoAction;
    }

    EdgeAttr:any

     ViewerGraphChanged(sender: Object, e: any) {
    const isIViewer = sender.hasOwnProperty('IncrementalDraggingModeAlways')
    if (isIViewer ) {
        const iViewer= <IViewer>sender
        this.graph = iViewer.Graph;
        if (((this.graph != null)
                    && GeomGraph.getGeom(this.graph)!= null)) {
            this.geomGraphEditor.graph = GeomGraph.getGeom(this.graph)
            this.AttachInvalidateEventsToGeomObjects();
        }

    }

    this.ActiveDraggedObject = null;
    this.decoratorRemovalsDict.clear();
    this.dragGroup.clear();
    this.CleanObstacles();
}

//

 CleanObstacles() {
    this.InteractiveEdgeRouter = null;
    this.looseObstaclesToTheirViewerNodes = null;
    this.SourceOfInsertedEdge = null;
    this.TargetOfInsertedEdge = null;
    this.SourcePort = null;
    this.TargetPort = null;
    this.viewer.RemoveSourcePortEdgeRouting();
    this.viewer.RemoveTargetPortEdgeRouting();
}

AttachInvalidateEventsToGeomObjects() {
    for (let entity of this.viewer.Entities) {
        this.AttachLayoutChangeEvent(entity);
    }

}

//

 AttachLayoutChangeEvent(viewerObject: IViewerObject) {
    let drawingObject = getViewerDrawingObject(viewerObject)
    if (drawingObject != null) {
        var geom = GeomObject.getGeom(drawingObject.entity);
        if (geom != null)
            geom.BeforeLayoutChangeEvent.subscribe((a, b) => this.ReportBeforeChange(viewerObject));
        if (geom instanceof GeomGraph)
         {
            var iViewerNode = <IViewerNode> viewerObject;
            iViewerNode.IsCollapsedChanged.subscribe(this.RelayoutOnIsCollapsedChanged)
        }
    }
 }

RelayoutOnIsCollapsedChanged(iCluster: IViewerNode) {
    this.geomGraphEditor.PrepareForClusterCollapseChange([iCluster])
    let geomGraph = GeomGraph.getGeom(iCluster.node as Graph)
    if (geomGraph.isCollapsed) {
        this.CollapseCluster(iCluster.node as Graph);
    }
    else {
        this.ExpandCluster(geomGraph);
    }

    // LayoutAlgorithmSettings.ShowGraph(viewer.Graph.GeometryGraph);
    for (let o: IViewerObject of this.geomGraphEditor.CurrentUndoAction.affectedObjects) {
        this.viewer.Invalidate(o);
    }

}

relayout(cluster:GeomGraph) {
    let parent=cluster
    while (parent.parent != null) {
        parent = parent.parent as GeomGraph
    }
    layoutGeomGraph(parent)// TODO: this call relayouts everything. Try to optimize.
    this.MakeExpandedNodesVisible(cluster.entity as Graph) 
}
 
ExpandCluster(cluster: GeomGraph) {
    if (cluster == null) return
    this.relayout(cluster)
}

MakeExpandedNodesVisible(cluster: Graph) {
    for (const node of cluster.shallowNodes) {
        const iviewerNode = node.getAttr(AttributeRegistry.ViewerIndex) as IViewerNode
        LayoutEditor.UnhideNodeEdges(node)
        iviewerNode.isVisible = true;
        if (node instanceof Graph) {
            const geomGraph = node.getAttr(AttributeRegistry.GeomObjectIndex) as GeomGraph
            if (geomGraph.isCollapsed == false)
               this.MakeExpandedNodesVisible(node)
        }
       
    }
 
}



static UnhideNodeEdges(drn: Node) {
    for (let e of drn.selfEdges) {
        (e.getAttr(AttributeRegistry.ViewerIndex) as IViewerObject).isVisible = true;
    }

    for (let e of drn.outEdges) {
        if (getViewerObj(e.target).isVisible) 
            getViewerObj(e).isVisible = true
    }

    for (let e of drn.inEdges) {
        if (getViewerObj(e.source).isVisible) 
            getViewerObj(e).isVisible = true
    }
    

}

CollapseCluster(graph: Graph) {
    LayoutEditor.HideCollapsed(graph);
    const geomCluster = GeomGraph.getGeom(graph)
    let center = geomCluster.center;
    geomCluster.boundingBox = Rectangle.mkSizeCenter(geomCluster.labelSize, center) 
    this.relayout(geomCluster);
}

static HideCollapsed(cluster: Graph) {
    for (let n of cluster.shallowNodes) {
        getViewerObj(n).isVisible = false
        if (n instanceof Graph) {
            if (GeomGraph.getGeom(n).isCollapsed == false)
            LayoutEditor.HideCollapsed(n)
    }
}

}

ReportBeforeChange(viewerObject: IViewerObject) {
    if (((this.CurrentUndoAction == null)
                || this.CurrentUndoAction.hasAffectedObject(viewerObject))) {
        return;
    }

    this.CurrentUndoAction.AddAffectedObject(viewerObject);
    this.CurrentUndoAction.AddRestoreData( viewerObject.entity, getRestoreData(viewerObject.entity));
}

//  Unsubscibes from the viewer events

 DetouchFromViewerEvents() {
    this.viewer.MouseDown.unsubscribe( this.ViewerMouseDown);
    this.viewer.MouseMove.unsubscribe( this.ViewerMouseMove);
    this.viewer.MouseUp.unsubscribe ( this.ViewerMouseUp);
    this.viewer.GraphChanged.unsubscribe (this.ViewerGraphChanged);
    this.viewer.ViewChangeEvent.unsubscribe (this.ViewChangeEventHandler);
    this.geomGraphEditor.ChangeInUndoRedoList.unsubscribe  ( this.LayoutEditorChangeInUndoRedoList);
}

LayoutEditorChangeInUndoRedoList(sender: Object, e: EventArgs) {
    if ((this.geomGraphEditor.ChangeInUndoRedoList != null)) {
        this.geomGraphEditor.ChangeInUndoRedoList.raise(this, null);
    }

}

TheDefaultObjectDecorator(obj: IViewerObject) {
        const drawingObj = DrawingNode.getDrawingObj(obj.entity);
        const w = drawingObj.penwidth
        if (!this.decoratorRemovalsDict.has(obj))
        this.decoratorRemovalsDict.set(obj, ()=> DrawingObject.getDrawingObj(obj.entity).penwidth = w)
        drawingObj.penwidth = Math.max(this.viewer.LineThicknessForEditing, (w * 2))
      this.viewer.Invalidate(obj);
}

TheDefaultObjectDecoratorRemover(obj: IViewerObject) {
    const decoratorRemover= this.decoratorRemovalsDict.get(obj)
    if (decoratorRemover) {
        decoratorRemover();
        this.decoratorRemovalsDict.delete(obj);
        this.viewer.Invalidate(obj);
    }

    const ent=obj.entity
    if (ent instanceof Node) {
        for (const edge of ent.edges) {
            this.RemoveObjDraggingDecorations(edge.getAttr(AttributeRegistry.ViewerIndex));
        }

    }

}

static TheDefaultEdgeDecoratorStub(edge: IViewerEdge) {

}

static TheDefaultEdgeLabelDecoratorStub(label: IViewerObject) {

}

static LeftButtonIsPressed(mouseButtons: MouseButtons): boolean {
    return ((mouseButtons & MouseButtons.Left)
                == MouseButtons.Left);
}

static MiddleButtonIsPressed(mouseButtons: MouseButtons): boolean {
    return ((mouseButtons & MouseButtons.Middle)
                == MouseButtons.Middle);
}

MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(e: IMsaglMouseEventArgs): boolean {
    let x: number = e.X;
    let y: number = e.Y;
    let dx: number = ((this.MouseDownScreenPoint.x - x)
                / this.viewer.DpiX);
    let dy: number = ((this.MouseDownScreenPoint.y - y)
                / this.viewer.DpiY);
    return (Math.sqrt(((dx * dx)
                    + (dy * dy)))
                > (this.MouseMoveThreshold / 3));
}

AnalyzeLeftMouseButtonClick() {
    let modifierKeyIsPressed: boolean = this.ModifierKeyIsPressed();
    let obj: IViewerObject = this.viewer.ObjectUnderMouseCursor;
    if ((obj != null)) {
        let editableObj = obj.entity
        if (editableObj instanceof Edge) {
            
            let geomEdge = editableObj.getAttr(AttributeRegistry.GeomObjectIndex) as GeomEdge;
                if ((geomEdge != null)
                            && this.viewer.LayoutEditingEnabled) {
                    if ((geomEdge.underlyingPolyline == null)) {
                        geomEdge.underlyingPolyline = LayoutEditor.CreateUnderlyingPolyline(geomEdge);
                    }

                    this.SwitchToEdgeEditing(obj as IViewerEdge);
                }

            

        }
        else {
            if (obj.MarkedForDragging) {
                this.UnselectObjectForDragging(obj);
            }
            else {
                if (!modifierKeyIsPressed) {
                    this.UnselectEverything();
                }

                this.SelectObjectForDragging(obj);
            }

            this.UnselectEdge();
        }

    }

}

static CreateUnderlyingPolyline(geomEdge: GeomEdge): SmoothedPolyline {
    let ret = SmoothedPolyline.mkFromPoints(LayoutEditor.CurvePoints(geomEdge));
    return ret;
}

static *CurvePoints(geomEdge: GeomEdge): IterableIterator<Point> {
    yield  geomEdge.source.center;
            var isCurve = geomEdge.curve instanceof Curve;
            if(isCurve!=null) {
                const curve = geomEdge.curve as Curve;
                if (curve.segs.length > 0)
                    yield  curve.start;
                for (let i = 0; i < curve.segs.length; i++)
                    yield  curve.segs[i].end;
            }
            yield  geomEdge.target.center;
}

//         static void SetCoefficientsCorrecty(SmoothedPolyline ret, ICurve curve) {
//            //  throw new NotImplementedException();
//         }
ModifierKeyIsPressed(): boolean {
    let modifierKeyWasUsed: boolean = (((this.viewer.ModifierKeys & ModifierKeys.Control)
                == ModifierKeys.Control)
                || ((this.viewer.ModifierKeys & ModifierKeys.Shift)
                == ModifierKeys.Shift));
    return modifierKeyWasUsed;
}

SwitchToEdgeEditing(edge: IViewerEdge) {
    this.UnselectEverything();
    throw new Error('not implemented')
    /*
    let editableEdge = (<IEditableObject>(edge));
    if ((editableEdge == null)) {
        return;
    }

    this.SelectedEdge = edge;
    editableEdge.SelectedForEditing = true;
    edge.RadiusOfPolylineCorner = this.viewer.UnderlyingPolylineCircleRadius;
    this.DecorateEdgeForDragging(edge);
    this.viewer.Invalidate(edge);*/
}

*ViewerNodes(): IterableIterator<IViewerNode> {
    for (let o of this.viewer.Entities) {
        if (o.entity instanceof Node)
            yield o.entity.getAttr(AttributeRegistry.ViewerIndex)
    }
}

SelectObjectForDragging(obj: IViewerObject) {
    if ((obj.MarkedForDragging == false)) {
        obj.MarkedForDragging = true;
        this.dragGroup.add(obj);
        this.DecorateObjectForDragging(obj);
    }

}

UnselectObjectForDragging(obj: IViewerObject) {
    this.UnselectWithoutRemovingFromDragGroup(obj);
    this.dragGroup.delete(obj);
}

UnselectWithoutRemovingFromDragGroup(obj: IViewerObject) {
    obj.MarkedForDragging = false;
    this.RemoveObjDraggingDecorations(obj);
}

UnselectEverything() {
    for (let obj: IViewerObject of this.dragGroup) {
        this.viewer.Invalidate(obj);
        this.UnselectWithoutRemovingFromDragGroup(obj);
    }

    this.dragGroup.clear();
    this.UnselectEdge();
}

UnselectEdge() {
    if ((this.SelectedEdge != null)) {
        this.SelectedEdge.SelectedForEditing = false;
        this.removeEdgeDraggingDecorations(this.SelectedEdge);
        this.viewer.Invalidate(this.SelectedEdge);
        this.SelectedEdge = null;
    }

}

static *Edges(node: IViewerNode): IterableIterator<IViewerEdge> {
    for (let edge of (node.entity as Node).edges) {
       yield edge.getAttr(AttributeRegistry.ViewerIndex)
    }
}

ViewerMouseDown(sender: Object, e: IMsaglMouseEventArgs) {
    if ((!this.viewer.LayoutEditingEnabled
                || (this.viewer.Graph == null))) {
        return;
    }

    this.PressedMouseButtons = LayoutEditor.GetPressedButtons(e);
    this.mouseDownGraphPoint = this.viewer.ScreenToSource(e);
    this.MouseDownScreenPoint = new Point(e.X, e.Y);
    if (e.LeftButtonIsPressed) {
        this.LeftMouseButtonWasPressed = true;
        if (!this.InsertingEdge) {
            if (!(this.viewer.ObjectUnderMouseCursor.hasOwnProperty('edge'))) {
                this.ActiveDraggedObject = this.viewer.ObjectUnderMouseCursor;
            }

            if ((this.ActiveDraggedObject != null)) {
                e.Handled = true;
            }

            if ((this.SelectedEdge != null)) {
                this.CheckIfDraggingPolylineVertex(e);
            }

        }
        else if (((this.SourceOfInsertedEdge != null)
                    && ((this.SourcePort != null)
                    && this.DraggingStraightLine()))) {
            this.viewer.StartDrawingRubberLine(this.sourcePort.Location);
        }

    }
    else if (e.RightButtonIsPressed) {
        if ((this.SelectedEdge != null)) {
            this.ProcessRightClickOnSelectedEdge(e);
        }

    }

}
    

ViewerMouseMove(sender: Object, e: IMsaglMouseEventArgs) {
    if (this.viewer.LayoutEditingEnabled) {
        if (e.LeftButtonIsPressed) {
            if (((this.ActiveDraggedObject != null)
                        || (this.PolylineVertex != null))) {
                this.DragSomeObjects(e);
            }
            else if (this.InsertingEdge) {
                this.MouseMoveWhenInsertingEdgeAndPressingLeftButton(e);
            }
            else {
                this.MouseMoveLiveSelectObjectsForDragging(e);
            }

        }
        else if (this.InsertingEdge) {
            this.HandleMouseMoveWhenInsertingEdgeAndNotPressingLeftButton(e);
        }

    }

}

SetDraggingFlag(e: IMsaglMouseEventArgs) {
    if ((!this.Dragging
                && this.MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(e))) {
        this.Dragging = true;
    }

}

TrySetNodePort(e: IMsaglMouseEventArgs, node:{node: IViewerNode}, port:{port: Port}, loosePolyline:{loosePolyline: Polyline}): boolean {
    Assert.assert(this.InsertingEdge);
    const mousePos = this.viewer.ScreenToSource(e);
    loosePolyline.loosePolyline = null;
    const mousePosition={mousePosition:mousePos}
    if ((Graph != null)) {
        if (this.DraggingStraightLine()) {
            node.node = this.SetPortWhenDraggingStraightLine( port, mousePosition);
        }
        else {
            if ((this.InteractiveEdgeRouter == null)) {
                this.PrepareForEdgeDragging();
            }

            loosePolyline.loosePolyline = this.InteractiveEdgeRouter.GetHitLoosePolyline(this.viewer.ScreenToSource(e));
            if ((loosePolyline != null)) {
                this.SetPortUnderLoosePolyline(mousePosition.mousePosition, loosePolyline.loosePolyline, node, port);
            }
            else {
                node.node = null;
                port.port = null;
            }

        }

    }

    return (port != null);
}

SetPortWhenDraggingStraightLine(a:{port: Port}, b:{mousePosition: Point}): IViewerNode {
    let isViewerNode = isIViewerNode(this.viewer.ObjectUnderMouseCursor)
    let viewerNode : IViewerNode = null
    if ((isViewerNode != null)) {
        viewerNode = this.viewer.ObjectUnderMouseCursor as IViewerNode
        let t = {portParameter:0}
        let geomNode = geomObjFromIViewerObj(viewerNode) as GeomNode;
        if (this.NeedToCreateBoundaryPort(b.mousePosition, viewerNode, t)) {
            a.port = this.CreateOrUpdateCurvePort(t.portParameter, geomNode, a.port);
        }
        else {
            a.port = this.CreateFloatingPort(geomNode, b.mousePosition);
        }
        a.port = LayoutEditor.PointIsInside(b.mousePosition, geomNode.boundaryCurve)        ? this.CreateFloatingPort(geomNode, b.mousePosition)
           : null;
        
    }
    else {
        a.port = null;
    }

    return viewerNode;
}

CreateOrUpdateCurvePort(t: number, geomNode: GeomNode, port: Port): Port {
    let isCp = port instanceof CurvePort
    if (!isCp) {
        return CurvePort.mk(geomNode.boundaryCurve, t);
    } 
        const cp = port as CurvePort
    cp.parameter = t;
    cp.curve = geomNode.boundaryCurve;
    return port;
    
}

CreateFloatingPort(geomNode: GeomNode, location: Point): FloatingPort {
    return new FloatingPort(geomNode.boundaryCurve, location);
}

SetPortUnderLoosePolyline(mousePosition: Point, loosePoly: Polyline, node:{node: IViewerNode}, port:{port: Port}) {
    let dist: number = Number.POSITIVE_INFINITY;
    let par: number = 0;
    for (let viewerNode of this.GetViewerNodesInsideOfLooseObstacle(loosePoly)) {
        let curve:ICurve = viewerNode.entity.getAttr(AttributeRegistry.GeomObjectIndex).boundaryCurve;
        if (LayoutEditor.PointIsInside(mousePosition, curve)) {
            node.node = viewerNode;
            this.SetPortForMousePositionInsideOfNode(mousePosition, node.node, port);
            return;
        }

        let p: number = curve.closestParameter(mousePosition);
        let d: number = curve.value(p).sub( mousePosition).length;
        if ((d < dist)) {
            par = p;
            dist = d;
            node.node = viewerNode;
        }

    }

    port.port = this.CreateOrUpdateCurvePort(par, geomObjFromIViewerObj(node.node) as GeomNode, port);
}

*GetViewerNodesInsideOfLooseObstacle(loosePoly: Polyline): IterableIterator<IViewerNode> {
    if ((this.looseObstaclesToTheirViewerNodes == null)) {
        this.InitLooseObstaclesToViewerNodeMap();
    }

    return this.looseObstaclesToTheirViewerNodes.get(loosePoly);
}

InitLooseObstaclesToViewerNodeMap() {
    this.looseObstaclesToTheirViewerNodes = new Map<Polyline, Array<IViewerNode>>();
    for (let viewerNode: IViewerNode of this.ViewerNodes()) {
        let loosePoly: Polyline = this.InteractiveEdgeRouter.GetHitLoosePolyline((geomObjFromIViewerObj(viewerNode) as GeomNode).center);
        let loosePolyNodes: Array<IViewerNode> = this.looseObstaclesToTheirViewerNodes.get(loosePoly)
        if(loosePolyNodes == undefined) {
            this.looseObstaclesToTheirViewerNodes.set(loosePoly, loosePolyNodes = new Array<IViewerNode>());
            
        }

        
        loosePolyNodes.push(viewerNode);
    }

}

SetPortForMousePositionInsideOfNode(mousePosition: Point, node: IViewerNode, port:{port: Port}) {
    let geomNode: GeomNode = geomObjFromIViewerObj(node) as GeomNode;
    let t = {portParameter:0}
    if (this.NeedToCreateBoundaryPort(mousePosition, node, t)) {
        port.port = this.CreateOrUpdateCurvePort(t.portParameter, geomNode, port.port);
    }
    else {
        port.port = this.CreateFloatingPort(geomNode, mousePosition);
    }

}


static PointIsInside(point: Point, iCurve: ICurve): boolean {
    return (Curve.PointRelativeToCurveLocation(point, iCurve) == PointLocation.Inside);
}

NeedToCreateBoundaryPort(mousePoint: Point, node: IViewerNode, t:{portParameter: number}): boolean {
    let drawingNode = node.entity.getAttr(AttributeRegistry.DrawingObjectIndex) as DrawingNode
    let curve: ICurve = (geomObjFromIViewerObj(node) as GeomNode).boundaryCurve;
    t.portParameter = curve.closestParameter(mousePoint);
    let pointOnCurve: Point = curve.value(t.portParameter)
    let length: number = (mousePoint.sub(pointOnCurve)).length;
    if ((length
                <= ((this.viewer.UnderlyingPolylineCircleRadius * 2)
                + (drawingNode.penwidth / 2)))) {
        this.TryToSnapToTheSegmentEnd(t, curve, pointOnCurve);
        return true;
    }

    return false;
}

TryToSnapToTheSegmentEnd( t:{portParameter: number}, c: ICurve, pointOnCurve: Point) {
    if ((c instanceof Curve)) {
        const sipar=c.getSegIndexParam(t.portParameter);
        const segPar = sipar.par
        const seg = c.segs[sipar.segIndex]
        if (((segPar - seg.parStart)
                    < (seg.parEnd - segPar))) {
            if (((seg.start.sub(pointOnCurve)).length
                        < (this.viewer.UnderlyingPolylineCircleRadius * 2))) {
                t.portParameter -=  (segPar - seg.parStart)
            }
            else if (seg.end.sub( pointOnCurve).length
                        < (this.viewer.UnderlyingPolylineCircleRadius * 2)) {
                t.portParameter +=
                            + (seg.parEnd - segPar);
            }

        }

    }

}

_lastDragPoint: Point;

DragSomeObjects(e: IMsaglMouseEventArgs) {
    if (!this.Dragging) {
        if (this.MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(e)) {
            this.Dragging = true;
            // first time we are of Dragging mode
            if ((this.PolylineVertex != null)) {
                this.geomGraphEditor.PrepareForEdgeCornerDragging(<GeomEdge>geomObjFromIViewerObj(this.SelectedEdge), this.PolylineVertex);
            }
            else if ((this.ActiveDraggedObject != null)) {
                this.UnselectEdge();
                if (!this.ActiveDraggedObject.MarkedForDragging) {
                    this.UnselectEverything();
                }

                this.SelectObjectForDragging(this.ActiveDraggedObject);
                this.geomGraphEditor.PrepareForObjectDragging(this.DraggedGeomObjects(), this.GetDraggingMode());
            }

        }

        this._lastDragPoint = this.mouseDownGraphPoint;
    }

    if (!this.Dragging) {
        return;
    }

    let currentDragPoint = this.viewer.ScreenToSource(e);
    this.geomGraphEditor.Drag((currentDragPoint.sub(this._lastDragPoint)), this.GetDraggingMode(), this._lastDragPoint);
    for (let affectedObject of this.CurrentUndoAction.affectedObjects) {
        this.viewer.Invalidate(affectedObject);
    }

    if (this.geomGraphEditor.GraphBoundingBoxGetsExtended) {
        this.viewer.InvalidateAll();
    }

    e.Handled = true;
    this._lastDragPoint = currentDragPoint;
}

GetDraggingMode(): DraggingMode {
    let incremental: boolean = (((this.viewer.ModifierKeys & ModifierKeys.Shift)
                == ModifierKeys.Shift)
                || this.viewer.IncrementalDraggingModeAlways);
    return incremental? DraggingMode.Incremental:
                        DraggingMode.Default;
}

 static RouteEdgesRectilinearly(viewer: IViewer) {
    let geomGraph = viewer.Graph.getAttr(AttributeRegistry.GeomObjectIndex) as GeomGraph;
    let settings = geomGraph.layoutSettings
    RectilinearInteractiveEditor.CreatePortsAndRouteEdges(
        (settings.commonSettings.NodeSeparation / 3), 
        1, geomGraph.deepNodes, geomGraph.deepEdges, settings.commonSettings.edgeRoutingSettings.EdgeRoutingMode)
       
    let labelPlacer = EdgeLabelPlacement.constructorG(geomGraph);
    labelPlacer.run();
}

*DraggedGeomObjects(): IterableIterator<GeomObject> {
    // restrict the dragged elements to be under the same cluster
    let activeObjCluster: Graph = LayoutEditor.GetActiveObjectCluster(this.ActiveDraggedObject);
    for (let draggObj of this.dragGroup) {
        if ((LayoutEditor.GetActiveObjectCluster(draggObj) == activeObjCluster)) {
            yield GeomObject.getGeom(draggObj.entity)
        }

    }

}

static GetActiveObjectCluster(viewerObject: IViewerObject): Graph {
    return viewerObject.entity.parent as Graph
    
}

ViewerMouseUp(sender: Object, args: IMsaglMouseEventArgs) {
    if (args.Handled) {
        return;
    }

    if (this.viewer.LayoutEditingEnabled) {
        this.HandleMouseUpOnLayoutEnabled(args);
    }

}

HandleMouseUpOnLayoutEnabled(args: IMsaglMouseEventArgs) {
    let click: boolean = !this.MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(args);
    if ((click && this.LeftMouseButtonWasPressed)) {
        if ((this.viewer.ObjectUnderMouseCursor != null)) {
            this.AnalyzeLeftMouseButtonClick();
            args.Handled = true;
        }
        else {
            this.UnselectEverything();
        }

    }
    else if (this.Dragging) {
        if (!this.InsertingEdge) {
            this.geomGraphEditor.OnDragEnd((this.viewer.ScreenToSource(args) - this.mouseDownGraphPoint));
            InteractiveEdgeRouter = null;
            this.looseObstaclesToTheirViewerNodes = null;
        }
        else {
            this.InsertEdgeOnMouseUp();
        }

        args.Handled = true;
    }

    this.Dragging = false;
    this.geomGraphEditor.ForgetDragging();
    this.PolylineVertex = null;
    this.ActiveDraggedObject = null;
    this.LeftMouseButtonWasPressed = false;
    if ((this.TargetPort != null)) {
        this.viewer.RemoveTargetPortEdgeRouting();
    }

    if ((this.SourcePort != null)) {
        this.viewer.RemoveSourcePortEdgeRouting();
    }

    this.TargetOfInsertedEdge = null;
    this.SourceOfInsertedEdge = null;
    this.TargetPort = null;
    this.SourcePort = null;
}

edgeAttr: EdgeAttr = new this.EdgeAttr();

InsertEdgeOnMouseUp() {
    if (this.DraggingStraightLine()) {
        this.viewer.StopDrawingRubberLine();
        this.viewer.RemoveSourcePortEdgeRouting();
        this.viewer.RemoveTargetPortEdgeRouting();
        if (((this.SourcePort != null)
                    && ((this.TargetOfInsertedEdge != null)
                    && (this.TargetPort != null)))) {
            let drawingEdge = new Edge((<Node>(this.SourceOfInsertedEdge.DrawingObject)), (<Node>(this.TargetOfInsertedEdge.DrawingObject)), ConnectionToGraph.Connected);
            let edge: IViewerEdge = this.viewer.RouteEdge(drawingEdge);
            this.viewer.AddEdge(edge, true);
            this.AttachLayoutChangeEvent(edge);
        }

    }
    else {
        this.viewer.StopDrawingRubberEdge();
        if ((this.TargetPort != null)) {
            this.FinishRoutingEdge();
            this.AddEdge();
        }

        InteractiveEdgeRouter.Clean();
    }

}

AddEdge() {
    let drawingEdge = new Edge((<Node>(this.SourceOfInsertedEdge.DrawingObject)), (<Node>(this.TargetOfInsertedEdge.DrawingObject)), ConnectionToGraph.Disconnected, this.EdgeAttr.Clone());
    let geomEdge = new GeomEdge(LayoutEditor.GeomNode(this.SourceOfInsertedEdge), LayoutEditor.GeomNode(this.TargetOfInsertedEdge));
    drawingEdge.GeometryEdge = geomEdge;
    drawingEdge.SourcePort = this.SourcePort;
    drawingEdge.TargetPort = this.TargetPort;
    let edge = this.viewer.CreateEdgeWithGivenGeometry(drawingEdge);
    this.viewer.AddEdge(edge, true);
    this.AttachLayoutChangeEvent(edge);
}

FinishRoutingEdge() {
    GeomEdge.SourceArrowhead = null;
    // TODO: Warning!!!, inline IF is not supported ?
    (this.EdgeAttr.ArrowheadAtSource == ArrowStyle.None);
    new Arrowhead();
    GeomEdge.TargetArrowhead = null;
    // TODO: Warning!!!, inline IF is not supported ?
    (this.EdgeAttr.ArrowheadAtTarget == ArrowStyle.None);
    new Arrowhead();
    if ((this.TargetOfInsertedEdge != this.SourceOfInsertedEdge)) {
        InteractiveEdgeRouter.TryToRemoveInflectionsAndCollinearsegs(GeomEdge.SmoothedPolyline);
        InteractiveEdgeRouter.SmoothCorners(GeomEdge.SmoothedPolyline);
        GeomEdge.Curve = GeomEdge.SmoothedPolyline.CreateCurve();
        Arrowheads.TrimSplineAndCalculateArrowheads(GeomEdge, LayoutEditor.GeomNode(this.SourceOfInsertedEdge).boundaryCurve, LayoutEditor.GeomNode(this.TargetOfInsertedEdge).boundaryCurve, GeomEdge.Curve, true);
    }
    else {
        GeomEdge = LayoutEditor.CreateEdgeGeometryForSelfEdge(this.graph.GeometryGraph, LayoutEditor.GeomNode(this.SourceOfInsertedEdge));
    }

    this.viewer.RemoveSourcePortEdgeRouting();
    this.viewer.RemoveTargetPortEdgeRouting();
}

static CreateEdgeGeometryForSelfEdge(geometryGraph: GeomObject, node: GeomNode): GeomEdge {
    let tempEdge = new GeomEdge(node, node);
    StraightLineEdges.CreateSimpleEdgeCurveWithUnderlyingPolyline(tempEdge);
    return tempEdge.GeomEdge;
}

SelectEntitiesForDraggingWithRectangle(args: IMsaglMouseEventArgs) {
    let rect = new Rectangle(this.mouseDownGraphPoint, this.viewer.ScreenToSource(args));
    for (let node: IViewerNode of this.ViewerNodes()) {
        if (rect.intersects(node.node.BoundingBox)) {
            this.SelectObjectForDragging(node);
        }

    }

    args.Handled = true;
}

ProcessRightClickOnSelectedEdge(e: IMsaglMouseEventArgs) {
    this.mouseRightButtonDownPoint = viewer.ScreenToSource(e);
    this.cornerInfo = this.AnalyzeInsertOrDeletePolylineCorner(this.mouseRightButtonDownPoint, this.SelectedEdge.RadiusOfPolylineCorner);
    if ((this.cornerInfo == null)) {
        return;
    }

    e.Handled = true;
    let edgeRemoveCouple = new [string, ()=>void>("Remove edge", () =] {  }, viewer.RemoveEdge(this.SelectedEdge, true));
    if ((this.cornerInfo.Item2 == PolylineCornerType.PreviousCornerForInsertion)) {
        viewer.PopupMenus(new [string, ()=>void]("Insert polyline corner", this.InsertPolylineCorner), edgeRemoveCouple);
    }
    else if ((this.cornerInfo.Item2 == PolylineCornerType.CornerToDelete)) {
        viewer.PopupMenus(new [string, ()=>void]("Delete polyline corner", this.DeleteCorner), edgeRemoveCouple);
    }

}

CheckIfDraggingPolylineVertex(e: IMsaglMouseEventArgs) {
    if (((this.SelectedEdge != null)
                && (this.SelectedEdge.edge.GeometryEdge.UnderlyingPolyline != null))) {
        let site: CornerSite = this.SelectedEdge.edge.GeometryEdge.UnderlyingPolyline.HeadSite;
        for (
        ; (site != null);
        ) {
            if (this.MouseScreenPointIsCloseEnoughToVertex(site.point, (this.SelectedEdge.RadiusOfPolylineCorner
                            + (this.SelectedEdge.edge.Attr.LineWidth / 2)))) {
                this.PolylineVertex = site;
                e.Handled = true;
                break;
            }

            site = site.next;
        }

    }

}

MouseScreenPointIsCloseEnoughToVertex(point: Point, radius: number): boolean {
    return ((point - this.mouseDownGraphPoint).Length < radius);
}

static GetPressedButtons(e: IMsaglMouseEventArgs): MouseButtons {
    let ret = MouseButtons.None;
    if (e.LeftButtonIsPressed) {
        ret = (ret | MouseButtons.Left);
    }

    if (e.MiddleButtonIsPressed) {
        ret = (ret | MouseButtons.Middle);
    }

    if (e.RightButtonIsPressed) {
        ret = (ret | MouseButtons.Right);
    }

    return ret;
}

//  Undoes the editing

 Undo() {
    if (this.geomGraphEditor.CanUndo) {
        let action: UndoRedoAction = this.geomGraphEditor.CurrentUndoAction;
        this.geomGraphEditor.Undo();
        for (let o of action.affectedObjects) {
            this.viewer.Invalidate(o);
        }

        if (action.GraphBoundingBoxHasChanged) {
            this.viewer.Invalidate();
        }

    }

}

//  Redoes the editing

 Redo() {
    if (this.geomGraphEditor.CanRedo) {
        this.geomGraphEditor.UndoMode = false;
        let action: UndoRedoAction = this.geomGraphEditor.CurrentRedoAction;
        this.geomGraphEditor.Redo();
        for (let o of action.affectedObjects) {
            this.viewer.Invalidate(o);
        }

        if (action.GraphBoundingBoxHasChanged) {
            this.viewer.InvalidateAll();
        }

        this.geomGraphEditor.UndoMode = true;
    }

}


// //  Clear the editor

//  Clear() {
//     this.UnselectEverything();
// }

// //  Finds a corner to delete or insert

// //  <returns>null if a corner is not found</returns>

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

// // //  create a tight bounding box for the graph

// //  FitGraphBoundingBox(graphToFit: IViewerObject) {
// //     if ((graphToFit != null)) {
// //         this.geomGraphEditor.FitGraphBoundingBox(graphToFit, (<GeometryGraph>(graphToFit.DrawingObject.GeomObject)));
// //         this.viewer.Invalidate();
// //     }

// // }

// // //

// //  RegisterNodeAdditionForUndo(node: IViewerNode) {
// //     let undoAction = new AddNodeUndoAction(this.graph, this.viewer, node);
// //     this.geomGraphEditor.InsertToListAndSetTheBoxBefore(undoAction);
// // }

// // //  registers the edge addition for undo

// //  RegisterEdgeAdditionForUndo(edge: IViewerEdge) {
// //     this.geomGraphEditor.InsertToListAndSetTheBoxBefore(new AddEdgeUndoAction(this.viewer, edge));
// // }

// // //

// //  RegisterEdgeRemovalForUndo(edge: IViewerEdge) {
// //     this.geomGraphEditor.InsertToListAndSetTheBoxBefore(new RemoveEdgeUndoAction(this.graph, this.viewer, edge));
// // }

// // //

// //  RegisterNodeForRemoval(node: IViewerNode) {
// //     this.geomGraphEditor.InsertToListAndSetTheBoxBefore(new RemoveNodeUndoAction(this.viewer, node));
// // }

// //  static RectRouting(mode: EdgeRoutingMode): boolean {
// //     return ((mode == EdgeRoutingMode.Rectilinear)
// //                 || (mode == EdgeRoutingMode.RectilinearToCenter));
// // }

// // EnumerateNodeBoundaryCurves(): IterableIterator<ICurve> {
// //     return from;
// //     vn;
// //     this.ViewerNodes();
// //     let GeomNode: select;
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

//  prepares for edge dragging

 PrepareForEdgeDragging() {
    if ((this.viewer.Graph == null)) {
        return;
    }

    if (this.DraggingStraightLine()) {
        return;
    }

    let settings = this.viewer.Graph.LayoutAlgorithmSettings;
    if (!LayoutEditor.RectRouting(settings.EdgeRoutingSettings.EdgeRoutingMode)) {
        if ((InteractiveEdgeRouter == null)) {
            let padding = (settings.NodeSeparation / 3);
            let loosePadding = (0.65 * padding);
            InteractiveEdgeRouter = new InteractiveEdgeRouter(this.EnumerateNodeBoundaryCurves(), padding, loosePadding, 0);
        }

    }

}

// // //  insert a polyline corner at the point befor the prevCorner

// //  InsertPolylineCorner(point: Point, previousCorner: CornerSite) {
// //     this.geomGraphEditor.InsertSite(this.SelectedEdge.edge.GeometryEdge, point, previousCorner, this.SelectedEdge);
// //     this.viewer.Invalidate(this.SelectedEdge);
// // }

// // InsertPolylineCorner() {
// //     this.geomGraphEditor.InsertSite(this.SelectedEdge.edge.GeometryEdge, this.mouseRightButtonDownPoint, this.cornerInfo.Item1, this.SelectedEdge);
// //     this.viewer.Invalidate(this.SelectedEdge);
// // }

// // //  delete the polyline corner, shortcut it.

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

HandleMouseMoveWhenInsertingEdgeAndNotPressingLeftButton(e: IMsaglMouseEventArgs) {
    let oldNode: IViewerNode = this.SourceOfInsertedEdge;
    if (this.TrySetNodePort(e, /* ref */this.sourceOfInsertedEdge, /* ref */this.sourcePort, /* out */this.sourceLoosePolyline)) {
        this.viewer.SetSourcePortForEdgeRouting(this.sourcePort.Location);
    }
    else if ((oldNode != null)) {
        this.viewer.RemoveSourcePortEdgeRouting();
    }

}

MouseMoveWhenInsertingEdgeAndPressingLeftButton(e: IMsaglMouseEventArgs) {
    if ((this.SourcePort != null)) {
        this.SetDraggingFlag(e);
        if (this.Dragging) {
            let loosePolyline: Polyline;
            if (this.TrySetNodePort(e, /* ref */this.targetOfInsertedEdge, /* ref */this.targetPort, /* out */loosePolyline)) {
                this.viewer.SetTargetPortForEdgeRouting(this.targetPort.Location);
                if (this.DraggingStraightLine()) {
                    this.viewer.DrawRubberLine(this.TargetPort.Location);
                }
                else {
                    this.DrawEdgeInteractivelyToPort(this.TargetPort, loosePolyline);
                }

            }
            else {
                this.viewer.RemoveTargetPortEdgeRouting();
                if (this.DraggingStraightLine()) {
                    this.viewer.DrawRubberLine(e);
                }
                else {
                    this.DrawEdgeInteractivelyToLocation(e);
                }

            }

        }

        e.Handled = true;
    }

}

MouseMoveLiveSelectObjectsForDragging(e: IMsaglMouseEventArgs) {
    this.UnselectEverything();
    if ((this.ToggleEntityPredicate(this.viewer.ModifierKeys, this.PressedMouseButtons, true)
                && ((this.viewer.ModifierKeys & ModifierKeys.Shift)
                != ModifierKeys.Shift))) {
        this.SelectEntitiesForDraggingWithRectangle(e);
    }

 }

// // DrawEdgeInteractivelyToLocation(e: IMsaglMouseEventArgs) {
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

 DraggingStraightLine(): boolean {
    if ((this.viewer.Graph == null)) {
        return true;
    }

    return ((InteractiveEdgeRouter != null)
                && InteractiveEdgeRouter.OverlapsDetected);
}

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
// //     viewerNode.node.GeomNode.BoundaryCurve = viewerNode.node.GeomNode.BoundaryCurve.Transform(matrix);
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

// // //

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
