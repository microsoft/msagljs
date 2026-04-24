import {Deck, OrthographicView, LinearInterpolator} from '@deck.gl/core/typed'
import {NonGeoBoundingBox, TileLayer} from '@deck.gl/geo-layers/typed'
// import {PolygonLayer} from '@deck.gl/layers/typed'
import {ClipExtension} from '@deck.gl/extensions/typed'

import {DrawingGraph, DrawingNode, DrawingObject} from '@msagl/drawing'

import GraphLayer from './layers/graph-layer'

import {layoutGraph, layoutGraphOnWorker, LayoutOptions, deepEqual, TextMeasurer} from '@msagl/renderer-common'
import {Graph, GeomGraph, Rectangle, GeomNode, GeomObject, Edge, Node, TileMap, TileData, geometryIsCreated} from '@msagl/core'

import {Matrix4} from '@math.gl/core'

import EventSource, {Event} from './event-source'

import GraphHighlighter from './layers/graph-highlighter'
import {GraphStyleSpecification, DefaultGraphStyle} from './styles/graph-style-spec'
import {parseGraphStyle, ParsedGraphStyle} from './styles/graph-style-evaluator'

export interface IRendererControl {
  onAdd(renderer: Renderer): void
  onRemove(renderer: Renderer): void
  getElement(): HTMLElement | null
}

const MaxZoom = 2

/** Resolve a user-visible label for a node: its drawing `labelText` if any,
 *  otherwise its `id`. */
function nodeLabel(node: Node): string {
  const d = DrawingObject.getDrawingObj(node) as DrawingNode | undefined
  const t = d?.labelText
  if (t && t.length > 0) return t
  return node.id ?? ''
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default:  return '&#39;'
    }
  })
}

const tooltipStyle = {
  background: 'rgba(30,30,30,0.9)',
  color: '#fff',
  padding: '4px 8px',
  borderRadius: '4px',
  fontFamily: 'sans-serif',
  fontSize: '12px',
  pointerEvents: 'none',
  // Offset the tooltip above and to the right of the cursor so the
  // hand/pointer icon doesn't cover it. deck.gl sets left/top to the
  // hover pixel; margins shift the box from that origin.
  marginLeft: '14px',
  marginTop: '-32px',
} as const

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
  private _highlightedEdge: Edge | null = null
  private _layoutWorkerUrl?: string
  private _style: ParsedGraphStyle = parseGraphStyle(DefaultGraphStyle)
  private _graphOffset: {x: number; y: number} = {x: 0, y: 0}
  private _tooltipEl: HTMLDivElement

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

    // Custom tooltip overlay. `getTooltip` on `Deck` only fires on hover, which
    // doesn't happen on touch devices (iOS etc.), so we manage our own element
    // and update it from both onHover and onClick.
    this._tooltipEl = document.createElement('div')
    Object.assign(this._tooltipEl.style, {
      position: 'absolute',
      display: 'none',
      pointerEvents: 'none',
      zIndex: '3',
      ...tooltipStyle,
    })
    divs[1].appendChild(this._tooltipEl)

    this._deck = new Deck({
      parent: divs[0],
      views: [new OrthographicView({flipY: false})],
      initialViewState: {
        target: [0, 0, 0],
        zoom: 0,
        maxZoom: MaxZoom,
      },
      pickingRadius: 10,
      controller: true,
      onLoad: () => {
        this.emit('load')
        this._update()
      },
      onClick: ({object, x, y}) => {
        if (!object) {
          if (this._highlightedNodeId) {
            this.highlight(null)
            this._highlightedEdge = null
          }
          this._hideTooltip()
          return
        }
        this._updateTooltip(object, x, y)
      },
      onHover: ({object, x, y}) => {
        this._updateTooltip(object, x, y)
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

  setStyle(style: GraphStyleSpecification) {
    this._style = parseGraphStyle(style)
    const layer = this._deck.props.layers[0]
    if (layer) {
      const newLayer = layer.clone({
        graphStyle: this._style,
      })
      this._deck.setProps({
        layers: [newLayer],
      })
    }
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

      if (options && !geometryIsCreated(graph)) {
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
        target: [rectangle.center.x + this._graphOffset.x, rectangle.center.y + this._graphOffset.y, 0],
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

  private _hideTooltip() {
    this._tooltipEl.style.display = 'none'
  }

  private _tooltipHtmlForObject(object: unknown): string | null {
    if (object instanceof Edge) {
      const sVisible = this._isNodeVisible(object.source)
      const tVisible = this._isNodeVisible(object.target)
      // Only show labels for endpoints that are NOT visible on screen — if the
      // user can already see a node, there's no need to name it.
      if (sVisible && tVisible) return null
      const parts: string[] = []
      if (!sVisible) parts.push(`<b>${escapeHtml(nodeLabel(object.source))}</b>`)
      if (!tVisible && object.target !== object.source) parts.push(`<b>${escapeHtml(nodeLabel(object.target))}</b>`)
      if (parts.length === 0) return null
      return parts.join(' → ')
    }
    if (object instanceof GeomNode) {
      return escapeHtml(nodeLabel(object.node))
    }
    return null
  }

  private _updateTooltip(object: unknown, x: number, y: number) {
    const html = this._tooltipHtmlForObject(object)
    if (html == null) {
      this._hideTooltip()
      return
    }
    this._tooltipEl.innerHTML = html
    this._tooltipEl.style.display = 'block'
    // Position above-and-right of the pointer so the cursor/finger doesn't
    // cover the text. The tooltip is attached to divs[1] which spans the full
    // container, so (x,y) in container coords can be used directly.
    this._tooltipEl.style.left = x + 'px'
    this._tooltipEl.style.top = y + 'px'
  }

  private _isNodeVisible(node: Node): boolean {
    const g = GeomObject.getGeom(node) as GeomNode | undefined
    if (!g) return true // can't tell — assume visible, suppress tooltip
    const viewports = this._deck?.getViewports?.()
    if (!viewports || viewports.length === 0) return true
    const [minX, minY, maxX, maxY] = viewports[0].getBounds()
    const bb = g.boundingBox
    if (!bb) {
      const cx = g.center.x + this._graphOffset.x
      const cy = g.center.y + this._graphOffset.y
      return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY
    }
    const nxMin = bb.left + this._graphOffset.x
    const nxMax = bb.right + this._graphOffset.x
    const nyMin = bb.bottom + this._graphOffset.y
    const nyMax = bb.top + this._graphOffset.y
    // Node is "visible" iff its bounding box intersects the viewport bounds.
    return nxMax >= minX && nxMin <= maxX && nyMax >= minY && nyMin <= maxY
  }

  private async _layoutGraph(forceUpdate: boolean) {
    const t0 = performance.now()
    if (this._layoutWorkerUrl) {
      console.log('layout on worker')
      this._graph = await layoutGraphOnWorker(this._layoutWorkerUrl, this._graph, this._layoutOptions, forceUpdate)
    } else {
      layoutGraph(this._graph, this._layoutOptions, forceUpdate)
    }

    if (this._deck.layerManager) {
      // deck is ready
      this._update()
    }
    console.log(`total processing: ${(performance.now() - t0).toFixed(1)}ms`)
  }

  private _update() {
    if (!this._graph) return

    const fontSettings = this._textMeasurer.opts

    const geomGraph = GeomGraph.getGeom(this._graph)

    if (!geomGraph) {
      return
    }

    this._graphHighlighter = this._graphHighlighter || new GraphHighlighter(this._deck.deckRenderer.gl)
    this._graphHighlighter.setGraph(geomGraph)

    const boundingBox = geomGraph.boundingBox

    console.time('Generate tiles')
    const rootTileSize = 2 ** Math.ceil(Math.log2(Math.max(boundingBox.width, boundingBox.height)))
    const startZoom = Math.min(MaxZoom, Math.round(9 - Math.log2(rootTileSize))) // tileSize 512 = 2 ** 9
    // Pad boundingBox to square
    const rootTile = new Rectangle({
      left: boundingBox.left - (rootTileSize - boundingBox.width) / 2,
      bottom: boundingBox.bottom - (rootTileSize - boundingBox.height) / 2,
      right: boundingBox.right + (rootTileSize - boundingBox.width) / 2,
      top: boundingBox.top + (rootTileSize - boundingBox.height) / 2,
    })
    // Memory budget: each tile element ≈ 200 bytes.  At the bottom layer with
    // k×k tiles an average edge crosses k/4 tiles, giving ≈ (k/4)*M + N
    // elements.  Doubling for all layers: total ≈ 2*((k/4)*M + N).
    // Stay under 4 GB → total*200 ≤ 4e9 → (k/4)*M + N ≤ 1e7.
    const N = geomGraph.graph.nodeCountDeep
    const M = geomGraph.graph.deepEdgesCount
    const maxElements = 1e7 // 4GB / 200 bytes / 2 (all-layers factor)
    const maxK = M > 0 ? Math.floor(((maxElements - N) * 4) / M) : 1e6
    const safeLevels = Math.max(1, Math.min(8, Math.floor(Math.log2(Math.max(1, maxK)))))
    console.log(`Tile budget: N=${N}, M=${M}, maxK=${maxK}, safeLevels=${safeLevels}`)
    const tileMap = new TileMap(geomGraph, rootTile)
    const numberOfLevels = tileMap.buildUpToLevel(safeLevels)
    console.timeEnd('Generate tiles')

    console.time('initial render')

    const modelMatrix = new Matrix4().translate([rootTileSize / 2 - rootTile.center.x, rootTileSize / 2 - rootTile.center.y, 0])
    this._graphOffset = {x: rootTileSize / 2 - rootTile.center.x, y: rootTileSize / 2 - rootTile.center.y}

    const layer = new TileLayer<
      TileData,
      {
        graphStyle: ParsedGraphStyle
      }
    >({
      extent: [0, 0, rootTileSize, rootTileSize],
      refinementStrategy: 'no-overlap',
      minZoom: startZoom,
      maxZoom: numberOfLevels - 1 + startZoom,
      tileSize: 512,
      getTileData: (tile) => {
        const {x, y, z} = tile.index
        tile.bbox as NonGeoBoundingBox
        return tileMap.getTileData(x, y, z - startZoom)
      },
      // For debugging
      // onClick: ({sourceLayer}) => {
      //   // @ts-ignore
      //   console.log(sourceLayer.props.tile.id, sourceLayer.props.tile.data)
      // },
      autoHighlight: false,
      onHover: ({object}) => {
        if (this._highlightedNodeId) return

        if (object instanceof GeomNode) {
          this._highlightedEdge = null
          this._graphHighlighter.setHighlightedEdge(null)
          this._highlight(object.id)
          return
        }

        if (object instanceof Edge) {
          if (this._highlightedEdge !== object) {
            this._highlightedEdge = object
            this._graphHighlighter.setHighlightedEdge(object)
            this._graphHighlighter.highlightNodes([object.source.id, object.target.id])
            this._deck.layerManager.setNeedsRedraw('edge highlight changed')
          }
          return
        }

        // No object under cursor — clear highlight
        if (this._highlightedEdge) {
          this._highlightedEdge = null
          this._graphHighlighter.setHighlightedEdge(null)
          this._highlight(null)
        }
      },
      graphStyle: this._style,

      // @ts-ignore
      renderSubLayers: ({data, graphStyle, id, tile}) => {
        if (!data) return null

        const bbox = data.rect
        // const { left, right, top, bottom } = tile.bbox as NonGeoBoundingBox

        return [
          // For debugging
          // new PolygonLayer({
          //   id: id + 'bounds',
          //   data: [0],
          //   parameters: {
          //     depthMask: false
          //   },
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

          new GraphLayer({
            id: id,
            data,
            modelMatrix,
            highlighter: this._graphHighlighter,
            fontFamily: fontSettings.fontFamily,
            fontWeight: fontSettings.fontWeight,
            lineHeight: fontSettings.lineHeight,
            resolution: 2 ** (tile.index.z - 2),
            pickable: true,
            graphStyle,
            tileMap,
            levelIndex: tile.index.z - startZoom,
            // @ts-ignore
            clipBounds: [bbox.left, bbox.bottom, bbox.right, bbox.top],
            clipByInstance: false,
            extensions: [new ClipExtension()],
          }),
        ]
      },
      updateTriggers: {
        getTileData: Date.now(),
      },
    })

    this._deck.setProps({
      layers: [layer],
      initialViewState: {
        target: [rootTileSize / 2, rootTileSize / 2, 0],
        zoom: startZoom,
        minZoom: startZoom - 2,
        maxZoom: Math.max(MaxZoom, startZoom + 2),
      },
      onAfterRender: () => {
        if (layer.isLoaded) {
          console.timeEnd('initial render')
          this._deck.setProps({
            onAfterRender: noop,
          })
        }
      },
    })

    this.emit({
      type: 'graphload',
      data: this._graph,
    } as Event)
  }
}

// eslint-disable-next-line
function noop() {}
