import {Deck, OrthographicView, LinearInterpolator} from '@deck.gl/core/typed'
import {TileLayer} from '@deck.gl/geo-layers/typed'
import {ClipExtension} from '@deck.gl/extensions/typed'

import {DrawingGraph, TextMeasurerOptions} from 'msagl-js/drawing'

import NodeLayer from './layers/node-layer'
import EdgeLayer from './layers/edge-layer'

import {layoutGraph, layoutGraphOnWorker} from './layout'
import {Graph, GeomGraph, Rectangle, EdgeRoutingMode, GeomNode, GeomEdge} from 'msagl-js'

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
  layoutType?: 'Sugiyama LR' | 'Sugiyama TB' | 'Sugiyama BT' | 'Sugiyama RL' | 'MDS' | 'FD'
  label?: Partial<TextMeasurerOptions>
  edgeRoutingMode?: EdgeRoutingMode
}

const MaxZoom = 4

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
  private _layoutWorkerUrl?: string

  constructor(container: HTMLElement = document.body, layoutWorkerUrl?: string) {
    super()

    this._layoutWorkerUrl = layoutWorkerUrl
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
      views: [new OrthographicView({})],
      initialViewState: {
        target: [0, 0, 0],
        zoom: 0,
        maxZoom: MaxZoom,
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

  /** when the graph is set : the geometry for it is created and the layout is done
   * Explicitly set options to null to use existing geometry
   */
  async setGraph(graph: Graph, options: LayoutOptions | null = this._layoutOptions) {
    if (this._graph === graph) {
      if (options) {
        await this.setOptions(options)
      }
    } else {
      this._graph = graph

      if (options) {
        this._layoutOptions = options
        this._textMeasurer.setOptions(options.label || {})
        this._highlightedNodeId = null

        const drawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(graph) || new DrawingGraph(graph)
        drawingGraph.createGeometry(this._textMeasurer.measure)
        await this._layoutGraph(true)
      } else if (this._deck.layerManager) {
        // deck is ready
        this._update()
      }
    }
  }

  async setOptions(options: LayoutOptions) {
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
    await this._layoutGraph(relayout)
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
        maxZoom: MaxZoom,
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

  private async _layoutGraph(forceUpdate: boolean) {
    if (this._layoutWorkerUrl) {
      this._graph = await layoutGraphOnWorker(this._layoutWorkerUrl, this._graph, this._layoutOptions, forceUpdate)
    } else {
      layoutGraph(this._graph, this._layoutOptions, forceUpdate)
    }

    if (this._deck.layerManager) {
      // deck is ready
      this._update()
    }
  }

  private _update() {
    if (!this._graph) return

    const fontSettings = this._textMeasurer.opts

    const geomGraph = <GeomGraph>GeomGraph.getGeom(this._graph)

    if (!geomGraph) {
      return
    }

    console.time('initial render')
    this._graphHighlighter = this._graphHighlighter || new GraphHighlighter(this._deck.deckRenderer.gl)
    this._graphHighlighter.setGraph(geomGraph)

    const rtree = geomGraph.buildRTree()
    const boundingBox = geomGraph.boundingBox
    const layer = new TileLayer<{nodes: GeomNode[]; edges: GeomEdge[]}>({
      extent: [boundingBox.left, boundingBox.bottom, boundingBox.right, boundingBox.top],
      refinementStrategy: 'no-overlap',
      getTileData: ({bbox}) => {
        // @ts-ignore
        const rect = new Rectangle({left: bbox.left, right: bbox.right, bottom: bbox.top, top: bbox.bottom})
        const nodes: GeomNode[] = []
        const edges: GeomEdge[] = []
        for (const obj of geomGraph.intersectedObjects(rtree, rect, false)) {
          if (obj instanceof GeomNode) {
            nodes.push(obj)
          } else if (obj instanceof GeomEdge) {
            edges.push(obj)
          }
        }
        return {nodes, edges}
      },
      parameters: {
        depthTest: false,
      },
      // For debugging
      // onClick: ({sourceLayer}) => {
      //   // @ts-ignore
      //   console.log(sourceLayer.props.tile.id, sourceLayer.props.tile.data)
      // },
      autoHighlight: true,
      onHover: ({object, sourceLayer}) => {
        if (!this._highlightedNodeId) {
          if (sourceLayer.id.endsWith('nodes') && object && !(object instanceof GeomGraph)) {
            this._highlight(object.id)
          } else {
            this._highlight(null)
          }
        }
      },
      renderSubLayers: ({data, id, tile}) => {
        // @ts-ignore
        const {left, right, top, bottom} = tile.bbox
        const rect = new Rectangle({left: left, right: right, bottom: top, top: bottom})
        return [
          // For debugging
          // new PolygonLayer({
          //   id: id + 'bounds',
          //   data: [0],
          //   getPolygon: (_) => [
          //     [left, bottom],
          //     [right, bottom],
          //     [right, top],
          //     [left, top],
          //   ],
          //   pickable: true,
          //   autoHighlight: true,
          //   highlightColor: [0, 0, 0, 32],
          //   getFillColor: [0, 0, 0, 0],
          //   getLineColor: [255, 0, 0],
          //   getLineWidth: 2,
          //   lineWidthUnits: 'pixels',
          // }),

          new NodeLayer({
            id: id + 'nodes',
            data: data.nodes,
            getPickingColor: (n, {target}) => this._graphHighlighter.encodeNodeIndex(n, target),
            fromIndex: (i) => this._graphHighlighter.getNode(i),
            nodeDepth: this._graphHighlighter.nodeDepth,
            getLineWidth: 1,
            fontFamily: fontSettings.fontFamily,
            fontWeight: fontSettings.fontWeight,
            lineHeight: fontSettings.lineHeight,
            getTextSize: fontSettings.fontSize,
            pickable: true,
            // @ts-ignore
            clipBounds: [left, top, right, bottom],
            clipByInstance: false,
            extensions: [new ClipExtension()],
          }),

          new EdgeLayer({
            id: id + 'edges',
            data: data.edges,
            clipBounds: rect,
            getWidth: 1,
            getDepth: this._graphHighlighter.edgeDepth,
            resolution: 2 ** (tile.index.z - 2),
            fontFamily: fontSettings.fontFamily,
            fontWeight: fontSettings.fontWeight,
            lineHeight: fontSettings.lineHeight,
            getTextSize: fontSettings.fontSize,
          }),
        ]
      },
      updateTriggers: {
        getTileData: Date.now(),
      },
    })

    this._deck.setProps({
      layers: [layer],
    })

    this.emit({
      type: 'graphload',
      data: this._graph,
    } as Event)

    this.zoomTo(geomGraph.boundingBox)
    console.timeEnd('initial render')
  }
}
