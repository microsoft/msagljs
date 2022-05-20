import {Deck, OrthographicView, LinearInterpolator} from '@deck.gl/core'

import {DrawingGraph, TextMeasurerOptions} from 'msagl-js/drawing'

import NodeLayer from './layers/node-layer'
import EdgeLayer from './layers/edge-layer'

import {layoutDrawingGraph} from './layout'
import {Graph, GeomGraph, Rectangle, EdgeRoutingMode} from 'msagl-js'

import EventSource, {Event} from './event-source'
import TextMeasurer from './text-measurer'
import {deepEqual} from './utils'

import GraphHighlighter from './layers/graph-highlighter'

export interface IRendererControl {
  onAdd(renderer: Renderer): void
  onRemove(renderer: Renderer): void
  getElement(): HTMLElement | null
}

export type LayoutOptions = {
  layoutType?: 'Sugiyama LR' | 'Sugiyama TB' | 'Sugiyama BT' | 'Sugiyama RL' | 'MDS'
  label?: Partial<TextMeasurerOptions>
  edgeRoutingMode?: EdgeRoutingMode
}

const MaxZoom = 2

/**
 * Renders an MSAGL graph with WebGL
 * @event load - fired once when the renderer is initialized
 * @event graphload - fired when a graph is rendered for the first time
 */
export default class Renderer extends EventSource {
  private _deck: any
  private _graph?: Graph
  private _layoutOptions: LayoutOptions = {}
  private _controls: IRendererControl[] = []
  private _controlsContainer: HTMLDivElement
  private _textMeasurer: TextMeasurer
  private _graphHighlighter: GraphHighlighter
  private _highlightedNodeId: string | null

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
      onClick: ({object}) => {
        if (!object && this._highlightedNodeId) {
          // deseclect
          this.highlight(null)
        }
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
      this._highlightedNodeId = null

      const drawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(graph) || new DrawingGraph(graph)
      drawingGraph.createGeometry(this._textMeasurer.measure)
      layoutDrawingGraph(drawingGraph, this._layoutOptions, true)

      if (this._deck.layerManager) {
        // deck is ready
        this._update()
      }
    }
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

    if (this._deck.layerManager) {
      // deck is ready
      this._update()
    }
  }

  zoomTo(rectangle: Rectangle) {
    const scale = Math.min(this._deck.width / rectangle.width, this._deck.height / rectangle.height)
    const zoom = Math.min(Math.log2(scale), MaxZoom)

    this._deck.setProps({
      initialViewState: {
        target: [rectangle.center.x, rectangle.center.y, 0],
        zoom: zoom,
        transitionInterpolator: new LinearInterpolator(['target', 'zoom']),
        transitionDuration: 1000,
      },
    })
  }

  highlight(nodeId: string | null) {
    this._highlightedNodeId = nodeId
    this._highlight(nodeId)
  }

  private _highlight(nodeId: string | null, depth = 2) {
    if (this._graph && this._deck.layerManager) {
      this._graphHighlighter.update({
        sourceId: nodeId,
        maxDepth: depth,
        edgeDepth: false,
      })
      this._deck.layerManager.setNeedsRedraw('hightlight changed')
    }
  }

  private _update() {
    if (!this._graph) return

    const fontSettings = this._textMeasurer.opts

    const geomGraph = <GeomGraph>GeomGraph.getGeom(this._graph)
    this._graphHighlighter = this._graphHighlighter || new GraphHighlighter(this._deck.deckRenderer.gl)
    this._graphHighlighter.setGraph(geomGraph)

    // @ts-ignore
    const edgeLayer = new EdgeLayer({
      id: 'edges',
      data: Array.from(geomGraph.deepEdges()),
      getWidth: 1,
      getDepth: this._graphHighlighter.edgeDepthBuffer,
    })

    // @ts-ignore
    const nodeLayer = new NodeLayer({
      id: 'nodeBoundaries',
      data: Array.from(geomGraph.deepNodes()),
      getDepth: this._graphHighlighter.nodeDepthBuffer,
      fontFamily: fontSettings.fontFamily,
      fontWeight: fontSettings.fontWeight,
      lineHeight: fontSettings.lineHeight,
      getLineWidth: 1,
      getTextSize: fontSettings.fontSize,
      pickable: true,
      onHover: ({object}) => {
        if (!this._highlightedNodeId) {
          this._highlight(object?.id)
        }
      },
    })

    this._deck.setProps({
      layers: [nodeLayer, edgeLayer],
    })

    this.emit({
      type: 'graphload',
      data: this._graph,
    } as Event)

    this.zoomTo(geomGraph.boundingBox)
  }
}
