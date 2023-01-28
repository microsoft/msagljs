// import {
//   AttributeRegistry,
//   EventHandler,
//   Graph,
//   PlaneTransformation,
//   Point,
//   Node,
//   DrawingGraph,
//   layoutGraphWithSugiayma,
//   GeomGraph,
//   Rectangle,
//   GeomEdge,
//   Edge,
//   GeomNode,
//   Curve,
//   Entity,
// } from 'msagl-js'
// import {
//   InsertionMode,
//   IViewer,
//   IViewerEdge,
//   IViewerGraph,
//   IViewerNode,
//   IViewerObject,
//   LayoutEditor,
//   ModifierKeysEnum,
// } from 'msagl-js/drawing'
// import {edgesAreAttached, parseDotGraph} from '../../utils/testUtils'
// import {SvgDebugWriter} from '../../utils/svgDebugWriter'
// import {PointLocation, Polyline, Size} from '../../../src/math/geometry'
// import {VisibilityGraph} from '../../../src/routing/visibility/VisibilityGraph'

// import {Polygon} from '../../../src/routing/visibility/Polygon'
// import {InteractiveTangentVisibilityGraphCalculator} from '../../../src/routing/visibility/InteractiveTangentVisibilityGraphCalculator'
// import {SvgViewerEdge, SvgViewerNode} from '../../../../svgRenderer/src/svgCreator'
test('blanktest', () => {
  console.log('uncomment the file')
})

// class FakeMouseEvent implements PointerEvent {
//   height: number
//   isPrimary: boolean
//   pointerId: number
//   pointerType: string
//   pressure: number
//   tangentialPressure: number
//   tiltX: number
//   tiltY: number
//   twist: number
//   width: number
//   getCoalescedEvents(): PointerEvent[] {
//     throw new Error('Method not implemented.')
//   }
//   getPredictedEvents(): PointerEvent[] {
//     throw new Error('Method not implemented.')
//   }
//   preventDefault(): any {
//     return function () {
//       return {}
//     }
//   }
//   stopImmediatePropagation(): any {
//     return function () {
//       return {}
//     }
//   }
//   stopPropagation(): any {
//     return function () {
//       return {}
//     }
//   }

//   altKey: boolean
//   button: number
//   buttons: number
//   clientX: number
//   clientY: number
//   ctrlKey: boolean
//   metaKey: boolean
//   movementX: number
//   movementY: number
//   offsetX: number
//   offsetY: number
//   pageX: number
//   pageY: number
//   relatedTarget: EventTarget
//   screenX: number
//   screenY: number
//   shiftKey: boolean
//   x: number
//   y: number
//   getModifierState(keyArg: string): boolean {
//     throw new Error('Method not implemented.')
//   }
//   initMouseEvent(
//     typeArg: string,
//     canBubbleArg: boolean,
//     cancelableArg: boolean,
//     viewArg: Window,
//     detailArg: number,
//     screenXArg: number,
//     screenYArg: number,
//     clientXArg: number,
//     clientYArg: number,
//     ctrlKeyArg: boolean,
//     altKeyArg: boolean,
//     shiftKeyArg: boolean,
//     metaKeyArg: boolean,
//     buttonArg: number,
//     relatedTargetArg: EventTarget,
//   ): void {
//     throw new Error('Method not implemented.')
//   }
//   detail: number
//   view: Window
//   which: number
//   initUIEvent(typeArg: string, bubblesArg?: boolean, cancelableArg?: boolean, viewArg?: Window, detailArg?: number): void {
//     throw new Error('Method not implemented.')
//   }
//   bubbles: boolean
//   cancelBubble: boolean
//   cancelable: boolean
//   composed: boolean
//   currentTarget: EventTarget
//   defaultPrevented: boolean
//   eventPhase: number
//   isTrusted: boolean
//   returnValue: boolean
//   srcElement: EventTarget
//   target: EventTarget
//   timeStamp: number
//   type: string
//   composedPath(): EventTarget[] {
//     throw new Error('Method not implemented.')
//   }
//   initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void {
//     throw new Error('Method not implemented.')
//   }
//   AT_TARGET: number
//   BUBBLING_PHASE: number
//   CAPTURING_PHASE: number
//   NONE: number
// }

// class FakeViewer implements IViewer {
//   constructor(graph: Graph) {
//     for (const n of graph.nodesBreadthFirst) {
//       new SvgViewerNode(n, null)
//     }
//   }
//   setObjectUnderCursorFromEvent(e: PointerEvent): void {
//     // throw new Error('Method not implemented.')
//   }
//   createUndoPoint(): void {
//     throw new Error('Method not implemented.')
//   }
//   selectedEntities(): IViewerObject[] {
//     throw new Error('Method not implemented.')
//   }
//   screenToSource(e: PointerEvent): Point {
//     return new Point(e.clientX, e.clientY)
//   }
//   IncrementalDraggingModeAlways: boolean
//   CurrentScale: number
//   createIViewerNodeNPA(drawingNode: Node, center: Point, visualElement: any): IViewerNode {
//     throw new Error('Method not implemented.')
//   }
//   createIViewerNodeN(drawingNode: Node, center: Point): IViewerNode {
//     throw new Error('Method not implemented.')
//   }
//   needToCalculateLayout: boolean
//   viewChangeEvent: EventHandler
//   objectUnderMouseCursorChanged: EventHandler
//   objectUnderMouseCursor: IViewerObject
//   invalidate(objectToInvalidate: IViewerObject): void {
//     //throw new Error('Method not implemented.')
//   }
//   invalidateAll(): void {
//     throw new Error('Method not implemented.')
//   }
//   modifierKeys = ModifierKeysEnum.None
//   get entities(): IterableIterator<IViewerObject> {
//     return this._ents()
//   }
//   *_ents(): IterableIterator<IViewerObject> {
//     for (const n of this.graph.nodesBreadthFirst) {
//       yield n.getAttr(AttributeRegistry.ViewerIndex)
//     }
//   }
//   DpiX = 100
//   DpiY = 100
//   LineThicknessForEditing: number
//   layoutEditingEnabled = true
//   insertionMode: InsertionMode
//   PopupMenus(menuItems: [string, () => void][]): void {
//     throw new Error('Method not implemented.')
//   }
//   smoothedPolylineCircleRadius = 5
//   graph: Graph
//   startDrawingRubberLine(startingPoint: Point): void {
//     throw new Error('Method not implemented.')
//   }
//   DrawRubberLine(args: any): void
//   DrawRubberLine(point: Point): void
//   DrawRubberLine(point: unknown): void {
//     throw new Error('Method not implemented.')
//   }
//   StopDrawingRubberLine(): void {
//     throw new Error('Method not implemented.')
//   }
//   addEdge(edge: IViewerEdge, registerForUndo: boolean): void {
//     // throw new Error('Method not implemented.')
//   }
//   createEdgeWithGivenGeometry(drawingEdge: Edge): IViewerEdge {
//     return null
//   }
//   addNode(node: IViewerNode, registerForUndo: boolean): void {
//     throw new Error('Method not implemented.')
//   }
//   remove(obj: IViewerObject, registerForUndo: boolean): void {
//     throw new Error('Method not implemented.')
//   }
//   RouteEdge(drawingEdge: Edge): IViewerEdge {
//     throw new Error('Method not implemented.')
//   }
//   ViewerGraph: IViewerGraph
//   ArrowheadLength: number
//   SetSourcePortForEdgeRouting(portLocation: Point): void {
//     // throw new Error('Method not implemented.')
//   }
//   setTargetPortForEdgeRouting(portLocation: Point): void {
//     // throw new Error('Method not implemented.')
//   }
//   RemoveSourcePortEdgeRouting(): void {
//     //throw new Error('Method not implemented.')
//   }
//   RemoveTargetPortEdgeRouting(): void {
//     //throw new Error('Method not implemented.')
//   }
//   drawRubberEdge(edgeGeometry: GeomEdge): void {
//     //throw new Error('Method not implemented.')
//   }
//   stopDrawingRubberEdge(): void {
//     //throw new Error('Method not implemented.')
//   }
//   Transform: PlaneTransformation
//   undo(): void {
//     throw new Error('Method not implemented.')
//   }
//   redo(): void {
//     throw new Error('Method not implemented.')
//   }
// }

// function routeEdge(source: Node, target: Node, layoutEditor: LayoutEditor) {
//   const sourceGeom = source.getAttr(AttributeRegistry.GeomObjectIndex) as GeomNode
//   const mouseEvent = new FakeMouseEvent()
//   mouseEvent.clientX = sourceGeom.center.x
//   mouseEvent.clientY = sourceGeom.center.y
//   mouseEvent.buttons = 0 // the buttons are off
//   mouseEvent.buttons = 1 // left button is on
//   layoutEditor.mouseMoveInsertEdgeNoButtons(mouseEvent)
//   mouseEvent.buttons = 1 // left button is on

//   layoutEditor.viewerMouseDown(null, mouseEvent)
//   const targetGeom = target.getAttr(AttributeRegistry.GeomObjectIndex) as GeomNode
//   mouseEvent.buttons = 1 // left button is on
//   for (let i = 9; i <= 10; i++) {
//     const alpha = i * 0.1
//     const p = Point.convSum(alpha, sourceGeom.center, targetGeom.center)
//     mouseEvent.clientX = p.x
//     mouseEvent.clientY = p.y
//     layoutEditor.viewerMouseMove(null, mouseEvent)
//   }
// }
// test('clusters_1 drag', () => {
//   const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/clust.gv'))
//   dg.createGeometry()
//   layoutGraphWithSugiayma(GeomGraph.getGeom(dg.graph), null, false)
//   const graph = dg.graph
//   const viewer = new FakeViewer(graph)
//   viewer.insertionMode = InsertionMode.Default
//   const layoutEditor = new LayoutEditor(viewer)
//   layoutEditor.viewer.graph = layoutEditor.graph = dg.entity as Graph
//   const x = graph.findNodeRecursive('x')
//   const xg = x.getAttr(AttributeRegistry.GeomObjectIndex)

//   const cluster_1 = graph.findNodeRecursive('cluster_1') as Graph
//   const cluster_1g = GeomGraph.getGeom(cluster_1 as Graph)
//   const cluster_1v = new SvgViewerNode(cluster_1, null)
//   viewer.objectUnderMouseCursor = cluster_1v
//   const xg_center = xg.center.clone() as Point
//   const cluster_0 = graph.findNode('cluster_0')
//   const mouseEvent = new FakeMouseEvent()
//   mouseEvent.clientX = xg.center.x
//   mouseEvent.clientY = xg.center.y
//   mouseEvent.buttons = 1 // left button is on
//   let inters = cluster_1g.boundingBox.intersection_rect(cluster_0.getAttr(AttributeRegistry.GeomObjectIndex).boundingBox) as Rectangle
//   expect(
//     (cluster_1g.boundingBox.intersection_rect(cluster_0.getAttr(AttributeRegistry.GeomObjectIndex).boundingBox) as Rectangle).isEmpty(),
//   ).toBe(true)
//   layoutEditor.viewerMouseDown(null, mouseEvent)
//   const del = 4
//   mouseEvent.clientX += del
//   mouseEvent.clientY += del
//   const positions: Map<Entity, Point> = fillPositions(cluster_1g, cluster_1)

//   layoutEditor.viewerMouseMove(null, mouseEvent)
//   checkThatPositionsAreTranslated(cluster_1g, positions, del)
//   expect(Point.closeDistEps(xg.center, xg_center.add(new Point(del, del)))).toBe(true)
//   inters = cluster_1g.boundingBox.intersection_rect(cluster_0.getAttr(AttributeRegistry.GeomObjectIndex).boundingBox) as Rectangle
//   SvgDebugWriter.writeGeomGraph('./tmp/clust_1drag.svg', GeomGraph.getGeom(graph))
//   expect(inters.isEmpty()).toBe(true)
//   expect(Point.closeDistEps(xg.center, xg_center)).toBe(false)
//   expect(edgesAreAttached(graph)).toBe(true)
// })

// test('clusters insert edge', () => {
//   const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/clust.gv'))
//   dg.createGeometry()
//   layoutGraphWithSugiayma(GeomGraph.getGeom(dg.graph), null, false)
//   const graph = dg.graph
//   const viewer = new FakeViewer(graph)
//   viewer.insertionMode = InsertionMode.Edge
//   const layoutEditor = new LayoutEditor(viewer)
//   layoutEditor.viewer.graph = layoutEditor.graph = dg.entity as Graph
//   const top = graph.findNodeRecursive('top')
//   const vTop = new SvgViewerNode(top, null)
//   viewer.objectUnderMouseCursor = vTop
//   const topGeom = top.getAttr(AttributeRegistry.GeomObjectIndex)
//   const mouseEvent = new FakeMouseEvent()
//   mouseEvent.clientX = topGeom.center.x
//   mouseEvent.clientY = topGeom.center.y
//   mouseEvent.buttons = 0 // left button is off
//   layoutEditor.viewerMouseMove(null, mouseEvent)
//   mouseEvent.buttons = 1 // left button is on
//   layoutEditor.viewerMouseDown(null, mouseEvent)
//   const del = 4
//   mouseEvent.clientX += del
//   mouseEvent.clientY += del
//   layoutEditor.viewerMouseMove(null, mouseEvent)
//   expect(layoutEditor.geomEdge != null).toBe(true)
//   const cluster_0 = graph.findNode('cluster_0')
//   const cluster0_geom = GeomGraph.getGeom(cluster_0 as Graph)
//   mouseEvent.clientX = cluster0_geom.center.x
//   mouseEvent.clientY = cluster0_geom.center.y
//   const clusterO_v = new SvgViewerNode(cluster_0, null)
//   viewer.objectUnderMouseCursor = clusterO_v
//   layoutEditor.viewerMouseMove(null, mouseEvent)
//   layoutEditor.viewerMouseUp(null, mouseEvent)

//   //  SvgDebugWriter.writeGeomGraph('./tmp/clusters_x.svg', GeomGraph.getGeom(graph))
//   expect(top.outEdges.size == 3).toBe(true)
// })

// test('clusters x drag', () => {
//   const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/clust.gv'))
//   dg.createGeometry()
//   layoutGraphWithSugiayma(GeomGraph.getGeom(dg.graph), null, false)
//   const graph = dg.graph
//   const viewer = new FakeViewer(graph)
//   viewer.insertionMode = InsertionMode.Default
//   const layoutEditor = new LayoutEditor(viewer)
//   layoutEditor.viewer.graph = layoutEditor.graph = dg.entity as Graph
//   const x = graph.findNodeRecursive('x')
//   const xv = new SvgViewerNode(x, null)
//   viewer.objectUnderMouseCursor = xv
//   const xg = x.getAttr(AttributeRegistry.GeomObjectIndex)
//   const xg_center = xg.center.clone() as Point
//   const cluster_1 = x.parent
//   const cluster_1G = cluster_1.getAttr(AttributeRegistry.GeomObjectIndex)
//   const cluster_0 = graph.findNode('cluster_0')
//   const mouseEvent = new FakeMouseEvent()
//   mouseEvent.clientX = xg.center.x
//   mouseEvent.clientY = xg.center.y
//   mouseEvent.buttons = 1 // left button is on
//   let inters = cluster_1G.boundingBox.intersection_rect(cluster_0.getAttr(AttributeRegistry.GeomObjectIndex).boundingBox)
//   expect(cluster_1G.boundingBox.intersection_rect(cluster_0.getAttr(AttributeRegistry.GeomObjectIndex).boundingBox).isEmpty()).toBe(true)
//   layoutEditor.viewerMouseDown(null, mouseEvent)
//   const del = 4
//   mouseEvent.clientX += del
//   mouseEvent.clientY += del
//   layoutEditor.viewerMouseMove(null, mouseEvent)
//   inters = cluster_1G.boundingBox.intersection_rect(cluster_0.getAttr(AttributeRegistry.GeomObjectIndex).boundingBox)
//   //SvgDebugWriter.writeGeomGraph('./tmp/clusters_x.svg', GeomGraph.getGeom(graph))
//   expect(inters.isEmpty()).toBe(true)
//   expect(Point.closeDistEps(xg.center, xg_center)).toBe(false)
//   expect(edgesAreAttached(graph)).toBe(true)
// })
// test('cluster0 a->b edit edge', () => {
//   const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/clust.gv'))
//   dg.createGeometry()
//   layoutGraphWithSugiayma(GeomGraph.getGeom(dg.graph), null, false)
//   const graph = dg.graph
//   const viewer = new FakeViewer(graph)
//   viewer.insertionMode = InsertionMode.Default
//   const layoutEditor = new LayoutEditor(viewer)
//   layoutEditor.viewer.graph = layoutEditor.graph = dg.entity as Graph
//   const a = graph.findNodeRecursive('a')
//   let ab: Edge = null
//   for (const e of a.outEdges) {
//     if (e.target.id == 'b') {
//       ab = e
//       break
//     }
//   }
//   const vab = new SvgViewerEdge(ab, null)
//   viewer.objectUnderMouseCursor = vab
//   const geom_ag = GeomEdge.getGeom(ab)
//   const curve = geom_ag.curve
//   const pos = curve.value((curve.parEnd + curve.parStart) / 2)
//   const mouseEvent = new FakeMouseEvent()
//   mouseEvent.clientX = pos.x
//   mouseEvent.clientY = pos.y
//   mouseEvent.buttons = 1 // left button is on
//   layoutEditor.viewerMouseDown(null, mouseEvent) // should create the underlying polyline
//   layoutEditor.viewerMouseUp(null, mouseEvent)
//   layoutEditor.viewerMouseDown(null, mouseEvent) // should create a polyline corner
//   layoutEditor.viewerMouseUp(null, mouseEvent)

//   const del = 4
//   mouseEvent.clientX += del
//   mouseEvent.clientY += del
//   layoutEditor.viewerMouseMove(null, mouseEvent)
//   layoutEditor.undo()
//   layoutEditor.undo()
//   layoutEditor.undo()
//   SvgDebugWriter.writeGeomGraph('./tmp/clusters_x.svg', GeomGraph.getGeom(graph))
// })

// test('twoRectangles', () => {
//   const visibilityGraph = new VisibilityGraph()

//   const addedPolygons = [new Polygon(getPoly(new Point(0, 0), 20)), new Polygon(getPoly(new Point(200, 0), 20))]
//   for (const p of addedPolygons) {
//     visibilityGraph.AddHole(p.Polyline)
//   }
//   const ir = new InteractiveTangentVisibilityGraphCalculator(null, addedPolygons, visibilityGraph)
//   ir.run()
//   expect(Array.from(visibilityGraph.Edges).length).toBe(12)
//   let tangent = false
//   for (const e of visibilityGraph.Edges) {
//     if (Math.abs(e.TargetPoint.x - e.SourcePoint.x) > 100) tangent = true
//   }
//   expect(tangent).toBe(true)
// })

// test('diagonals', () => {
//   const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/fsm.gv'))
//   dg.createGeometry()
//   layoutGraphWithSugiayma(GeomGraph.getGeom(dg.graph), null, false)
//   const graph = dg.graph
//   const nodes = Array.from(graph.nodesBreadthFirst)
//   const viewer = new FakeViewer(graph)
//   viewer.insertionMode = InsertionMode.Edge
//   const layoutEditor = new LayoutEditor(viewer)
//   layoutEditor.viewer.graph = layoutEditor.graph = dg.entity as Graph

//   for (let i = 0; i < nodes.length - 1; i++) {
//     for (let j = i + 1; j < nodes.length; j++) {
//       routeEdge(nodes[i], nodes[j], layoutEditor)
//     }
//   }
// })
// function fillPositions(cluster_1g: GeomGraph, cluster_1: Graph) {
//   const positions = new Map<Entity, Point>()
//   for (const n of cluster_1g.nodesBreadthFirst) {
//     positions.set(n.node, n.center)
//   }
//   positions.set(cluster_1, cluster_1g.center)
//   return positions
// }

// function getPoly(center: Point, size: number): Polyline {
//   const rect = Rectangle.mkSizeCenter(new Size(size, size), center)
//   return rect.perimeter()
// }

// function checkThatPositionsAreTranslated(cluster_1g: GeomGraph, positions: Map<Entity, Point>, del: number) {
//   const dp = new Point(del, del)
//   for (const n of cluster_1g.nodesBreadthFirst) {
//     const pos = positions.get(n.node)
//     const npos = n.center
//     expect(Point.closeDistEps(npos, pos.add(dp))).toBe(true)
//   }
//   const clust_pos = positions.get(cluster_1g.entity)
//   expect(Point.closeDistEps(cluster_1g.center, clust_pos.add(dp))).toBe(true)
// }
