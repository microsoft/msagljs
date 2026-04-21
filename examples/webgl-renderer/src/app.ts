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

// Settings: corridor smoothing
const corridorSmoothCheckbox = <HTMLInputElement>document.getElementById('corridor-smooth')
corridorSmoothCheckbox.onchange = () => {
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
      opts.corridorSmooth = corridorSmoothCheckbox.checked
      break
    }
    case 'default': {
      opts.edgeRoutingMode = null
      break
    }
  }
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

  // Nearby padded obstacles
  for (const node of gg.nodesBreadthFirst) {
    if (!node.boundaryCurve) continue
    const poly = nodeToPolyline.get(node)
    if (!poly || !viewBB.intersects(poly.boundingBox)) continue
    if (node === foundEdge.source || node === foundEdge.target) continue
    const pts = Array.from(poly).map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polygon points="${pts}" fill="none" stroke="gray" stroke-width="1"/>\n`
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

  // Source/target padded
  if (sourcePoly) {
    const pts = Array.from(sourcePoly).map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polygon points="${pts}" fill="none" stroke="indianred" stroke-width="2"/>\n`
  }
  if (targetPoly) {
    const pts = Array.from(targetPoly).map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polygon points="${pts}" fill="none" stroke="steelblue" stroke-width="2"/>\n`
  }

  // Collapsed path (green solid, underneath)
  if (collapsedPath.length >= 2) {
    const pts = collapsedPath.map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polyline points="${pts}" fill="none" stroke="green" stroke-width="3"/>\n`
  }

  // Uncollapsed path (orange dashed, on top)
  if (rawPath.length >= 2) {
    const pts = rawPath.map(p => `${p.x},${p.y}`).join(' ')
    svg += `<polyline points="${pts}" fill="none" stroke="orange" stroke-width="2" stroke-dasharray="5,3"/>\n`
  }

  svg += `</g></svg>`

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
console.log('Debug: call dumpEdgeSleeve("JOFFREY", "MYCAH") in console to download SVG')
