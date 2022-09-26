import {DrawingGraph, IMsaglMouseEventArgs, IViewerEdge, IViewerGraph, IViewerNode, IViewerObject, ModifierKeys} from 'msagl-js/drawing'
import {layoutGraph} from './layout'
import {Edge, EventHandler, GeomEdge, Graph, PlaneTransformation, Point} from 'msagl-js'
import {deepEqual} from './utils'
import {LayoutOptions} from './renderer'
import {SvgCreator} from './svgCreator'
import TextMeasurer from './text-measurer'
import {graphToJSON} from '@msagl/parser'
import {IViewer, LayoutEditor} from 'msagl-js/drawing'
/** convert MouseEvent to the msagl internal representation */
class MSAGLEventArgs implements IMsaglMouseEventArgs {
  LeftButtonIsPressed = false
  MiddleButtonIsPressed = false
  RightButtonIsPressed = false
  Handled = false
  X: number
  Y: number
  Clicks = 0
}

/**
 * Renders an MSAGL graph with SVG
 */
export class RendererSvg implements IViewer {
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

  constructor(container: HTMLElement = document.body) {
    this._textMeasurer = new TextMeasurer()
    this._svgCreator = new SvgCreator(container)
    container.addEventListener('mousedown', (a) => this.MouseDown.raise(this, this.toMsaglEvent(a)))
    container.addEventListener('mouseup', (a) => this.MouseUp.raise(this, a))
    container.addEventListener('mousemove', (a) => this.MouseMove.raise(this, a))
    this.MouseMove.subscribe(() => {
      if (this == null || this._svgCreator == null) {
        return null
      }
      //  console.log(this.Transform)
    })

    this.layoutEditor = new LayoutEditor(this)
    this.LayoutEditingEnabled = true
  }
  toMsaglEvent(a: MouseEvent): IMsaglMouseEventArgs {
    const ret = new MSAGLEventArgs()
    switch (a.button) {
      case 0:
        ret.LeftButtonIsPressed = true
        break
      case 4:
        ret.MiddleButtonIsPressed = true
        break
      case 2:
        ret.RightButtonIsPressed = true
        break
    }
    ret.X = a.clientX
    ret.Y = a.clientY
    return ret
  }

  get graph(): Graph {
    return this._graph
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
  // implementation of IViewer
  ScreenToSource(e: IMsaglMouseEventArgs): Point {
    throw new Error('Method not implemented.')
  }
  IncrementalDraggingModeAlways: boolean
  CurrentScale: number
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

  ObjectUnderMouseCursorChanged: EventHandler = new EventHandler()
  ObjectUnderMouseCursor: IViewerObject
  Invalidate(objectToInvalidate: IViewerObject): void {
    throw new Error('Method not implemented.')
  }
  InvalidateAll(): void {
    throw new Error('Method not implemented.')
  }
  ModifierKeys: ModifierKeys
  Entities: Iterable<IViewerObject>
  DpiX: number
  DpiY: number
  OnDragEnd(changedObjects: Iterable<IViewerObject>): void {
    throw new Error('Method not implemented.')
  }
  LineThicknessForEditing: number
  LayoutEditingEnabled: boolean
  InsertingEdge: boolean
  PopupMenus(menuItems: [string, () => void][]): void {
    throw new Error('Method not implemented.')
  }
  UnderlyingPolylineCircleRadius: number
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
  get Transform(): PlaneTransformation {
    const tr = this._svgCreator.getTransform()
    return new PlaneTransformation(tr.scale, 0, tr.x, 0, tr.scale, tr.y)
  }
}
