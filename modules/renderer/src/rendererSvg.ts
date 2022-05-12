import {DrawingGraph} from 'msagl-js/drawing'

import {layoutDrawingGraph} from './layout'
import {Graph} from 'msagl-js'

import TextMeasurer from './text-measurer'
import {deepEqual} from './utils'

import {LayoutOptions} from './renderer'
import {SvgCreator} from './svgCreator'

/**
 * Renders an MSAGL graph with SVG
 */
export class RendererSvg {
  private _graph?: Graph
  private _layoutOptions: LayoutOptions = {}
  private _textMeasurer: TextMeasurer
  private _svgCreator: SvgCreator

  constructor(container: HTMLElement = document.body) {
    this._textMeasurer = new TextMeasurer()
    this._svgCreator = new SvgCreator(container)
  }

  get graph(): Graph {
    return this._graph
  }

  /** when the graph is set : the geometry for it is created and the layout is done */
  setGraph(graph: Graph, options: LayoutOptions = this._layoutOptions) {
    if (this._graph === graph) {
      this.setLayoutOptions(options)
    } else {
      this._graph = graph
      this._layoutOptions = options
      this._textMeasurer.setOptions(options.label || {})

      const drawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(graph) || new DrawingGraph(graph)
      drawingGraph.createGeometry(this._textMeasurer.measure)
      layoutDrawingGraph(drawingGraph, this._layoutOptions, true)

      this._update()
    }
  }

  setLayoutOptions(options: LayoutOptions) {
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
    layoutDrawingGraph(drawingGraph, this._layoutOptions, relayout)
    this._update()
  }

  private _update() {
    if (!this._graph) return
    return this._svgCreator.setGraph(this._graph)
  }
}
