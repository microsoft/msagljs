import {dropZone} from './drag-n-drop'
import {LayoutOptions} from '@msagl/renderer-common'
import {Renderer as WebGLRenderer, SearchControl} from '@msagl/renderer-webgl'

import {EdgeRoutingMode, geometryIsCreated, Graph} from '@msagl/core'

import {SAMPLE_DOT, ROUTING, LAYOUT, FONT} from './settings'
import {DrawingObject} from '@msagl/drawing'
import {loadGraphFromFile, loadGraphFromUrl} from '@msagl/parser'

const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/JSONfiles/gameofthrones.json'
//const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/p2.gv'

/// Debug on main thread
// const renderer = new WebGLRenderer(document.getElementById('viewer'), null)
/// Test worker with local build
const renderer = new WebGLRenderer(document.getElementById('viewer'), './worker.js')
/// Test published version
// const renderer = new Renderer(document.getElementById('viewer'), 'https://unpkg.com/@msagl/renderer@latest/dist/worker.min.js')
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

// Settings: font
const fontSelect = <HTMLSelectElement>document.getElementById('fonts')
for (const f of FONT) {
  const option = document.createElement('option')
  option.value = f
  option.innerText = f
  option.style.fontFamily = f
  fontSelect.appendChild(option)
}
fontSelect.onchange = () => {
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
    label: {
      fontFamily: fontSelect.value,
    },
  }
  DrawingObject.defaultLabelFontName = opts.label.fontFamily
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
    case 'default': {
      opts.edgeRoutingMode = null
      break
    }
  }
  return opts
}
