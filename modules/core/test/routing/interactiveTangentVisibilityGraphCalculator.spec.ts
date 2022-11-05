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
import {Port} from '../../src/layout/core/port'
import {layoutGraphWithSugiayma} from '../../src/layout/layered/layeredLayout'
import {Point, Polyline} from '../../src/math/geometry'
import {PlaneTransformation} from '../../src/math/geometry/planeTransformation'
import {MetroGraphData} from '../../src/routing/spline/bundling/MetroGraphData'
import {Attribute} from '../../src/structs/attribute'
import {AttributeRegistry} from '../../src/structs/attributeRegistry'
import {Edge} from '../../src/structs/edge'
import {Entity} from '../../src/structs/entity'
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
  preventDefault(): void {
    throw new Error('Method not implemented.')
  }
  stopImmediatePropagation(): void {
    throw new Error('Method not implemented.')
  }
  stopPropagation(): void {
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
  DpiX: number
  DpiY: number
  LineThicknessForEditing: number
  layoutEditingEnabled: boolean
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
    throw new Error('Method not implemented.')
  }
  SetTargetPortForEdgeRouting(portLocation: Point): void {
    throw new Error('Method not implemented.')
  }
  RemoveSourcePortEdgeRouting(): void {
    throw new Error('Method not implemented.')
  }
  RemoveTargetPortEdgeRouting(): void {
    throw new Error('Method not implemented.')
  }
  drawRubberEdge(edgeGeometry: GeomEdge): void {
    throw new Error('Method not implemented.')
  }
  stopDrawingRubberEdge(): void {
    throw new Error('Method not implemented.')
  }
  Transform: PlaneTransformation
  undo(): void {
    throw new Error('Method not implemented.')
  }
  redo(): void {
    throw new Error('Method not implemented.')
  }
}

test('diagonals', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/fsm.gv'))
  dg.createGeometry()
  layoutGraphWithSugiayma(GeomGraph.getGeom(dg.graph))
  const graph = dg.graph
  const lr_2 = graph.findNode('LR_2')
  const lr_2_g = lr_2.getAttr(AttributeRegistry.GeomObjectIndex) as GeomNode
  const viewer = new FakeViewer(graph)
  viewer.insertionMode = InsertionMode.Edge
  const layoutEditor = new LayoutEditor(viewer)
  viewer.graph = layoutEditor.graph = dg.entity as Graph
  const mouseEvent = new FakeMouseEvent()
  mouseEvent.clientX = lr_2_g.center.x
  mouseEvent.clientY = lr_2_g.center.y
  const vnWrap: {node: IViewerNode} = {node: null}
  const portWrap: {port: Port} = {port: null}
  const loosePolyline: {loosePolyline: Polyline} = {loosePolyline: null}
  expect(layoutEditor.TrySetNodePort(mouseEvent, vnWrap, portWrap, loosePolyline)).toBe(true)
})
