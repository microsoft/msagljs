import {Deck, OrthographicView, LinearInterpolator} from '@deck.gl/core'

import {DrawingGraph} from 'msagl-js/drawing'

import NodeLayer from './layers/node-layer'
import EdgeLayer from './layers/edge-layer'

import {layoutDrawingGraph} from './layout'
import {Graph, GeomGraph, Rectangle, LayoutSettings, LayerDirectionEnum, EdgeRoutingMode} from 'msagl-js'

import EventSource, {Event} from './event-source'
import TextMeasurer, {TextMeasurerOptions} from './text-measurer'
import {deepEqual} from './utils'

export interface IRendererControl {
  onAdd(renderer: Renderer): void
  onRemove(renderer: Renderer): void
  getElement(): HTMLElement | null
}

export type RenderOptions = {
  type?: 'Sugiyama' | 'MDS'
  label?: Partial<TextMeasurerOptions>
  layerDirection?: LayerDirectionEnum
  edgeRoutingMode?: EdgeRoutingMode
}

const MaxZoom = 4

/**
 * Renders a MSAGL graph with WebGL
 * @event load - fired once when the renderer is initialized
 * @event graphload - fired when a graph is rendered for the first time
 */
export default class Renderer extends EventSource {
  private _deck: any
  private _drawingGraph?: DrawingGraph
  private _geomGraph?: GeomGraph
  private _renderOptions: RenderOptions = {}
  private _controls: IRendererControl[] = []
  private _controlsContainer: HTMLDivElement
  private _textMeasurer: TextMeasurer

  constructor(container: HTMLElement = document.body) {
    super()

    this._textMeasurer = new TextMeasurer()

    if (window.getComputedStyle(container).position === 'static') {
      container.style.position = 'relative'
    }

    const divs = Array.from({length: 2}, () => {
      const c = document.createElement('div')
      Object.assign(c.style, {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      })
      return container.appendChild(c)
    })

    this._deck = new Deck({
      parent: divs[0],
      views: [new OrthographicView({maxZoom: MaxZoom})],
      initialViewState: {
        // @ts-ignore
        target: [0, 0, 0],
        zoom: 0,
      },
      controller: true,
      onLoad: () => {
        this.emit('load')
        this._update()
      },
    })

    divs[1].style.pointerEvents = 'none'
    this._controlsContainer = divs[1]
  }

  addControl(control: IRendererControl) {
    if (this._controls.indexOf(control) < 0) {
      this._controls.push(control)
      control.onAdd(this)
      const el = control.getElement()
      if (el) {
        this._controlsContainer.appendChild(el)
      }
    }
  }

  removeControl(control: IRendererControl) {
    const index = this._controls.indexOf(control)
    if (index >= 0) {
      const el = control.getElement()
      if (el) {
        el.remove()
      }
      control.onRemove(this)
      this._controls.splice(index, 1)
    }
  }

  get graph(): GeomGraph {
    return this._geomGraph
  }

  get layoutSettings(): LayoutSettings {
    const geomGraph = <GeomGraph>GeomGraph.getGeom(this._drawingGraph.graph)
    return geomGraph == null ? null : geomGraph.layoutSettings
  }

  /** when the graph is set : the geometry for it is created and the layout is done */
  setGraph(drawingGraph: DrawingGraph, options: RenderOptions = this._renderOptions) {
    if (this._drawingGraph === drawingGraph) {
      this.setRenderOptions(options)
    } else {
      this._drawingGraph = drawingGraph
      this._renderOptions = options
      this._textMeasurer.setOptions(options.label || {})

      drawingGraph.createGeometry(this._textMeasurer.measure)
      this._geomGraph = layoutDrawingGraph(this._drawingGraph, this._renderOptions, true)

      if (this._deck.layerManager) {
        // deck is ready
        this._update()
      }
    }
  }

  setRenderOptions(options: RenderOptions) {
    const oldLabelSettings = this._renderOptions.label
    const newLabelSettings = options.label
    const fontChanged = !deepEqual(oldLabelSettings, newLabelSettings)

    this._renderOptions = options

    if (!this._drawingGraph) {
      return
    }

    if (fontChanged) {
      this._textMeasurer.setOptions(options.label || {})
      this._drawingGraph.createGeometry(this._textMeasurer.measure)
    }
    this._geomGraph = layoutDrawingGraph(this._drawingGraph, this._renderOptions, fontChanged)

    if (this._deck.layerManager) {
      // deck is ready
      this._update()
    }
  }

  zoomTo(rectangle: Rectangle) {
    const scale = Math.min(this._deck.width / rectangle.width, this._deck.height / rectangle.height)
    const zoom = Math.min(Math.log2(scale) - 1, MaxZoom)

    this._deck.setProps({
      initialViewState: {
        target: [rectangle.center.x, rectangle.center.y, 0],
        zoom: zoom,
        transitionInterpolator: new LinearInterpolator(['target', 'zoom']),
        transitionDuration: 1000,
      },
    })
  }

  private _update() {
    if (!this._drawingGraph) return

    const fontSettings = this._textMeasurer.opts

    const center = this._geomGraph.boundingBox.center
    const edgeLayer = new EdgeLayer({
      id: 'edges',
      data: Array.from(this._geomGraph.deepEdges()),
      getWidth: 1,
    })

    const nodeLayer = new NodeLayer({
      id: 'nodeBoundaries',
      data: Array.from(this._geomGraph.deepNodes()),
      fontFamily: fontSettings.fontFamily,
      fontWeight: fontSettings.fontWeight,
      lineHeight: fontSettings.lineHeight,
      getWidth: 1,
      getSize: fontSettings.fontSize,
      sizeMaxPixels: 24,
      pickable: true,
    })

    this._deck.setProps({
      initialViewState: {
        target: [center.x, center.y, 0],
        zoom: 0,
      },
      layers: [nodeLayer, edgeLayer],
    })

    this.emit({
      type: 'graphload',
      data: this._geomGraph,
    } as Event)
  }
}
