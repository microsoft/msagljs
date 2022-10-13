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
  RTree,
} from 'msagl-js'
import {deepEqual} from './utils'
import {LayoutOptions} from './renderer'
import {SvgCreator} from './svgCreator'
import TextMeasurer from './text-measurer'
import {graphToJSON} from '@msagl/parser'
import {IViewer, LayoutEditor} from 'msagl-js/drawing'
import {default as svgPanZoom, PanZoom} from 'panzoom'

/**
 * This class renders an MSAGL graph with SVG and enables the graph editing.
 */
export class RendererSvg implements IViewer {
  *entitiesIter(): Iterable<IViewerObject> {
    for (const n of this.graph.deepNodes) yield n.getAttr(AttributeRegistry.ViewerIndex)
    for (const e of this.graph.deepEdges) {
      yield e.getAttr(AttributeRegistry.ViewerIndex)
      if (e.label) {
        yield e.label.getAttr(AttributeRegistry.ViewerIndex)
      }
    }
  }
  panZoom: PanZoom

  get UnderlyingPolylineRadiusWithNoScale(): number {
    return this.Dpi * 0.05
  }
  getInterpolationSlack(): number {
    return this.mouseHitDistance
  }
  /** the distance in inches */
  private mouseHitDistance = 0.05 / 2
  get Dpi(): number {
    return 96 * window.devicePixelRatio
  }

  getHitSlack(): number {
    const dpi = this.Dpi
    const slackInPoints = dpi * this.mouseHitDistance
    return slackInPoints / this.CurrentScale
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

  private _objectTree: RTree<GeomHitTreeNodeType, Point>

  // public get objectTree(): RTree<GeomHitTreeNodeType, Point> {
  //   if (this._objectTree == null || this._objectTree.RootNode == null) {
  //     this._objectTree = buildRTreeWithInterpolatedEdges(this.graph, this.getHitSlack())
  //   }
  //   return this._objectTree
  // }
  // public set objectTree(value: RTree<GeomHitTreeNodeType, Point>) {
  //   this._objectTree = value
  // }

  private processMouseMove(e: MouseEvent): void {
    if (this == null || this._svgCreator == null) {
      return
    }
    if (!this.LayoutEditingEnabled) {
      return
    }

    if (this.layoutEditor.Dragging) {
      return
    }

    if (this._objectTree == null) {
      this._objectTree = buildRTreeWithInterpolatedEdges(this.graph, this.getHitSlack())
    }
    const elems = Array.from(getGeomIntersectedObjects(this._objectTree, this.getHitSlack(), this.ScreenToSource(e)))
    if (elems.length == 0) {
      this.objectUnderMouseCursor = null
      return
    }
    sortElems()
    const favorite = elems[0]

    this.objectUnderMouseCursor = favorite.entity.getAttr(AttributeRegistry.ViewerIndex)
    // end of the main function processMouseMove
    function sortElems() {
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
    }
  }

  constructor(container: HTMLElement = document.body) {
    this._textMeasurer = new TextMeasurer()
    this._svgCreator = new SvgCreator(container)

    container.addEventListener('mousedown', (e) => {
      if (!this.LayoutEditingEnabled) return

      if (this.objectUnderMouseCursor != null && e.buttons == 1) {
        this.panZoom.pause()
      }
      this.layoutEditor.ViewerMouseDown(this, e)
    })

    container.addEventListener('mousemove', (e) => {
      this.processMouseMove(e)
      if (this.LayoutEditingEnabled) this.layoutEditor.viewerMouseMove(this, e)
    })

    container.addEventListener('mouseup', (e) => {
      if (!this.LayoutEditingEnabled) return
      this.layoutEditor.ViewerMouseUp(this, e)
      this.panZoom.resume()
    })

    this.layoutEditor = new LayoutEditor(this)
  }

  undo(): void {
    this.layoutEditor.undo()
  }

  redo(): void {
    this.layoutEditor.redo()
  }

  ViewChangeEvent: EventHandler

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
    this._objectTree = null
    this._svgCreator.setGraph(this._graph)
    this.panZoom = svgPanZoom(this._svgCreator.svg) // it seems enough for these operations this._svgCreator.svg
    this.layoutEditor.ViewerGraphChanged()
  }
  getSvg(): SVGElement {
    return this._svgCreator ? this._svgCreator.svg : null
  }
  /** maps the screen coordinates to the graph coordinates */
  ScreenToSource(e: MouseEvent): Point {
    return this.ScreenToSourceP(e.clientX, e.clientY)
  }

  /** maps the screen coordinates to the graph coordinates */
  private ScreenToSourceP(x: number, y: number): Point {
    // m is the reverse mapping : that is the mapping from the graph coords to the client's
    const m = this._svgCreator.getTransform()
    return m.inverse().multiplyPoint(new Point(x, y))
  }
  IncrementalDraggingModeAlways = false
  get CurrentScale(): number {
    return this._svgCreator.getScale()
  }
  CreateIViewerNode(drawingNode: Node, center: Point, visualElement: any): IViewerNode
  CreateIViewerNode(drawingNode: Node): IViewerNode
  CreateIViewerNode(drawingNode: unknown, center?: unknown, visualElement?: unknown): IViewerNode {
    throw new Error('Method not implemented.')
  }
  NeedToCalculateLayout: boolean
  GraphChanged: EventHandler = new EventHandler()

  _objectUnderMouse: IViewerObject

  ObjectUnderMouseCursorChanged: EventHandler = new EventHandler()
  get objectUnderMouseCursor(): IViewerObject {
    return this._objectUnderMouse
  }
  set objectUnderMouseCursor(value) {
    if (this._objectUnderMouse !== value) {
      this._objectUnderMouse = value
      if (value) {
        console.log(this._objectUnderMouse.entity)
      } else {
        console.log('no selection')
      }
    }
  }
  invalidate(objectToInvalidate: IViewerObject): void {
    //  console.log('invalidate', objectToInvalidate.entity)
    this._svgCreator.invalidate(objectToInvalidate)
    this._objectTree = null
  }
  invalidateAll(): void {
    //TODO : implement
  }
  ModifierKeys = ModifierKeysEnum.None
  get entities(): Iterable<IViewerObject> {
    return this.entitiesIter()
  }

  get DpiX() {
    return this.Dpi
  }
  get DpiY() {
    return this.Dpi
  }
  LineThicknessForEditing = 2
  LayoutEditingEnabled = true // set to true by default: TODO
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
    //throw new Error('Method not implemented.')
  }
  RemoveTargetPortEdgeRouting(): void {
    // throw new Error('Method not implemented.')
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
