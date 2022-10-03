import {DrawingGraph, IViewerEdge, IViewerGraph, IViewerNode, IViewerObject, ModifierKeysEnum} from 'msagl-js/drawing'
import {layoutGraph} from './layout'
import {
  AttributeRegistry,
  buildRTreeWithInterpolatedEdges,
  Edge,
  EventHandler,
  GeomEdge,
  GeomGraph,
  GeomHitTreeNodeType,
  GeomLabel,
  GeomNode,
  GeomObject,
  getGeomIntersectedObjects,
  Graph,
  PlaneTransformation,
  Point,
  Rectangle,
  Size,
} from 'msagl-js'
import {deepEqual} from './utils'
import {LayoutOptions} from './renderer'
import {SvgCreator} from './svgCreator'
import TextMeasurer from './text-measurer'
import {graphToJSON} from '@msagl/parser'
import {IViewer, LayoutEditor} from 'msagl-js/drawing'
import {RTree} from 'msagl-js/src/math/geometry/RTree/rTree'

/**
 * Renders an MSAGL graph with SVG
 */
export class RendererSvg implements IViewer {
  get UnderlyingPolylineRadiusWithNoScale(): number {
    return this.Dpi * 0.05
  }
  getInterpolationSlack(): number {
    return this.mouseHitDistance
  }
  /** the distance in inches */
  private mouseHitDistance = 0.05
  get Dpi(): number {
    return 96 * window.devicePixelRatio
  }

  getHitSlack(): number {
    const dpi = this.Dpi
    const slackInPoints = dpi * this.mouseHitDistance
    return slackInPoints / this.CurrentScale
    throw new Error('Method not implemented.')
  }

  layoutEditor: LayoutEditor
  /** The default is true and the value is reset to true after each call to setGraph */
  needCreateGeometry = true
  /** The default is true and the value is reset to true after each call to setGraph */
  needCalculateLayout = true
  getSvgString(): string {
    return this._svgCreator.getSvgString()
  }

  getJSONString(): string {
    if (this.graph == null) return 'no graph'
    return JSON.stringify(graphToJSON(this.graph), null, 2)
  }
  private _graph?: Graph
  private _layoutOptions: LayoutOptions = {}
  private _textMeasurer: TextMeasurer
  private _svgCreator: SvgCreator

  private objectTree: RTree<GeomHitTreeNodeType, Point>

  private processMouseMove(sender: any, e: MouseEvent): void {
    if (this == null || this._svgCreator == null) {
      return null
    }
    if (this.objectTree == null) {
      this.objectTree = buildRTreeWithInterpolatedEdges(this.graph, this.getHitSlack())
    }
    let elems = Array.from(getGeomIntersectedObjects(this.objectTree, this.getHitSlack(), this.ScreenToSource(e)))
    if (elems.length == 0) return
    elems = elems.filter((e) => filterEdgesCloseBy(e))
    elems.sort((a, b) => {
      const atype = a instanceof GeomGraph ? 3 : a instanceof GeomLabel ? 2 : a instanceof GeomNode ? 1 : 0 // 0 for GeomEdge
      const btype = b instanceof GeomGraph ? 3 : b instanceof GeomLabel ? 2 : b instanceof GeomNode ? 1 : 0 // 0 for GeomEdge
      if (atype != btype) return atype - btype

      if (atype == 2) return 0 // both are GeomLabels

      return depth(a as GeomObject) - depth(b as GeomObject)
      function depth(a: GeomObject) {
        let d = 0
        let p = a.entity.parent
        while (p) {
          d++
          p = p.parent
        }
        return d
      }
    })
    const favorite = elems[0]

    this.ObjectUnderMouseCursor = favorite.entity.getAttr(AttributeRegistry.ViewerIndex)
  }

  constructor(container: HTMLElement = document.body) {
    this._textMeasurer = new TextMeasurer()
    this._svgCreator = new SvgCreator(container)

    container.addEventListener('mousedown', (a) => this.MouseDown.raise(this, a))
    container.addEventListener('mouseup', (a) => this.MouseUp.raise(this, a))
    container.addEventListener('mousemove', (a) => this.MouseMove.raise(this, a))

    this.MouseMove.subscribe(this.processMouseMove.bind(this))

    this.layoutEditor = new LayoutEditor(this)
    this.LayoutEditingEnabled = true
  }
  /** when the graph is set : the geometry for it is created and the layout is done */
  setGraph(graph: Graph, options: LayoutOptions = this._layoutOptions) {
    if (this._graph === graph) {
      this.setOptions(options)
    } else {
      this._graph = graph
      this._layoutOptions = options
      this._textMeasurer.setOptions(options.label || {})

      const drawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(graph) || new DrawingGraph(graph)

      if (this.needCreateGeometry) {
        drawingGraph.createGeometry(this._textMeasurer.measure)
      } else {
        // still need to measure the text sizes
        drawingGraph.measureLabelSizes(this._textMeasurer.measure)
      }

      if (this.needCalculateLayout) {
        layoutGraph(graph, this._layoutOptions, true)
      }

      this._update()
    }
    this.needCalculateLayout = this.needCreateGeometry = true
  }

  setOptions(options: LayoutOptions) {
    const oldLabelSettings = this._layoutOptions.label
    const newLabelSettings = options.label
    const fontChanged = !deepEqual(oldLabelSettings, newLabelSettings)

    this._layoutOptions = options

    if (!this._graph) {
      return
    }

    const drawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(this._graph)
    if (fontChanged) {
      this._textMeasurer.setOptions(options.label || {})
      drawingGraph.createGeometry(this._textMeasurer.measure)
    }
    const relayout = fontChanged
    layoutGraph(this._graph, this._layoutOptions, relayout)
    this._update()
  }

  private _update() {
    if (!this._graph) return
    return this._svgCreator.setGraph(this._graph)
  }
  getSvg(): SVGElement {
    return this._svgCreator ? this._svgCreator.svg : null
  }
  /** maps the screen coordinates to the graph coordinates */
  ScreenToSource(e: MouseEvent): Point {
    return this.ScreenToSourceP(e.clientX, e.clientY)
  }

  /** maps the screen coordinates to the graph coordinates */
  ScreenToSourceP(x: number, y: number): Point {
    // m is the reverse mapping : that is the mapping from the graph coords to the client's
    const m = this._svgCreator.getTransform()
    return m.inverse().multiplyPoint(new Point(x, y))
  }
  IncrementalDraggingModeAlways: boolean
  get CurrentScale(): number {
    return this._svgCreator.getScale()
  }
  CreateIViewerNode(drawingNode: Node, center: Point, visualElement: any): IViewerNode
  CreateIViewerNode(drawingNode: Node): IViewerNode
  CreateIViewerNode(drawingNode: unknown, center?: unknown, visualElement?: unknown): IViewerNode {
    throw new Error('Method not implemented.')
  }
  NeedToCalculateLayout: boolean
  ViewChangeEvent: EventHandler = new EventHandler()
  MouseDown: EventHandler = new EventHandler()
  MouseMove: EventHandler = new EventHandler()
  MouseUp: EventHandler = new EventHandler()
  GraphChanged: EventHandler = new EventHandler()

  _objectUnderMouse: IViewerObject

  ObjectUnderMouseCursorChanged: EventHandler = new EventHandler()
  get ObjectUnderMouseCursor(): IViewerObject {
    return this._objectUnderMouse
  }
  set ObjectUnderMouseCursor(value) {
    this._objectUnderMouse = value
  }
  Invalidate(objectToInvalidate: IViewerObject): void {
    this._svgCreator.Invalidate(objectToInvalidate)
  }
  InvalidateAll(): void {
    throw new Error('Method not implemented.')
  }
  ModifierKeys = ModifierKeysEnum.None
  Entities: Iterable<IViewerObject>
  get DpiX() {
    return this.Dpi
  }
  get DpiY() {
    return this.Dpi
  }
  OnDragEnd(changedObjects: Iterable<IViewerObject>): void {
    throw new Error('Method not implemented.')
  }
  LineThicknessForEditing = 2
  LayoutEditingEnabled = true
  InsertingEdge = false
  PopupMenus(menuItems: [string, () => void][]): void {
    throw new Error('Method not implemented.')
  }
  get UnderlyingPolylineCircleRadius(): number {
    return this.UnderlyingPolylineRadiusWithNoScale / this.CurrentScale
  }

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
  CreateEdgeWithGivenGeometry(drawingEdge: Edge): IViewerEdge {
    throw new Error('Method not implemented.')
  }
  AddNode(node: IViewerNode, registerForUndo: boolean): void {
    throw new Error('Method not implemented.')
  }
  RemoveEdge(edge: IViewerEdge, registerForUndo: boolean): void {
    throw new Error('Method not implemented.')
  }
  RemoveNode(node: IViewerNode, registerForUndo: boolean): void {
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
  DrawRubberEdge(edgeGeometry: GeomEdge): void {
    throw new Error('Method not implemented.')
  }
  StopDrawingRubberEdge(): void {
    throw new Error('Method not implemented.')
  }
  get graph(): Graph {
    return this._graph
  }

  get Transform(): PlaneTransformation {
    return this._svgCreator.getTransform()
  }
}
function filterEdgesCloseBy(e: GeomObject | GeomLabel): boolean {
  if (!(e instanceof GeomEdge)) return true
}
