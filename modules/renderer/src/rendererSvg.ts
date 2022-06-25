import {DrawingGraph, DrawingNode} from 'msagl-js/drawing'

import {layoutDrawingGraph} from './layout'
import {Graph} from 'msagl-js'

import {deepEqual} from './utils'

import {LayoutOptions} from './renderer'
import {SvgCreator} from './svgCreator'
import TextMeasurer from './text-measurer'
import {graphToJSON} from '@msagl/parser'

/**
 * Renders an MSAGL graph with SVG
 */
export class RendererSvg {
  /** The default is true and the value is reset to true after each call to setGraph */
  needCreateGeometry = true
  /** The default is true and the value is reset to true after each call to setGraph */
  needCalculateLayout = true
  getSvgString(): string {
    return this._svgCreator.getSvgString()
  }

  getJSONString(): string {
    if (this.graph == null) return 'no graph'
    return JSON.stringify(graphToJSON(this.graph))
  }
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
        layoutDrawingGraph(drawingGraph, this._layoutOptions, true)
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
    layoutDrawingGraph(drawingGraph, this._layoutOptions, relayout)
    this._update()
  }

  private _update() {
    if (!this._graph) return
    return this._svgCreator.setGraph(this._graph)
  }
  getSvg(): SVGAElement {
    return this._svgCreator ? this._svgCreator.svg : null
  }
}
