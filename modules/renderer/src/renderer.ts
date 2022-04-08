import {Deck, OrthographicView, LinearInterpolator} from '@deck.gl/core'

import {DrawingGraph} from 'msagl-js/drawing'

import NodeLayer from './layers/node-layer'
import EdgeLayer from './layers/edge-layer'

import {layoutDrawingGraph} from './layout'
import {GeomGraph, Rectangle, LayoutSettings, GeomNode, Point} from 'msagl-js'

import EventSource, {Event} from './event-source'

export interface IRendererControl {
  onAdd(renderer: Renderer): void
  onRemove(renderer: Renderer): void
  getElement(): HTMLElement | null
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
  get drawingGraph() {
    return this._drawingGraph
  }
  private _geomGraph?: GeomGraph
  private _controls: IRendererControl[] = []
  private _controlsContainer: HTMLDivElement

  constructor(container: HTMLElement = document.body) {
    super()

    container.style.position = 'relative'

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

  get layoutOptions(): LayoutSettings {
    const geomGraph = <GeomGraph>GeomGraph.getGeom(this._drawingGraph.graph)
    return geomGraph == null ? null : geomGraph.layoutSettings
  }

  setGraph(drawingGraph: DrawingGraph = this._drawingGraph) {
    this._drawingGraph = drawingGraph
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

    const geomGraph = (this._geomGraph = layoutDrawingGraph(this._drawingGraph))

    const center = geomGraph.boundingBox.center

    // todo - render edge labels
    const edgeLayer = new EdgeLayer({
      id: 'edges',
      data: Array.from(geomGraph.deepEdges()),
      getWidth: 1,
    })

    const nodeLayer = new NodeLayer({
      id: 'nodeBoundaries',
      data: Array.from(geomGraph.deepNodes()),
      getWidth: 1,
      getSize: 14,
      sizeMaxPixels: 24,
      onClick: (a, b) => callMe(a, b),
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
      data: geomGraph,
    } as Event)
  }
}
function callMe(a: any, b: any) {
  console.log(a)
  console.log(b)
  const geomNode = <GeomNode>a.object
  geomNode.center = geomNode.center.add(new Point(100, 0))
}
