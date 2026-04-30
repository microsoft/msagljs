import {dropZone} from './drag-n-drop'
import {LayoutOptions} from '@msagl/renderer-common'
import {Renderer as WebGLRenderer, SearchControl} from '@msagl/renderer-webgl'

import {EdgeRoutingMode, geometryIsCreated, Graph, GeomGraph, GeomEdge, GeomNode, Point, Rectangle, Polyline,
  findContainingTriangle, findSleeveAStar, sleeveToDiagonals, funnelFromDiagonals,
  Cdt, InteractiveObstacleCalculator, installBrowserDebugCurvesDownloader} from '@msagl/core'
import type {Diagonal} from '@msagl/core'

// Install the browser-side SVG dumper hook so routing code that calls
// DebugObject.dumpDebugCurves(fileName, curves) triggers an SVG download.
installBrowserDebugCurvesDownloader()

import {SAMPLE_DOT, ROUTING, LAYOUT, FONT} from './settings'
import {DrawingObject} from '@msagl/drawing'
import {loadGraphFromFile, loadGraphFromUrl} from '@msagl/parser'

const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/JSONfiles/gameofthrones.json'
//const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/badvoro.gv'
/// Debug on main thread
// const renderer = new WebGLRenderer(document.getElementById('viewer'), null)
/// Test worker with local build
const renderer = new WebGLRenderer(document.getElementById('viewer'), './worker.js')
/// Test published version
//const renderer = new WebGLRenderer(document.getElementById('viewer'), 'https://unpkg.com/@msagl/renderer-webgl@latest/dist/worker.min.js')
renderer.addControl(new SearchControl())

function showError(msg: string) {
  const banner = document.getElementById('error-banner')
  banner.textContent = msg + ' (click to dismiss)'
  banner.style.display = 'block'
}

function hideError() {
  document.getElementById('error-banner').style.display = 'none'
}

function updateRender(graph: Graph, settings?: LayoutOptions | null): Promise<void>
function updateRender(settings: LayoutOptions): Promise<void>

async function updateRender(graphOrSettings: Graph | LayoutOptions, settings?: LayoutOptions | null) {
  const settingsContainer = <HTMLDivElement>document.getElementById('settings')
  settingsContainer.classList.add('disabled')
  hideError()
  try {
    if (graphOrSettings instanceof Graph) {
      await renderer.setGraph(graphOrSettings, settings)
    } else {
      await renderer.setOptions(graphOrSettings)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Render failed:', e)
    showError(`Failed to render graph: ${msg}`)
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

// Settings: smooth corners toggle
const smoothCornersCheckbox = <HTMLInputElement>document.getElementById('smoothCorners')
smoothCornersCheckbox.onchange = () => {
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
  try {
    const graph = await loadGraphFromFile(f)
    if (!graph) {
      showError('Failed to parse file: ' + f.name)
      return
    }
    updateRender(graph)
    document.getElementById('graph-name').innerText = graph.id + '(' + graph.nodeCountDeep + ',' + graph.deepEdgesCount + ')'
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    showError(`Failed to load file: ${msg}`)
  }
})

// URL loader: load graph from any http(s) URL, including .gz-compressed files
async function loadFromUrlInput(url: string) {
  if (!url) return
  try {
    const graph = await loadGraphFromUrl(url)
    if (!graph) {
      showError('Failed to parse graph from URL: ' + url)
      return
    }
    updateRender(graph)
    document.getElementById('graph-name').innerText = graph.id + '(' + graph.nodeCountDeep + ',' + graph.deepEdgesCount + ')'
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    showError(`Failed to load URL: ${msg}`)
  }
}
const urlInput = <HTMLInputElement>document.getElementById('graph-url')
const urlButton = <HTMLButtonElement>document.getElementById('load-url')
urlButton.onclick = () => loadFromUrlInput(urlInput.value.trim())
urlInput.onkeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    loadFromUrlInput(urlInput.value.trim())
  }
}
// Support ?url=... query param for deep-linking to a graph
{
  const params = new URLSearchParams(window.location.search)
  const linked = params.get('url')
  if (linked) {
    urlInput.value = linked
  }
}
;(async () => {
  try {
    const params = new URLSearchParams(window.location.search)
    const linked = params.get('url')
    const src = linked || defaultGraph
    const graph = await loadGraphFromUrl(src)
    const hasGeom = geometryIsCreated(graph)
    updateRender(graph, hasGeom ? null : getSettings())
    document.getElementById('graph-name').innerText = graph.id + '(' + graph.nodeCountDeep + ',' + graph.deepEdgesCount + ')'
  } catch (e) {
    console.error('Default graph load failed:', e)
    showError('Failed to load default graph.')
  }
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
    case 'sleeve': {
      opts.edgeRoutingMode = EdgeRoutingMode.Sleeve
      break
    }
    case 'default': {
      opts.edgeRoutingMode = null
      break
    }
  }
  opts.smoothCorners = smoothCornersCheckbox.checked
  return opts
}

// Debug: dump SVG for a named edge showing sleeve, both paths, obstacles
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

  // Build CDT
  const padding = 2
  const nodeToPolyline = new Map<GeomNode, Polyline>()
  const obstacles: Polyline[] = []
  const bb = Rectangle.mkEmpty()
  for (const node of gg.nodesBreadthFirst) {
    if (node.boundaryCurve == null) continue
    const poly = InteractiveObstacleCalculator.PaddedPolylineBoundaryOfNode(node.boundaryCurve, padding)
    nodeToPolyline.set(node, poly)
    obstacles.push(poly)
    bb.addRecSelf(poly.boundingBox)
  }
  bb.pad(Math.max(bb.diagonal / 4, 100))
  obstacles.push(bb.perimeter())
  const cdt = new Cdt([], obstacles, [])
  cdt.run()

  const source = foundEdge.source.center
  const target = foundEdge.target.center
  const sourcePoly = nodeToPolyline.get(foundEdge.source)
  const targetPoly = nodeToPolyline.get(foundEdge.target)

  // Find sleeve
  const allowed = new Set<Polyline>()
  if (sourcePoly) allowed.add(sourcePoly)
  if (targetPoly) allowed.add(targetPoly)
  const srcTri = findContainingTriangle(cdt, source)
  const sleeve = srcTri ? findSleeveAStar(srcTri, target, allowed) : null

  // Compute raw diagonals and uncollapsed funnel path
  let rawDiags: Diagonal[] = []
  let rawPath: Point[] = []
  if (sleeve && sleeve.length > 0) {
    rawDiags = sleeveToDiagonals(sleeve)
    rawPath = funnelFromDiagonals(source, target, rawDiags)
  }

  // Compute collapsed funnel path
  let collapsedDiags: Diagonal[] = []
  let collapsedPath: Point[] = []
  if (sleeve && sleeve.length > 0) {
    const cs = sourcePoly ? {poly: sourcePoly, center: source} : undefined
    const ct = targetPoly ? {poly: targetPoly, center: target} : undefined
    collapsedDiags = sleeveToDiagonals(sleeve, cs, ct)
    collapsedPath = funnelFromDiagonals(source, target, collapsedDiags)
  }

  // Build viewbox from sleeve
  const viewBB = Rectangle.mkPP(source, target)
  if (sleeve) {
    for (const fe of sleeve) {
      for (const s of [fe.source.Sites.item0, fe.source.Sites.item1, fe.source.Sites.item2]) {
        viewBB.addRecSelf(Rectangle.mkPP(s.point, s.point))
      }
      const ot = fe.edge.GetOtherTriangle_T(fe.source)
      if (ot) for (const s of [ot.Sites.item0, ot.Sites.item1, ot.Sites.item2]) {
        viewBB.addRecSelf(Rectangle.mkPP(s.point, s.point))
      }
    }
  }
  viewBB.pad(viewBB.diagonal * 0.15)

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewBB.width}" height="${viewBB.height}" viewBox="${viewBB.left} ${viewBB.bottom} ${viewBB.width} ${viewBB.height}">\n`
  svg += `<g transform="scale(1,-1) translate(0,${-(viewBB.bottom + viewBB.top)})">\n`

  // Nearby padded obstacles (with labels)
  const labelDraws: string[] = []
  for (const node of gg.nodesBreadthFirst) {
    if (!node.boundaryCurve) continue
    const poly = nodeToPolyline.get(node)
    if (!poly || !viewBB.intersects(poly.boundingBox)) continue
    if (node === foundEdge.source || node === foundEdge.target) continue
    const pts = Array.from(poly).map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polygon points="${pts}" fill="#EEEEEE" fill-opacity="0.7" stroke="#BDBDBD" stroke-width="0.5"/>\n`
    const id = (node.node as any).id ?? ''
    if (id) {
      const c = node.center
      // Labels live OUTSIDE the flipped group so text reads upright.
      labelDraws.push(`<text x="${c.x}" y="${(viewBB.bottom + viewBB.top) - c.y}" text-anchor="middle" dominant-baseline="central" font-size="6" fill="#9E9E9E">${id}</text>\n`)
    }
  }

  // Sleeve triangles (dashed blue)
  if (sleeve) {
    const seen = new Set()
    for (const fe of sleeve) {
      const drawTri = (t: any) => {
        if (seen.has(t)) return; seen.add(t)
        const p0 = t.Sites.item0.point, p1 = t.Sites.item1.point, p2 = t.Sites.item2.point
        svg += `<polygon points="${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y}" fill="rgba(100,149,237,0.08)" stroke="cornflowerblue" stroke-width="1.5"/>\n`
      }
      drawTri(fe.source)
      const ot = fe.edge.GetOtherTriangle_T(fe.source)
      if (ot) drawTri(ot)
    }
  }

  // Collapsed sleeve perimeter (purple): the polygon the funnel sees after
  // collapsing source/target obstacle vertices to the node centers.
  if (collapsedDiags.length > 0) {
    const ring: Point[] = []
    const push = (p: Point) => {
      const last = ring[ring.length - 1]
      if (!last || last.sub(p).length > 1e-6) ring.push(p)
    }
    push(source)
    for (const d of collapsedDiags) push(d.left)
    push(target)
    for (let i = collapsedDiags.length - 1; i >= 0; i--) push(collapsedDiags[i].right)
    const pts = ring.map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polygon points="${pts}" fill="none" stroke="#6A1B9A" stroke-width="2" stroke-dasharray="6,3"/>\n`
  }

  // Source/target padded
  if (sourcePoly) {
    const pts = Array.from(sourcePoly).map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polygon points="${pts}" fill="#E3F2FD" fill-opacity="0.6" stroke="#1565C0" stroke-width="1.5"/>\n`
  }
  if (targetPoly) {
    const pts = Array.from(targetPoly).map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polygon points="${pts}" fill="#E3F2FD" fill-opacity="0.6" stroke="#1565C0" stroke-width="1.5"/>\n`
  }

  // Collapsed path (red solid, underneath)
  if (collapsedPath.length >= 2) {
    const pts = collapsedPath.map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polyline points="${pts}" fill="none" stroke="#D32F2F" stroke-width="2.5"/>\n`
  }

  // Uncollapsed path (orange dashed, on top)
  if (rawPath.length >= 2) {
    const pts = rawPath.map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polyline points="${pts}" fill="none" stroke="#FB8C00" stroke-width="1.6" stroke-dasharray="4,2"/>\n`
  }

  // Source / target endpoint markers and names
  const srcName = foundEdge.source.node.id
  const tgtName = foundEdge.target.node.id
  svg += `<circle cx="${source.x}" cy="${source.y}" r="3" fill="#0D47A1" stroke="white" stroke-width="0.8"/>\n`
  svg += `<circle cx="${target.x}" cy="${target.y}" r="3" fill="#0D47A1" stroke="white" stroke-width="0.8"/>\n`

  svg += `</g>\n`
  // Endpoint labels (outside flipped group, upright text)
  const yFlip = (y: number) => (viewBB.bottom + viewBB.top) - y
  for (const lbl of labelDraws) svg += lbl
  svg += `<text x="${source.x}" y="${yFlip(source.y) - 6}" text-anchor="middle" font-size="9" font-weight="bold" fill="#0D47A1">${srcName}</text>\n`
  svg += `<text x="${target.x}" y="${yFlip(target.y) - 6}" text-anchor="middle" font-size="9" font-weight="bold" fill="#0D47A1">${tgtName}</text>\n`
  svg += `</svg>`

  const blob = new Blob([svg], {type: 'image/svg+xml'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sleeve_${srcId}_${tgtId}.svg`
  a.click()
  URL.revokeObjectURL(url)
  console.log(`Downloaded sleeve_${srcId}_${tgtId}.svg`)
}

;(window as any).dumpEdgeSleeve = dumpEdgeSleeve
//console.log('Debug: call dumpEdgeSleeve("JOFFREY", "MYCAH") in console to download SVG')
