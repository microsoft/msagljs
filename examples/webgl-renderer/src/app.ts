import {dropZone} from './drag-n-drop'
import {LayoutOptions} from '@msagl/renderer-common'
import {Renderer as WebGLRenderer, SearchControl} from '@msagl/renderer-webgl'

import {EdgeRoutingMode, geometryIsCreated, Graph, GeomGraph, GeomEdge, GeomNode, Point, Rectangle, Polyline} from '@msagl/core'

import {SAMPLE_DOT, ROUTING, LAYOUT, FONT} from './settings'
import {DrawingObject} from '@msagl/drawing'
import {loadGraphFromFile, loadGraphFromUrl} from '@msagl/parser'

const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/JSONfiles/gameofthrones.json'
//const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/badvoro.gv'
/// Debug on main thread
const renderer = new WebGLRenderer(document.getElementById('viewer'), null)
/// Test worker with local build
// const renderer = new WebGLRenderer(document.getElementById('viewer'), './worker.js')
/// Test published version
//const renderer = new WebGLRenderer(document.getElementById('viewer'), 'https://unpkg.com/@msagl/renderer-webgl@latest/dist/worker.min.js')
renderer.addControl(new SearchControl())

function updateRender(graph: Graph, settings?: LayoutOptions | null): Promise<void>
function updateRender(settings: LayoutOptions): Promise<void>

async function updateRender(graphOrSettings: Graph | LayoutOptions, settings?: LayoutOptions | null) {
  const settingsContainer = <HTMLDivElement>document.getElementById('settings')
  settingsContainer.classList.add('disabled')
  if (graphOrSettings instanceof Graph) {
    await renderer.setGraph(graphOrSettings, settings)
  } else {
    await renderer.setOptions(graphOrSettings)
  }
  settingsContainer.classList.remove('disabled')
}

// Dot file selector
const dotFileSelect = <HTMLSelectElement>document.getElementById('gv')
for (const name of SAMPLE_DOT) {
  const option = document.createElement('option')
  option.value = name
  option.innerText = name
  dotFileSelect.appendChild(option)
}
dotFileSelect.selectedIndex = -1
dotFileSelect.onchange = () => {
  const url = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/' + dotFileSelect.value
  loadGraphFromUrl(url).then((graph) => {
    updateRender(graph)
    document.getElementById('graph-name').innerText = graph.id + '(' + graph.nodeCountDeep + ',' + graph.deepEdgesCount + ')'
  })
}

// Settings: edge routing
const edgeRoutingSelect = <HTMLSelectElement>document.getElementById('routings')
for (const r in ROUTING) {
  const option = document.createElement('option')
  option.value = r
  option.innerText = ROUTING[r]
  edgeRoutingSelect.appendChild(option)
}
edgeRoutingSelect.onchange = () => {
  updateRender(getSettings())
}

// Settings: layout
const layoutSelect = <HTMLSelectElement>document.getElementById('layouts')
for (const l in LAYOUT) {
  const option = document.createElement('option')
  option.value = l
  option.innerText = LAYOUT[l]
  layoutSelect.appendChild(option)
}
layoutSelect.onchange = () => {
  updateRender(getSettings())
}

// File selector
dropZone('drop-target', async (f: File) => {
  const graph = await loadGraphFromFile(f)
  updateRender(graph)
  document.getElementById('graph-name').innerText = graph.id + '(' + graph.nodeCountDeep + ',' + graph.deepEdgesCount + ')'
})
;(async () => {
  const graph = await loadGraphFromUrl(defaultGraph)
  const hasGeom = geometryIsCreated(graph)
  updateRender(graph, hasGeom ? null : getSettings())

  document.getElementById('graph-name').innerText = graph.id + '(' + graph.nodeCountDeep + ',' + graph.deepEdgesCount + ')'
})()

function getSettings(): LayoutOptions {
  const opts: LayoutOptions = {
    
  }
  switch (layoutSelect.value) {
    case 'lr':
      opts.layoutType = 'Sugiyama LR'
      break
    case 'rl':
      opts.layoutType = 'Sugiyama RL'
      break
    case 'tb':
      opts.layoutType = 'Sugiyama TB'
      break
    case 'bt':
      opts.layoutType = 'Sugiyama BT'
      break
    case 'mds':
      opts.layoutType = 'MDS'
      break
    case 'ipsepCola':
      opts.layoutType = 'IPsepCola'
      break
    default:
      break
  }

  switch (edgeRoutingSelect.value) {
    case 'rectilinear':
      opts.edgeRoutingMode = EdgeRoutingMode.Rectilinear
      break
    case 'splines': {
      opts.edgeRoutingMode = EdgeRoutingMode.Spline
      break
    }
    case 'bundles': {
      opts.edgeRoutingMode = EdgeRoutingMode.SplineBundling
      break
    }
    case 'straight': {
      opts.edgeRoutingMode = EdgeRoutingMode.StraightLine
      break
    }
    case 'corridor': {
      opts.edgeRoutingMode = EdgeRoutingMode.Corridor
      break
    }
    case 'default': {
      opts.edgeRoutingMode = null
      break
    }
  }
  return opts
}

// Debug: dump SVG for a named edge showing route + obstacles
function dumpEdgeSleeve(srcId: string, tgtId: string) {
  const graph = (renderer as any)._graph as Graph
  if (!graph) { console.log('No graph loaded'); return }
  const gg = GeomGraph.getGeom(graph)
  if (!gg) { console.log('No geometry'); return }

  let foundEdge: GeomEdge | null = null
  for (const e of gg.deepEdges) {
    if ((e.edge.source.id === srcId && e.edge.target.id === tgtId) ||
        (e.edge.source.id === tgtId && e.edge.target.id === srcId)) {
      foundEdge = e; break
    }
  }
  if (!foundEdge) { console.log(`Edge ${srcId}-${tgtId} not found`); return }

  const source = foundEdge.source.center
  const target = foundEdge.target.center
  const viewBB = Rectangle.mkPP(source, target)
  viewBB.pad(viewBB.diagonal * 0.5)

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewBB.width}" height="${viewBB.height}" viewBox="${viewBB.left} ${viewBB.bottom} ${viewBB.width} ${viewBB.height}">\n`
  svg += `<g transform="scale(1,-1) translate(0,${-(viewBB.bottom + viewBB.top)})">\n`

  // Draw nearby nodes
  for (const node of gg.nodesBreadthFirst) {
    if (!node.boundaryCurve) continue
    const bc = node.boundaryCurve.boundingBox
    if (!viewBB.intersects(bc)) continue
    const isSource = node === foundEdge.source
    const isTarget = node === foundEdge.target
    const color = isSource ? 'red' : isTarget ? 'blue' : 'gray'
    const width = (isSource || isTarget) ? 1.5 : 0.5
    svg += `<rect x="${bc.left}" y="${bc.bottom}" width="${bc.width}" height="${bc.height}" fill="none" stroke="${color}" stroke-width="${width}"/>\n`
    // label
    svg += `<text x="${bc.center.x}" y="${bc.center.y}" text-anchor="middle" font-size="3" fill="${color}" transform="scale(1,-1) translate(0,${-2*bc.center.y})">${node.node.id}</text>\n`
  }

  // Draw all edges from/to source or target that are visible
  for (const e of gg.deepEdges) {
    if (!e.curve) continue
    if (e !== foundEdge) {
      if (e.source !== foundEdge.source && e.source !== foundEdge.target &&
          e.target !== foundEdge.source && e.target !== foundEdge.target) continue
    }
    const curve = e.curve
    const steps = 40
    const pts: string[] = []
    for (let i = 0; i <= steps; i++) {
      const t = curve.parStart + (curve.parEnd - curve.parStart) * (i / steps)
      const p = curve.value(t)
      pts.push(`${p.x},${p.y}`)
    }
    const color = e === foundEdge ? 'red' : 'lightgray'
    const w = e === foundEdge ? 1.5 : 0.3
    svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="${w}"/>\n`
  }

  svg += `</g></svg>`

  const blob = new Blob([svg], {type: 'image/svg+xml'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `edge_${srcId}_${tgtId}.svg`
  a.click()
  URL.revokeObjectURL(url)
  console.log(`Downloaded edge_${srcId}_${tgtId}.svg`)
}

;(window as any).dumpEdgeSleeve = dumpEdgeSleeve
console.log('Debug: call dumpEdgeSleeve("JOFFREY", "MYCAH") in console to download SVG')
