import {ArrowTypeEnum} from '../../drawing/arrowTypeEnum'
import {DrawingEdge} from '../../drawing/drawingEdge'
import {DrawingNode} from '../../drawing/drawingNode'
import {DrawingObject} from '../../drawing/drawingObject'

import {Arrowhead} from '../../layout/core/arrowhead'
import {CurvePort} from '../../layout/core/curvePort'
import {FloatingPort} from '../../layout/core/floatingPort'
import {GeomEdge} from '../../layout/core/geomEdge'
import {GeomGraph} from '../../layout/core/geomGraph'
import {GeomNode} from '../../layout/core/geomNode'
import {GeomObject} from '../../layout/core/geomObject'
import {Port} from '../../layout/core/port'
import {layoutGeomGraph} from '../../layout/driver'
import {EdgeLabelPlacement} from '../../layout/edgeLabelPlacement'
import {Polyline, Point, Curve, Rectangle, LineSegment, ICurve, PointLocation} from '../../math/geometry'
import {CornerSite} from '../../math/geometry/cornerSite'
import {SmoothedPolyline} from '../../math/geometry/smoothedPolyline'
import {EdgeRoutingMode} from '../../routing/EdgeRoutingMode'
import {InteractiveEdgeRouter} from '../../routing/interactiveEdgeRouter'
import {RectilinearInteractiveEditor} from '../../routing/rectilinear/RectilinearInteractiveEditor'
import {StraightLineEdges} from '../../routing/StraightLineEdges'
import {AttributeRegistry} from '../../structs/attributeRegistry'
import {Edge} from '../../structs/edge'
import {Entity} from '../../structs/entity'
import {Graph} from '../../structs/graph'
import {Label} from '../../structs/label'
import {Node} from '../../structs/node'
import {Assert} from '../../utils/assert'

import {DraggingMode, GeometryGraphEditor} from './geomGraphEditor'
import {IViewer} from './iViewer'
import {IViewerEdge} from './iViewerEdge'
import {IViewerNode} from './iViewerNode'
import {IViewerObject} from './iViewerObject'
import {ModifierKeysEnum} from './modifierKeys'
import {ObjectUnderMouseCursorChangedEventArgs} from './objectUnderMouseCursorChangedEventArgs'
import {PolylineCornerType} from './polylineCornerType'
import {UndoRedoAction} from './undoRedoAction'
type DelegateForIViewerObject = (o: IViewerObject) => void
type DelegateForEdge = (e: IViewerEdge) => void

function getViewerObj(entity: Entity): IViewerObject {
  return entity.getAttr(AttributeRegistry.ViewerIndex) as IViewerObject
}

function geomObjFromIViewerObj(obj: IViewerObject): GeomObject {
  return GeomObject.getGeom(obj.entity)
}
function geomNodeOfIViewerNode(obj: IViewerObject): GeomNode {
  Assert.assert(GeomObject.getGeom(obj.entity) instanceof GeomNode)
  return GeomObject.getGeom(obj.entity) as GeomNode
}

function isIViewerNode(obj: IViewerObject): boolean {
  return obj.hasOwnProperty('node')
}

type MouseAndKeysAnalyzer = (mouseEvent: MouseEvent) => boolean

export class LayoutEditor {
  RadiusOfPolylineCorner = 10

  aActiveDraggedObject: IViewerObject
  polylineVertex: CornerSite
  geomEdge: GeomEdge = new GeomEdge(null) // keep it to hold the geometry only
  interactiveEdgeRouter: InteractiveEdgeRouter
  selectedEdge: IViewerEdge
  mouseDownScreenPoint: Point
  EdgeAttr: DrawingEdge
  arrowheadLength = Arrowhead.defaultArrowheadLength
  get ActiveDraggedObject(): IViewerObject {
    return this.aActiveDraggedObject
  }
  set ActiveDraggedObject(value: IViewerObject) {
    this.aActiveDraggedObject = value
  }

  cornerInfo: [CornerSite, PolylineCornerType]

  decoratorRemovalsDict: Map<IViewerObject, () => void> = new Map<IViewerObject, () => void>()

  dragGroup: Set<IViewerObject> = new Set<IViewerObject>()

  geomGraphEditor: GeometryGraphEditor = new GeometryGraphEditor()

  graph: Graph

  looseObstaclesToTheirViewerNodes: Map<Polyline, Array<IViewerNode>>

  mouseDownGraphPoint: Point

  mouseMoveThreshold = 0.05

  mouseRightButtonDownPoint: Point

  removeEdgeDraggingDecorations: DelegateForEdge

  sourceLoosePolyline: {loosePolyline: Polyline} = {loosePolyline: null}

  sourceOfInsertedEdge: {node: IViewerNode} = {node: null}

  sourcePort: {port: Port} = {port: null}

  targetOfInsertedEdge: {node: IViewerNode} = {node: null}

  targetPort: {port: Port} = {port: null}

  viewer: IViewer

  get GeomEdge(): GeomEdge {
    return this.geomEdge
  }
  set GeomEdge(value: GeomEdge) {
    this.geomEdge = value
  }

  get InteractiveEdgeRouter(): InteractiveEdgeRouter {
    return this.interactiveEdgeRouter
  }
  set InteractiveEdgeRouter(value: InteractiveEdgeRouter) {
    this.interactiveEdgeRouter = value
  }

  //  Constructor

  constructor(viewerPar: IViewer) {
    this.viewer = viewerPar

    this.decorateObjectForDragging = this.defaultObjectDecorator
    this.removeObjDraggingDecorations = this.defaultObjectDecoratorRemover
    this.DecorateEdgeForDragging = LayoutEditor.TheDefaultEdgeDecoratorStub
    this.decorateEdgeLabelForDragging = this.defaultEdgeLabelDecorator
    this.RemoveEdgeDraggingDecorations = LayoutEditor.TheDefaultEdgeDecoratorStub
  }

  ViewerObjectUnderMouseCursorChanged(sender: any, e: ObjectUnderMouseCursorChangedEventArgs) {
    if (this.TargetPort != null) {
      this.viewer.RemoveTargetPortEdgeRouting()
      this.TargetPort = null
    }
  }

  ViewChangeEventHandler(sender: any, e: any) {
    if (this.graph == null) {
      return
    }
  }

  //  current graph of under editin

  get Graph(): Graph {
    return this.graph
  }
  set Graph(value: Graph) {
    this.graph = value
    if (this.graph != null) {
      this.geomGraphEditor.graph = GeomGraph.getGeom(this.graph)
    }
  }

  //  If the distance between the mouse down point and the mouse up point is greater than the threshold
  //  then we have a mouse move. Otherwise we have a click.

  get MouseMoveThreshold(): number {
    return this.mouseMoveThreshold
  }
  set MouseMoveThreshold(value: number) {
    this.mouseMoveThreshold = value
  }

  dragging: boolean

  get MouseDownScreenPoint(): Point {
    return this.mouseDownScreenPoint
  }
  set MouseDownScreenPoint(value: Point) {
    this.mouseDownScreenPoint = value
  }

  //  a delegate to decorate a node for dragging

  decorateObjectForDragging: DelegateForIViewerObject

  //  a delegate decorate an edge for editing

  private decorateEdgeForDragging: DelegateForEdge
  public get DecorateEdgeForDragging(): DelegateForEdge {
    return this.decorateEdgeForDragging
  }
  public set DecorateEdgeForDragging(value: DelegateForEdge) {
    this.decorateEdgeForDragging = value
  }

  //  a delegate decorate a label for editing

  decorateEdgeLabelForDragging: DelegateForIViewerObject

  //  a delegate to remove node decorations

  removeObjDraggingDecorations: DelegateForIViewerObject

  //  a delegate to remove edge decorations

  get RemoveEdgeDraggingDecorations(): DelegateForEdge {
    return this.removeEdgeDraggingDecorations
  }
  set RemoveEdgeDraggingDecorations(value: DelegateForEdge) {
    this.removeEdgeDraggingDecorations = value
  }

  //  The method analysing keys and mouse buttons to decide if we are inserting a node

  private nodeInsertPredicate: MouseAndKeysAnalyzer
  public get NodeInsertPredicate(): MouseAndKeysAnalyzer {
    return this.nodeInsertPredicate
  }
  public set NodeInsertPredicate(value: MouseAndKeysAnalyzer) {
    this.nodeInsertPredicate = value
  }

  private leftMouseButtonWasPressed: boolean
  public get LeftMouseButtonWasPressed(): boolean {
    return this.leftMouseButtonWasPressed
  }
  public set LeftMouseButtonWasPressed(value: boolean) {
    this.leftMouseButtonWasPressed = value
  }

  get SourceOfInsertedEdge(): IViewerNode {
    return this.sourceOfInsertedEdge.node
  }
  set SourceOfInsertedEdge(value: IViewerNode) {
    this.sourceOfInsertedEdge.node = value
  }

  get TargetOfInsertedEdge(): IViewerNode {
    return this.targetOfInsertedEdge.node
  }
  set TargetOfInsertedEdge(value: IViewerNode) {
    this.targetOfInsertedEdge.node = value
  }

  get SourcePort(): Port {
    return this.sourcePort.port
  }
  set SourcePort(value: Port) {
    this.sourcePort.port = value
  }

  get TargetPort(): Port {
    return this.targetPort.port
  }
  set TargetPort(value: Port) {
    this.targetPort.port = value
  }

  //  returns true if Undo is available

  get CanUndo(): boolean {
    return this.geomGraphEditor.canUndo
  }

  //  return true if Redo is available

  get CanRedo(): boolean {
    return this.geomGraphEditor.canRedo
  }

  //  If set to true then we are of a mode for node insertion

  get InsertingEdge(): boolean {
    if (this.viewer == null) {
      return false
    }

    return this.viewer.InsertingEdge
  }
  set InsertingEdge(value: boolean) {
    if (this.viewer == null) {
      return
    }

    this.viewer.InsertingEdge = value
  }

  //  current undo action

  get undoAction(): UndoRedoAction {
    return this.geomGraphEditor.getCurrentUndoRedoAction()
  }

  viewerGraphChanged() {
    this.graph = this.viewer.graph
    this.geomGraphEditor.clear()
    if (this.graph != null && GeomGraph.getGeom(this.graph) != null) {
      this.geomGraphEditor.graph = GeomGraph.getGeom(this.graph)
    }

    this.ActiveDraggedObject = null
    this.decoratorRemovalsDict.clear()
    this.dragGroup.clear()
    this.cleanObstacles()
  }

  cleanObstacles() {
    this.InteractiveEdgeRouter = null
    this.looseObstaclesToTheirViewerNodes = null
    this.SourceOfInsertedEdge = null
    this.TargetOfInsertedEdge = null
    this.SourcePort = null
    this.TargetPort = null
    this.viewer.RemoveSourcePortEdgeRouting()
    this.viewer.RemoveTargetPortEdgeRouting()
  }

  RelayoutOnIsCollapsedChanged(iCluster: IViewerNode) {
    this.geomGraphEditor.PrepareForClusterCollapseChange([iCluster])
    const geomGraph = GeomGraph.getGeom(iCluster.node as Graph)
    if (geomGraph.isCollapsed) {
      this.CollapseCluster(iCluster.node as Graph)
    } else {
      this.ExpandCluster(geomGraph)
    }

    // LayoutAlgorithmSettings.ShowGraph(viewer.Graph.GeometryGraph);
    for (const o of this.geomGraphEditor.currentUndoAction.entities()) {
      this.viewer.invalidate(o.getAttr(AttributeRegistry.ViewerIndex))
    }
  }

  relayout(cluster: GeomGraph) {
    let parent = cluster
    while (parent.parent != null) {
      parent = parent.parent as GeomGraph
    }
    layoutGeomGraph(parent) // TODO: this call relayouts everything. Try to optimize.
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
      iviewerNode.isVisible = true
      if (node instanceof Graph) {
        const geomGraph = node.getAttr(AttributeRegistry.GeomObjectIndex) as GeomGraph
        if (geomGraph.isCollapsed == false) this.MakeExpandedNodesVisible(node)
      }
    }
  }

  static UnhideNodeEdges(drn: Node) {
    for (const e of drn.selfEdges) {
      const viewerObject = e.getAttr(AttributeRegistry.ViewerIndex) as IViewerObject
      viewerObject.isVisible = true
    }

    for (const e of drn.outEdges) {
      if (getViewerObj(e.target).isVisible) getViewerObj(e).isVisible = true
    }

    for (const e of drn.inEdges) {
      if (getViewerObj(e.source).isVisible) getViewerObj(e).isVisible = true
    }
  }

  CollapseCluster(graph: Graph) {
    LayoutEditor.HideCollapsed(graph)
    const geomCluster = GeomGraph.getGeom(graph)
    const center = geomCluster.center
    geomCluster.boundingBox = Rectangle.mkSizeCenter(geomCluster.labelSize, center)
    this.relayout(geomCluster)
  }

  static HideCollapsed(cluster: Graph) {
    for (const n of cluster.shallowNodes) {
      getViewerObj(n).isVisible = false
      if (n instanceof Graph) {
        if (GeomGraph.getGeom(n).isCollapsed == false) LayoutEditor.HideCollapsed(n)
      }
    }
  }

  defaultObjectDecorator(obj: IViewerObject) {
    if (obj.entity instanceof Label) {
      this.decorateEdgeLabelForDragging(obj)
      return
    }
    const drawingObj = DrawingNode.getDrawingObj(obj.entity)
    const w = drawingObj.penwidth
    if (!this.decoratorRemovalsDict.has(obj))
      this.decoratorRemovalsDict.set(obj, () => (DrawingObject.getDrawingObj(obj.entity).penwidth = w))
    drawingObj.penwidth = Math.max(this.viewer.LineThicknessForEditing, w * 2)
    this.viewer.invalidate(obj)
  }

  defaultObjectDecoratorRemover(obj: IViewerObject) {
    const decoratorRemover = this.decoratorRemovalsDict.get(obj)
    if (decoratorRemover) {
      decoratorRemover()
      this.decoratorRemovalsDict.delete(obj)
      this.viewer.invalidate(obj)
    }

    const ent = obj.entity
    if (ent instanceof Node) {
      for (const edge of ent.edges) {
        this.removeObjDraggingDecorations(edge.getAttr(AttributeRegistry.ViewerIndex))
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  static TheDefaultEdgeDecoratorStub(edge: IViewerEdge) {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  defaultEdgeLabelDecorator(label: IViewerObject) {
    if (!this.decoratorRemovalsDict.has(label)) {
      this.decoratorRemovalsDict.set(label, () => this.viewer.invalidate(label))
    }
    this.viewer.invalidate(label)
  }

  static LeftButtonIsPressed(e: MouseEvent): boolean {
    return (e.buttons & 1) == 1
  }

  static MiddleButtonIsPressed(e: MouseEvent): boolean {
    return (e.buttons & 4) == 4
  }
  static RightButtonIsPressed(e: MouseEvent): boolean {
    return (e.buttons & 2) == 2
  }

  MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(e: MouseEvent): boolean {
    const x: number = e.clientX
    const y: number = e.clientY
    const dx: number = (this.MouseDownScreenPoint.x - x) / this.viewer.DpiX
    const dy: number = (this.MouseDownScreenPoint.y - y) / this.viewer.DpiY
    return Math.sqrt(dx * dx + dy * dy) > this.MouseMoveThreshold / 3
  }

  analyzeLeftMouseButtonClick(e: MouseEvent) {
    const modifierKeyIsPressed: boolean = e.ctrlKey || e.shiftKey
    const obj: IViewerObject = this.viewer.objectUnderMouseCursor
    if (obj != null) {
      const editableObj = obj.entity
      if (editableObj instanceof Edge) {
        const geomEdge = editableObj.getAttr(AttributeRegistry.GeomObjectIndex) as GeomEdge
        if (geomEdge != null && this.viewer.LayoutEditingEnabled) {
          if (geomEdge.smoothedPolyline == null) {
            geomEdge.smoothedPolyline = LayoutEditor.CreateUnderlyingPolyline(geomEdge)
          }

          this.switchToEdgeEditing(obj as IViewerEdge)
        }
      } else {
        if (obj.markedForDragging) {
          this.unselectForDragging(obj)
        } else {
          if (!modifierKeyIsPressed) {
            this.unselectEverything()
          }

          this.selectObjectForDragging(obj)
        }

        this.unselectEdge()
      }
    }
  }

  static CreateUnderlyingPolyline(geomEdge: GeomEdge): SmoothedPolyline {
    const ret = SmoothedPolyline.mkFromPoints(LayoutEditor.CurvePoints(geomEdge))
    return ret
  }

  static *CurvePoints(geomEdge: GeomEdge): IterableIterator<Point> {
    yield geomEdge.source.center
    const isCurve = geomEdge.curve instanceof Curve
    if (isCurve) {
      const curve = geomEdge.curve as Curve
      if (curve.segs.length > 0) yield curve.start
      for (let i = 0; i < curve.segs.length; i++) yield curve.segs[i].end
    }
    yield geomEdge.target.center
  }

  //         static void SetCoefficientsCorrecty(SmoothedPolyline ret, ICurve curve) {
  //            //  throw new NotImplementedException();
  //         }
  ModifierKeyIsPressed(): boolean {
    const modifierKeyWasUsed: boolean =
      (this.viewer.ModifierKeys & ModifierKeysEnum.Control) == ModifierKeysEnum.Control ||
      (this.viewer.ModifierKeys & ModifierKeysEnum.Shift) == ModifierKeysEnum.Shift
    return modifierKeyWasUsed
  }

  switchToEdgeEditing(edge: IViewerEdge) {
    this.unselectEverything()
    this.selectedEdge = edge
    edge.selectedForEditing = true
    edge.radiusOfPolylineCorner = this.viewer.smoothedPolylineCircleRadius
    this.DecorateEdgeForDragging(edge)
    this.viewer.invalidate(edge)
  }

  *ViewerNodes(): IterableIterator<IViewerNode> {
    for (const o of this.viewer.entities) {
      if (o.entity instanceof Node) yield o.entity.getAttr(AttributeRegistry.ViewerIndex)
    }
  }

  selectObjectForDragging(obj: IViewerObject) {
    if (obj.markedForDragging == false) {
      obj.markedForDragging = true
      this.dragGroup.add(obj)
      this.decorateObjectForDragging(obj)
    }
  }

  prepareToRemoveFromDragGroup(obj: IViewerObject) {
    obj.markedForDragging = false
    this.removeObjDraggingDecorations(obj)
  }

  unselectForDragging(obj: IViewerObject) {
    this.prepareToRemoveFromDragGroup(obj)
    this.dragGroup.delete(obj)
  }

  unselectEverything() {
    for (const obj of this.dragGroup) {
      this.prepareToRemoveFromDragGroup(obj)
    }

    this.dragGroup.clear()
    this.unselectEdge()
  }

  unselectEdge() {
    if (this.selectedEdge != null) {
      this.selectedEdge.selectedForEditing = false
      this.removeEdgeDraggingDecorations(this.selectedEdge)
      this.viewer.invalidate(this.selectedEdge)
      this.selectedEdge = null
    }
  }

  static *Edges(node: IViewerNode): IterableIterator<IViewerEdge> {
    for (const edge of (node.entity as Node).edges) {
      yield edge.getAttr(AttributeRegistry.ViewerIndex)
    }
  }

  ViewerMouseDown(sender: any, e: MouseEvent) {
    if (!this.viewer.LayoutEditingEnabled || this.viewer.graph == null) {
      return
    }

    this.mouseDownGraphPoint = this.viewer.ScreenToSource(e)
    this.MouseDownScreenPoint = new Point(e.clientX, e.clientY)
    if (LayoutEditor.LeftButtonIsPressed(e)) {
      this.LeftMouseButtonWasPressed = true
      if (!this.InsertingEdge) {
        const obj = this.viewer.objectUnderMouseCursor

        if (obj && !this.viewer.objectUnderMouseCursor.hasOwnProperty('edge')) {
          this.ActiveDraggedObject = obj
        }

        if (this.ActiveDraggedObject != null) {
          e.preventDefault()
        }

        if (this.selectedEdge != null) {
          this.checkIfDraggingPolylineVertex(e)
        }
      } else if (this.SourceOfInsertedEdge != null && this.SourcePort != null && this.DraggingStraightLine()) {
        this.viewer.StartDrawingRubberLine(this.sourcePort.port.Location)
      }
    } else if (LayoutEditor.RightButtonIsPressed(e)) {
      if (this.selectedEdge != null) {
        this.ProcessRightClickOnSelectedEdge(e)
      }
    }
  }

  viewerMouseMove(sender: any, e: MouseEvent) {
    if (!this.viewer.LayoutEditingEnabled) {
      return
    }

    if (LayoutEditor.LeftButtonIsPressed(e)) {
      if (this.ActiveDraggedObject != null || this.polylineVertex != null) {
        this.drag(e)
      } else if (this.InsertingEdge) {
        this.MouseMoveWhenInsertingEdgeAndPressingLeftButton(e)
      } else {
        this.MouseMoveLiveSelectObjectsForDragging(e)
      }
    } else if (this.InsertingEdge) {
      this.HandleMouseMoveWhenInsertingEdgeAndNotPressingLeftButton(e)
    }
  }

  SetDraggingFlag(e: MouseEvent) {
    if (!this.dragging && this.MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(e)) {
      this.dragging = true
    }
  }

  TrySetNodePort(e: MouseEvent, node: {node: IViewerNode}, port: {port: Port}, loosePolyline: {loosePolyline: Polyline}): boolean {
    Assert.assert(this.InsertingEdge)
    const mousePos = this.viewer.ScreenToSource(e)
    loosePolyline.loosePolyline = null
    const mousePosition = {mousePosition: mousePos}
    if (Graph != null) {
      if (this.DraggingStraightLine()) {
        node.node = this.SetPortWhenDraggingStraightLine(port, mousePosition)
      } else {
        if (this.InteractiveEdgeRouter == null) {
          this.PrepareForEdgeDragging()
        }

        loosePolyline.loosePolyline = this.InteractiveEdgeRouter.GetHitLoosePolyline(this.viewer.ScreenToSource(e))
        if (loosePolyline != null) {
          this.SetPortUnderLoosePolyline(mousePosition.mousePosition, loosePolyline.loosePolyline, node, port)
        } else {
          node.node = null
          port.port = null
        }
      }
    }

    return port != null
  }

  SetPortWhenDraggingStraightLine(a: {port: Port}, b: {mousePosition: Point}): IViewerNode {
    const isViewerNode = isIViewerNode(this.viewer.objectUnderMouseCursor)
    let viewerNode: IViewerNode = null
    if (isViewerNode != null) {
      viewerNode = this.viewer.objectUnderMouseCursor as IViewerNode
      const t = {portParameter: 0}
      const geomNode = geomObjFromIViewerObj(viewerNode) as GeomNode
      if (this.NeedToCreateBoundaryPort(b.mousePosition, viewerNode, t)) {
        a.port = this.CreateOrUpdateCurvePort(t.portParameter, geomNode, a.port)
      } else {
        a.port = this.CreateFloatingPort(geomNode, b.mousePosition)
      }
      a.port = LayoutEditor.PointIsInside(b.mousePosition, geomNode.boundaryCurve)
        ? this.CreateFloatingPort(geomNode, b.mousePosition)
        : null
    } else {
      a.port = null
    }

    return viewerNode
  }

  CreateOrUpdateCurvePort(t: number, geomNode: GeomNode, port: Port): Port {
    const isCp = port instanceof CurvePort
    if (!isCp) {
      return CurvePort.mk(geomNode.boundaryCurve, t)
    }
    const cp = port as CurvePort
    cp.parameter = t
    cp.curve = geomNode.boundaryCurve
    return port
  }

  CreateFloatingPort(geomNode: GeomNode, location: Point): FloatingPort {
    return new FloatingPort(geomNode.boundaryCurve, location)
  }

  SetPortUnderLoosePolyline(mousePosition: Point, loosePoly: Polyline, node: {node: IViewerNode}, port: {port: Port}) {
    let dist: number = Number.POSITIVE_INFINITY
    let par = 0
    for (const viewerNode of this.GetViewerNodesInsideOfLooseObstacle(loosePoly)) {
      const curve: ICurve = viewerNode.entity.getAttr(AttributeRegistry.GeomObjectIndex).boundaryCurve
      if (LayoutEditor.PointIsInside(mousePosition, curve)) {
        node.node = viewerNode
        this.SetPortForMousePositionInsideOfNode(mousePosition, node.node, port)
        return
      }

      const p: number = curve.closestParameter(mousePosition)
      const d: number = curve.value(p).sub(mousePosition).length
      if (d < dist) {
        par = p
        dist = d
        node.node = viewerNode
      }
    }

    port.port = this.CreateOrUpdateCurvePort(par, geomObjFromIViewerObj(node.node) as GeomNode, port.port)
  }

  *GetViewerNodesInsideOfLooseObstacle(loosePoly: Polyline): IterableIterator<IViewerNode> {
    if (this.looseObstaclesToTheirViewerNodes == null) {
      this.InitLooseObstaclesToViewerNodeMap()
    }

    return this.looseObstaclesToTheirViewerNodes.get(loosePoly)
  }

  InitLooseObstaclesToViewerNodeMap() {
    this.looseObstaclesToTheirViewerNodes = new Map<Polyline, Array<IViewerNode>>()
    for (const viewerNode of this.ViewerNodes()) {
      const loosePoly: Polyline = this.InteractiveEdgeRouter.GetHitLoosePolyline((geomObjFromIViewerObj(viewerNode) as GeomNode).center)
      let loosePolyNodes: Array<IViewerNode> = this.looseObstaclesToTheirViewerNodes.get(loosePoly)
      if (loosePolyNodes == undefined) {
        this.looseObstaclesToTheirViewerNodes.set(loosePoly, (loosePolyNodes = new Array<IViewerNode>()))
      }

      loosePolyNodes.push(viewerNode)
    }
  }

  SetPortForMousePositionInsideOfNode(mousePosition: Point, node: IViewerNode, port: {port: Port}) {
    const geomNode: GeomNode = geomObjFromIViewerObj(node) as GeomNode
    const t = {portParameter: 0}
    if (this.NeedToCreateBoundaryPort(mousePosition, node, t)) {
      port.port = this.CreateOrUpdateCurvePort(t.portParameter, geomNode, port.port)
    } else {
      port.port = this.CreateFloatingPort(geomNode, mousePosition)
    }
  }

  static PointIsInside(point: Point, iCurve: ICurve): boolean {
    return Curve.PointRelativeToCurveLocation(point, iCurve) == PointLocation.Inside
  }

  NeedToCreateBoundaryPort(mousePoint: Point, node: IViewerNode, t: {portParameter: number}): boolean {
    const drawingNode = node.entity.getAttr(AttributeRegistry.DrawingObjectIndex) as DrawingNode
    const curve: ICurve = (geomObjFromIViewerObj(node) as GeomNode).boundaryCurve
    t.portParameter = curve.closestParameter(mousePoint)
    const pointOnCurve: Point = curve.value(t.portParameter)
    const length: number = mousePoint.sub(pointOnCurve).length
    if (length <= this.viewer.smoothedPolylineCircleRadius * 2 + drawingNode.penwidth / 2) {
      this.TryToSnapToTheSegmentEnd(t, curve, pointOnCurve)
      return true
    }

    return false
  }

  TryToSnapToTheSegmentEnd(t: {portParameter: number}, c: ICurve, pointOnCurve: Point) {
    if (c instanceof Curve) {
      const sipar = c.getSegIndexParam(t.portParameter)
      const segPar = sipar.par
      const seg = c.segs[sipar.segIndex]
      if (segPar - seg.parStart < seg.parEnd - segPar) {
        if (seg.start.sub(pointOnCurve).length < this.viewer.smoothedPolylineCircleRadius * 2) {
          t.portParameter -= segPar - seg.parStart
        } else if (seg.end.sub(pointOnCurve).length < this.viewer.smoothedPolylineCircleRadius * 2) {
          t.portParameter += +(seg.parEnd - segPar)
        }
      }
    }
  }

  _lastDragPoint: Point

  drag(e: MouseEvent) {
    if (!this.dragging) {
      if (this.MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(e)) {
        this.dragging = true
        // first time we are in dragging
        if (this.polylineVertex != null) {
          this.geomGraphEditor.prepareForEdgeCornerDragging(this.selectedEdge.edge.getAttr(AttributeRegistry.GeomObjectIndex))
        } else if (this.ActiveDraggedObject != null) {
          this.unselectEdge()
          if (!this.ActiveDraggedObject.markedForDragging) {
            this.unselectEverything()
          }
          this.prepareForDragging()
        }
      }

      this._lastDragPoint = this.mouseDownGraphPoint
    }

    if (!this.dragging) {
      return
    }

    const currentDragPoint = this.viewer.ScreenToSource(e)
    this.geomGraphEditor.drag(currentDragPoint.sub(this._lastDragPoint), this.GetDraggingMode(), this._lastDragPoint)
    for (const affectedObject of this.undoAction.entities()) {
      this.viewer.invalidate(affectedObject.getAttr(AttributeRegistry.ViewerIndex))
    }

    if (this.geomGraphEditor.GraphBoundingBoxGetsExtended) {
      this.viewer.invalidateAll()
    }

    e.stopPropagation()
    this._lastDragPoint = currentDragPoint
  }

  private prepareForDragging() {
    this.selectObjectForDragging(this.ActiveDraggedObject)
    this.geomGraphEditor.prepareForObjectDragging(this.DraggedGeomObjects(), this.GetDraggingMode())
    //  const currentUndoRedo = this.undoAction
    // for (const g of this.geomGraphEditor.objectsToDrag) {
    //   currentUndoRedo.AddAffectedObject(g.entity.getAttr(AttributeRegistry.ViewerIndex))
    //   currentUndoRedo.AddRestoreData(g.entity, getRestoreData(g.entity))
    // }
  }

  GetDraggingMode(): DraggingMode {
    const incremental: boolean =
      (this.viewer.ModifierKeys & ModifierKeysEnum.Shift) == ModifierKeysEnum.Shift || this.viewer.IncrementalDraggingModeAlways
    return incremental ? DraggingMode.Incremental : DraggingMode.Default
  }

  static RouteEdgesRectilinearly(viewer: IViewer) {
    const geomGraph = viewer.graph.getAttr(AttributeRegistry.GeomObjectIndex) as GeomGraph
    const settings = geomGraph.layoutSettings
    RectilinearInteractiveEditor.CreatePortsAndRouteEdges(
      settings.commonSettings.NodeSeparation / 3,
      1,
      geomGraph.deepNodes,
      geomGraph.deepEdges,
      settings.commonSettings.edgeRoutingSettings.EdgeRoutingMode,
    )

    const labelPlacer = EdgeLabelPlacement.constructorG(geomGraph)
    labelPlacer.run()
  }

  *DraggedGeomObjects(): IterableIterator<GeomObject> {
    // restrict the dragged elements to be under the same cluster
    const activeObjCluster: Graph = LayoutEditor.GetActiveObjectCluster(this.ActiveDraggedObject)
    for (const draggObj of this.dragGroup) {
      if (LayoutEditor.GetActiveObjectCluster(draggObj) == activeObjCluster) {
        yield GeomObject.getGeom(draggObj.entity)
      }
    }
  }

  static GetActiveObjectCluster(viewerObject: IViewerObject): Graph {
    return viewerObject.entity.parent as Graph
  }

  ViewerMouseUp(sender: any, args: MouseEvent) {
    if (args.defaultPrevented) {
      return
    }

    if (!this.viewer.LayoutEditingEnabled) {
      return
    }
    this.HandleMouseUpOnLayoutEnabled(args)
  }

  HandleMouseUpOnLayoutEnabled(args: MouseEvent) {
    const click = !this.MouseDownPointAndMouseUpPointsAreFarEnoughOnScreen(args)
    if (click && this.LeftMouseButtonWasPressed) {
      if (this.viewer.objectUnderMouseCursor != null) {
        this.analyzeLeftMouseButtonClick(args)
        args.preventDefault()
      } else {
        this.unselectEverything()
      }
    } else if (this.dragging) {
      if (!this.InsertingEdge) {
        this.InteractiveEdgeRouter = null
        this.looseObstaclesToTheirViewerNodes = null
      } else {
        this.InsertEdgeOnMouseUp()
      }

      args.preventDefault()
    }

    this.dragging = false
    this.geomGraphEditor.ForgetDragging()
    this.polylineVertex = null
    this.ActiveDraggedObject = null
    this.LeftMouseButtonWasPressed = false
    if (this.TargetPort != null) {
      this.viewer.RemoveTargetPortEdgeRouting()
    }

    if (this.SourcePort != null) {
      this.viewer.RemoveSourcePortEdgeRouting()
    }

    this.TargetOfInsertedEdge = null
    this.SourceOfInsertedEdge = null
    this.TargetPort = null
    this.SourcePort = null
  }

  edgeAttr: DrawingEdge = new DrawingEdge(null, true)

  InsertEdgeOnMouseUp() {
    if (this.DraggingStraightLine()) {
      this.viewer.StopDrawingRubberLine()
      this.viewer.RemoveSourcePortEdgeRouting()
      this.viewer.RemoveTargetPortEdgeRouting()
      if (this.SourcePort != null && this.TargetOfInsertedEdge != null && this.TargetPort != null) {
        const edge = new Edge(<Node>this.SourceOfInsertedEdge.entity, <Node>this.TargetOfInsertedEdge.entity)
        edge.setAttr(AttributeRegistry.DrawingObjectIndex, this.EdgeAttr.clone())
        const iEdge: IViewerEdge = this.viewer.RouteEdge(edge)
        this.viewer.AddEdge(iEdge, true)
        // take care of undo() : TODO
      }
    } else {
      this.viewer.StopDrawingRubberEdge()
      if (this.TargetPort != null) {
        this.FinishRoutingEdge()
        this.AddEdge()
      }

      this.InteractiveEdgeRouter.Clean()
    }
  }

  AddEdge() {
    const edge = new Edge(<Node>this.SourceOfInsertedEdge.entity, <Node>this.TargetOfInsertedEdge.entity)
    edge.setAttr(AttributeRegistry.DrawingObjectIndex, this.EdgeAttr.clone())
    this.GeomEdge = new GeomEdge(edge)
    this.GeomEdge.sourcePort = this.SourcePort
    this.GeomEdge.targetPort = this.TargetPort
    const iEdge = this.viewer.CreateEdgeWithGivenGeometry(edge)
    this.viewer.AddEdge(iEdge, true)
    // take care of undo() : TODO
  }

  mkArrowhead(): Arrowhead {
    const arr = new Arrowhead()
    arr.length = this.arrowheadLength
    return arr
  }

  FinishRoutingEdge() {
    this.GeomEdge.sourceArrowhead = this.EdgeAttr.arrowhead == ArrowTypeEnum.none ? null : this.mkArrowhead()
    this.GeomEdge.targetArrowhead = this.EdgeAttr.arrowtail == ArrowTypeEnum.none ? null : this.mkArrowhead()
    if (this.TargetOfInsertedEdge != this.SourceOfInsertedEdge) {
      this.InteractiveEdgeRouter.TryToRemoveInflectionsAndCollinearSegments(this.GeomEdge.smoothedPolyline)
      this.InteractiveEdgeRouter.SmoothenCorners(this.GeomEdge.smoothedPolyline)
      this.GeomEdge.curve = this.GeomEdge.smoothedPolyline.createCurve()
      Arrowhead.trimSplineAndCalculateArrowheads(this.GeomEdge, this.GeomEdge.curve, true)
    } else {
      this.GeomEdge = LayoutEditor.CreateEdgeGeometryForSelfEdge(this.SourceOfInsertedEdge.entity as Node)
    }

    this.viewer.RemoveSourcePortEdgeRouting()
    this.viewer.RemoveTargetPortEdgeRouting()
  }

  static CreateEdgeGeometryForSelfEdge(node: Node): GeomEdge {
    const edge = new Edge(node, node)
    const geomEdge = new GeomEdge(edge)
    StraightLineEdges.CreateSimpleEdgeCurveWithUnderlyingPolyline(geomEdge)
    return geomEdge
  }

  SelectEntitiesForDraggingWithRectangle(args: MouseEvent) {
    const rect = Rectangle.mkPP(this.mouseDownGraphPoint, this.viewer.ScreenToSource(args))
    for (const node of this.ViewerNodes()) {
      if (rect.intersects(geomNodeOfIViewerNode(node).boundingBox)) {
        this.selectObjectForDragging(node)
      }
    }

    args.preventDefault()
  }

  ProcessRightClickOnSelectedEdge(e: MouseEvent) {
    this.mouseRightButtonDownPoint = this.viewer.ScreenToSource(e)
    this.cornerInfo = this.AnalyzeInsertOrDeletePolylineCorner(this.mouseRightButtonDownPoint, this.RadiusOfPolylineCorner)
    if (this.cornerInfo == null) {
      return
    }
    throw new Error('not implemented')

    // e.Handled = true;
    // let edgeRemoveCouple = new [string, ()=>void>("Remove edge", () =] {  }, viewer.RemoveEdge(this.SelectedEdge, true));
    // if ((this.cornerInfo.Item2 == PolylineCornerType.PreviousCornerForInsertion)) {
    //     viewer.PopupMenus(new [string, ()=>void]("Insert polyline corner",  this.InsertPolylineCorner), edgeRemoveCouple);
    // }
    //
    // else if ((this.cornerInfo.Item2 == PolylineCornerType.CornerToDelete)) {
    //     viewer.PopupMenus(new [string, ()=>void]("Delete polyline corner", this.DeleteCorner), edgeRemoveCouple);
    // }
  }

  checkIfDraggingPolylineVertex(e: MouseEvent) {
    let cornerSite = this.selectedEdge.edge.getAttr(AttributeRegistry.GeomObjectIndex).smoothedPolyline.headSite
    const p = this.viewer.ScreenToSource(e)
    const lw = this.selectedEdge.edge.getAttr(AttributeRegistry.DrawingObjectIndex).penwidth
    while (cornerSite) {
      const dist = p.sub(cornerSite.point).length - lw
      if (dist <= this.selectedEdge.radiusOfPolylineCorner) {
        this.polylineVertex = cornerSite
        break
      }
      cornerSite = cornerSite.next
    }
  }

  MouseScreenPointIsCloseEnoughToVertex(point: Point, radius: number): boolean {
    return point.sub(this.mouseDownGraphPoint).length < radius
  }

  //  Undoes the editing

  undo() {
    if (this.geomGraphEditor.canUndo) {
      const action: UndoRedoAction = this.geomGraphEditor.currentUndoAction
      const objectsToInvalidate = action.entities()

      this.geomGraphEditor.undo()
      for (const o of objectsToInvalidate) {
        this.viewer.invalidate(o.getAttr(AttributeRegistry.ViewerIndex))
      }
    }
  }

  //  Redoes the editing

  redo() {
    if (this.geomGraphEditor.canRedo) {
      const action: UndoRedoAction = this.undoAction
      const objectsToInvalidate = Array.from(action.entities())
      this.geomGraphEditor.redo()
      for (const o of objectsToInvalidate) {
        this.viewer.invalidate(o.getAttr(AttributeRegistry.ViewerIndex))
      }
    }
  }

  // //  Clear the editor

  //  Clear() {
  //     this.UnselectEverything();
  // }

  // //  Finds a corner to delete or insert

  // //  <returns>null if a corner is not found</returns>

  AnalyzeInsertOrDeletePolylineCorner(point: Point, tolerance: number): [CornerSite, PolylineCornerType] {
    throw new Error('not implemented')
    // if ((this.SelectedEdge == null)) {
    //     return null;
    // }

    // tolerance = (tolerance + this.SelectedEdge.edge.Attr.LineWidth);
    // let corner: CornerSite = GeometryGraphEditor.FindCornerForEdit(this.SelectedEdge.edge.GeometryEdge.UnderlyingPolyline, point, tolerance);
    // if ((corner != null)) {
    //     return new [CornerSite, PolylineCornerType](corner, PolylineCornerType.CornerToDelete);
    // }

    // corner = GeometryGraphEditor.GetPreviousSite(this.SelectedEdge.edge.GeometryEdge, point);
    // if ((corner != null)) {
    //     return new [CornerSite, PolylineCornerType](corner, PolylineCornerType.PreviousCornerForInsertion);
    // }

    // return null;
  }

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

  static RectRouting(mode: EdgeRoutingMode): boolean {
    return mode == EdgeRoutingMode.Rectilinear || mode == EdgeRoutingMode.RectilinearToCenter
  }

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
    if (this.viewer.graph == null) {
      return
    }

    if (this.DraggingStraightLine()) {
      return
    }

    const settings = GeomGraph.getGeom(this.viewer.graph).layoutSettings
    if (!LayoutEditor.RectRouting(settings.commonSettings.edgeRoutingSettings.EdgeRoutingMode)) {
      if (InteractiveEdgeRouter == null) {
        const padding = settings.commonSettings.NodeSeparation / 3
        const loosePadding = 0.65 * padding
        this.InteractiveEdgeRouter = new InteractiveEdgeRouter(null)
        this.InteractiveEdgeRouter.obstacles_ = Array.from(this.graph.deepNodes).map((n) => (GeomNode.getGeom(n) as GeomNode).boundaryCurve)
        this.InteractiveEdgeRouter.TightPadding = padding
        this.InteractiveEdgeRouter.loosePadding = loosePadding
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

  HandleMouseMoveWhenInsertingEdgeAndNotPressingLeftButton(e: MouseEvent) {
    const oldNode: IViewerNode = this.SourceOfInsertedEdge
    const nodeBox: {node: IViewerNode} = {node: null}
    const portBox: {port: Port} = {port: null}
    const polyBox: {loosePolyline: Polyline} = {loosePolyline: null}
    if (this.TrySetNodePort(e, this.sourceOfInsertedEdge, this.sourcePort, this.sourceLoosePolyline)) {
      this.viewer.SetSourcePortForEdgeRouting(this.sourcePort.port.Location)
    } else if (oldNode != null) {
      this.viewer.RemoveSourcePortEdgeRouting()
    }
  }

  MouseMoveWhenInsertingEdgeAndPressingLeftButton(e: MouseEvent) {
    if (this.SourcePort != null) {
      this.SetDraggingFlag(e)
      if (this.dragging) {
        const loosePolylineBox: {loosePolyline: Polyline} = {loosePolyline: null}
        if (this.TrySetNodePort(e, this.targetOfInsertedEdge, this.targetPort, loosePolylineBox)) {
          this.viewer.SetTargetPortForEdgeRouting(this.targetPort.port.Location)
          if (this.DraggingStraightLine()) {
            this.viewer.DrawRubberLine(this.TargetPort.Location)
          } else {
            this.DrawEdgeInteractivelyToPort(this.TargetPort, loosePolylineBox.loosePolyline)
          }
        } else {
          this.viewer.RemoveTargetPortEdgeRouting()
          if (this.DraggingStraightLine()) {
            this.viewer.DrawRubberLine(e)
          } else {
            this.DrawEdgeInteractivelyToLocation(e)
          }
        }
      }

      e.preventDefault()
    }
  }

  MouseMoveLiveSelectObjectsForDragging(e: MouseEvent) {
    this.unselectEverything()
    if (LeftMouseIsPressed(e) && (this.viewer.ModifierKeys & ModifierKeysEnum.Shift) != ModifierKeysEnum.Shift) {
      this.SelectEntitiesForDraggingWithRectangle(e)
    }
  }

  DrawEdgeInteractivelyToLocation(e: MouseEvent) {
    this.DrawEdgeInteractivelyToLocationP(this.viewer.ScreenToSource(e))
  }

  DrawEdgeInteractivelyToLocationP(point: Point) {
    this.viewer.DrawRubberEdge((this.GeomEdge = this.CalculateEdgeInteractivelyToLocation(point)))
  }

  CalculateEdgeInteractivelyToLocation(location: Point): GeomEdge {
    if (this.InteractiveEdgeRouter.SourcePort == null) {
      this.InteractiveEdgeRouter.SetSourcePortAndSourceLoosePolyline(this.SourcePort, this.sourceLoosePolyline.loosePolyline)
    }

    return this.InteractiveEdgeRouter.RouteEdgeToLocation(location)
  }

  DrawEdgeInteractivelyToPort(targetPortParameter: Port, portLoosePolyline: Polyline) {
    this.viewer.DrawRubberEdge((this.GeomEdge = this.CalculateEdgeInteractively(targetPortParameter, portLoosePolyline)))
  }

  DraggingStraightLine(): boolean {
    if (this.viewer.graph == null) {
      return true
    }

    return this.InteractiveEdgeRouter != null && this.InteractiveEdgeRouter.OverlapsDetected
  }

  CalculateEdgeInteractively(targetPortParameter: Port, portLoosePolyline: Polyline): GeomEdge {
    if (this.InteractiveEdgeRouter.SourcePort == null) {
      this.InteractiveEdgeRouter.SetSourcePortAndSourceLoosePolyline(this.SourcePort, this.sourceLoosePolyline.loosePolyline)
    }

    let curve: ICurve
    let smoothedPolyline: SmoothedPolyline = null
    if (this.SourceOfInsertedEdge == this.TargetOfInsertedEdge) {
      curve = LineSegment.mkPP(this.SourcePort.Location, this.TargetPort.Location)
    } else {
      const boxedPolyline: {smoothedPolyline: SmoothedPolyline} = {smoothedPolyline: null}
      curve = this.InteractiveEdgeRouter.RouteEdgeToPort(targetPortParameter, portLoosePolyline, false, boxedPolyline)
      smoothedPolyline = boxedPolyline.smoothedPolyline
    }

    const ret = new GeomEdge(null)
    ret.curve = curve
    ret.smoothedPolyline = smoothedPolyline
    return ret
  }
}

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
function LeftMouseIsPressed(e: MouseEvent): boolean {
  return (e.buttons & 1) == 1
}
