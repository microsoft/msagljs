import {SvgViewerNode} from '../../../renderer/src/svgCreator'
import {DrawingGraph} from '../../src/drawing/drawingGraph'
import {InsertionMode, IViewer} from '../../src/drawing/layoutEditing/iViewer'
import {IViewerEdge} from '../../src/drawing/layoutEditing/iViewerEdge'
import {IViewerGraph} from '../../src/drawing/layoutEditing/iViewerGraph'
import {IViewerNode} from '../../src/drawing/layoutEditing/iViewerNode'
import {IViewerObject} from '../../src/drawing/layoutEditing/iViewerObject'
import {LayoutEditor} from '../../src/drawing/layoutEditing/layoutEditor'
import {ModifierKeysEnum} from '../../src/drawing/layoutEditing/modifierKeys'
import {GeomEdge, GeomGraph, GeomNode} from '../../src/layout/core'
import {EventHandler} from '../../src/layout/core/geomObject'
import {layoutGraphWithSugiayma} from '../../src/layout/layered/layeredLayout'
import {Point, Polyline, Rectangle, Size} from '../../src/math/geometry'
import {PlaneTransformation} from '../../src/math/geometry/planeTransformation'
import {InteractiveTangentVisibilityGraphCalculator} from '../../src/routing/visibility/InteractiveTangentVisibilityGraphCalculator'
import {Polygon} from '../../src/routing/visibility/Polygon'
import {VisibilityGraph} from '../../src/routing/visibility/VisibilityGraph'
import {AttributeRegistry} from '../../src/structs/attributeRegistry'
import {Edge} from '../../src/structs/edge'
import {Graph} from '../../src/structs/graph'
import {Node} from '../../src/structs/node'
import {parseDotGraph} from '../utils/testUtils'

// class ViewerNodeTest extends Attribute implements IViewerNode {
//   rebind(e: Entity): void {
//     throw new Error('Method not implemented.')
//   }
//   clone(): Attribute {
//     throw new Error('Method not implemented.')
//   }
//   constructor(node: Node) {

//   }
//   node: Node
//   IsCollapsedChanged: EventHandler
//   entity: Entity
//   isVisible: boolean
//   markedForDragging: boolean
//   markedForDraggingCallback: (sender: any, eventParameters: any) => void
//   unmarkedForDraggingCallback: (sender: any, eventParameters: any) => void
// }

class FakeMouseEvent implements MouseEvent {
  preventDefault(): any {
    return function () {
      return {}
    }
  }
  stopImmediatePropagation(): any {
    return function () {
      return {}
    }
  }
  stopPropagation(): any {
    return function () {
      return {}
    }
  }

  altKey: boolean
  button: number
  buttons: number
  clientX: number
  clientY: number
  ctrlKey: boolean
  metaKey: boolean
  movementX: number
  movementY: number
  offsetX: number
  offsetY: number
  pageX: number
  pageY: number
  relatedTarget: EventTarget
  screenX: number
  screenY: number
  shiftKey: boolean
  x: number
  y: number
  getModifierState(keyArg: string): boolean {
    throw new Error('Method not implemented.')
  }
  initMouseEvent(
    typeArg: string,
    canBubbleArg: boolean,
    cancelableArg: boolean,
    viewArg: Window,
    detailArg: number,
    screenXArg: number,
    screenYArg: number,
    clientXArg: number,
    clientYArg: number,
    ctrlKeyArg: boolean,
    altKeyArg: boolean,
    shiftKeyArg: boolean,
    metaKeyArg: boolean,
    buttonArg: number,
    relatedTargetArg: EventTarget,
  ): void {
    throw new Error('Method not implemented.')
  }
  detail: number
  view: Window
  which: number
  initUIEvent(typeArg: string, bubblesArg?: boolean, cancelableArg?: boolean, viewArg?: Window, detailArg?: number): void {
    throw new Error('Method not implemented.')
  }
  bubbles: boolean
  cancelBubble: boolean
  cancelable: boolean
  composed: boolean
  currentTarget: EventTarget
  defaultPrevented: boolean
  eventPhase: number
  isTrusted: boolean
  returnValue: boolean
  srcElement: EventTarget
  target: EventTarget
  timeStamp: number
  type: string
  composedPath(): EventTarget[] {
    throw new Error('Method not implemented.')
  }
  initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void {
    throw new Error('Method not implemented.')
  }
  AT_TARGET: number
  BUBBLING_PHASE: number
  CAPTURING_PHASE: number
  NONE: number
}

class FakeViewer implements IViewer {
  constructor(graph: Graph) {
    for (const n of graph.deepNodes) {
      new SvgViewerNode(n, null)
    }
  }
  createUndoPoint(): void {
    throw new Error('Method not implemented.')
  }
  selectedEntities(): IViewerObject[] {
    throw new Error('Method not implemented.')
  }
  screenToSource(e: MouseEvent): Point {
    return new Point(e.clientX, e.clientY)
  }
  IncrementalDraggingModeAlways: boolean
  CurrentScale: number
  createIViewerNodeNPA(drawingNode: Node, center: Point, visualElement: any): IViewerNode {
    throw new Error('Method not implemented.')
  }
  createIViewerNodeN(drawingNode: Node, center: Point): IViewerNode {
    throw new Error('Method not implemented.')
  }
  needToCalculateLayout: boolean
  viewChangeEvent: EventHandler
  objectUnderMouseCursorChanged: EventHandler
  objectUnderMouseCursor: IViewerObject
  invalidate(objectToInvalidate: IViewerObject): void {
    throw new Error('Method not implemented.')
  }
  invalidateAll(): void {
    throw new Error('Method not implemented.')
  }
  bodifierKeys: ModifierKeysEnum
  get entities(): IterableIterator<IViewerObject> {
    return this._ents()
  }
  *_ents(): IterableIterator<IViewerObject> {
    for (const n of this.graph.deepNodes) {
      yield n.getAttr(AttributeRegistry.ViewerIndex)
    }
  }
  DpiX = 100
  DpiY = 100
  LineThicknessForEditing: number
  layoutEditingEnabled = true
  insertionMode: InsertionMode
  PopupMenus(menuItems: [string, () => void][]): void {
    throw new Error('Method not implemented.')
  }
  smoothedPolylineCircleRadius: number
  graph: Graph
  StartDrawingRubberLine(startingPoint: Point): void {
    throw new Error('Method not implemented.')
  }
  DrawRubberLine(args: any): void
  DrawRubberLine(point: Point): void
  DrawRubberLine(point: unknown): void {
    throw new Error('Method not implemented.')
  }
  StopDrawingRubberLine(): void {
    throw new Error('Method not implemented.')
  }
  AddEdge(edge: IViewerEdge, registerForUndo: boolean): void {
    throw new Error('Method not implemented.')
  }
  createEdgeWithGivenGeometry(drawingEdge: Edge): IViewerEdge {
    throw new Error('Method not implemented.')
  }
  addNode(node: IViewerNode, registerForUndo: boolean): void {
    throw new Error('Method not implemented.')
  }
  remove(obj: IViewerObject, registerForUndo: boolean): void {
    throw new Error('Method not implemented.')
  }
  RouteEdge(drawingEdge: Edge): IViewerEdge {
    throw new Error('Method not implemented.')
  }
  ViewerGraph: IViewerGraph
  ArrowheadLength: number
  SetSourcePortForEdgeRouting(portLocation: Point): void {
    // throw new Error('Method not implemented.')
  }
  SetTargetPortForEdgeRouting(portLocation: Point): void {
    // throw new Error('Method not implemented.')
  }
  RemoveSourcePortEdgeRouting(): void {
    throw new Error('Method not implemented.')
  }
  RemoveTargetPortEdgeRouting(): void {
    //throw new Error('Method not implemented.')
  }
  drawRubberEdge(edgeGeometry: GeomEdge): void {
    //throw new Error('Method not implemented.')
  }
  stopDrawingRubberEdge(): void {
    //throw new Error('Method not implemented.')
  }
  Transform: PlaneTransformation
  undo(): void {
    throw new Error('Method not implemented.')
  }
  redo(): void {
    throw new Error('Method not implemented.')
  }
}

function routeEdge(source: Node, target: Node, layoutEditor: LayoutEditor) {
  const sourceGeom = source.getAttr(AttributeRegistry.GeomObjectIndex) as GeomNode
  const mouseEvent = new FakeMouseEvent()
  mouseEvent.clientX = sourceGeom.center.x
  mouseEvent.clientY = sourceGeom.center.y
  mouseEvent.buttons = 0 // the buttons are off
  mouseEvent.buttons = 1 // left button is on
  layoutEditor.HandleMouseMoveWhenInsertingEdgeAndNotPressingLeftButton(mouseEvent)
  mouseEvent.buttons = 1 // left button is on

  layoutEditor.viewerMouseDown(null, mouseEvent)
  const targetGeom = target.getAttr(AttributeRegistry.GeomObjectIndex) as GeomNode
  mouseEvent.buttons = 1 // left button is on
  for (let i = 9; i <= 10; i++) {
    const alpha = i * 0.1
    const p = Point.convSum(alpha, sourceGeom.center, targetGeom.center)
    mouseEvent.clientX = p.x
    mouseEvent.clientY = p.y
    layoutEditor.viewerMouseMove(null, mouseEvent)
  }
}

test('twoRectangles', () => {
  const visibilityGraph = new VisibilityGraph()

  const addedPolygons = [new Polygon(getPoly(new Point(0, 0), 20)), new Polygon(getPoly(new Point(200, 0), 20))]
  for (const p of addedPolygons) {
    visibilityGraph.AddHole(p.Polyline)
  }
  const ir = new InteractiveTangentVisibilityGraphCalculator(null, addedPolygons, visibilityGraph)
  ir.run()
  expect(Array.from(visibilityGraph.Edges).length).toBe(12)
  let tangent = false
  for (const e of visibilityGraph.Edges) {
    if (Math.abs(e.TargetPoint.x - e.SourcePoint.x) > 100) tangent = true
  }
  expect(tangent).toBe(true)
})

test('diagonals', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/fsm.gv'))
  dg.createGeometry()
  layoutGraphWithSugiayma(GeomGraph.getGeom(dg.graph))
  const graph = dg.graph
  const nodes = Array.from(graph.deepNodes)
  const viewer = new FakeViewer(graph)
  viewer.insertionMode = InsertionMode.Edge
  const layoutEditor = new LayoutEditor(viewer)
  layoutEditor.viewer.graph = layoutEditor.graph = dg.entity as Graph

  for (let i = 0; i < nodes.length - 1; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      routeEdge(nodes[i], nodes[j], layoutEditor)
    }
  }
})
function getPoly(center: Point, size: number): Polyline {
  const rect = Rectangle.mkSizeCenter(new Size(size, size), center)
  return rect.perimeter()
}
