import {dropZone} from './drag-n-drop'
import {LayoutOptions} from '@msagl/renderer-common'
import {Renderer as WebGLRenderer, SearchControl} from '@msagl/renderer-webgl'
import {EdgeRoutingMode, Graph} from '@msagl/core'
import {loadGraphFromFile, loadGraphFromUrl} from '@msagl/parser'

import {SAMPLE_GRAPHS, LAYOUT, isSugiyamaLayout, LARGE_GRAPH_NODE_THRESHOLD, SLOW_GRAPH_ETA_SEC} from './settings'

const defaultGraphUrl = SAMPLE_GRAPHS[0].url

const renderer = new WebGLRenderer(document.getElementById('viewer'), './worker.js')
renderer.addControl(new SearchControl())

// Currently rendered graph; needed to validate layout choices when the user
// changes the layout dropdown without re-loading the graph.
let currentGraph: Graph | null = null

function showError(msg: string) {
  const banner = document.getElementById('error-banner')
  banner.textContent = msg + ' (click to dismiss)'
  banner.style.display = 'block'
}

function hideError() {
  document.getElementById('error-banner').style.display = 'none'
}

function setGraphLabel(graph: Graph) {
  document.getElementById('graph-name').innerText =
    graph.id + '(' + graph.nodeCountDeep + ',' + graph.deepEdgesCount + ')'
}

// Graphs with cluster/subgraph nodes are out of scope for this example.
function rejectIfHasSubgraphs(graph: Graph): boolean {
  if (graph.hasSubgraphs()) {
    showError('This example skips graphs with subgraphs (clusters). Pick a flat graph.')
    return true
  }
  return false
}

// If the current layout is Sugiyama and the graph is too large, fall back to
// IPsepCola and update the dropdown. Returns a warning string the caller
// should display *after* re-rendering (re-rendering clears the error banner).
function ensureLayoutFitsGraph(graph: Graph): string | null {
  const layoutSelect = <HTMLSelectElement>document.getElementById('layouts')
  if (isSugiyamaLayout(layoutSelect.value) && graph.nodeCountDeep > LARGE_GRAPH_NODE_THRESHOLD) {
    layoutSelect.value = 'ipsepCola'
    return `Sugiyama layouts are blocked for graphs with more than ${LARGE_GRAPH_NODE_THRESHOLD} nodes ` +
      `(this graph has ${graph.nodeCountDeep}). Falling back to IPsepCola.`
  }
  return null
}

function getSettings(): LayoutOptions {
  const opts: LayoutOptions = {}
  const layoutSelect = <HTMLSelectElement>document.getElementById('layouts')
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
  // This example only ever applies sleeve routing.
  opts.edgeRoutingMode = EdgeRoutingMode.Sleeve
  const smooth = <HTMLInputElement>document.getElementById('smoothCorners')
  opts.smoothCorners = smooth.checked
  return opts
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

// Accept a freshly loaded graph: run the subgraph guard, set the label,
// pick a layout that fits, and render with sleeve routing.
async function acceptGraph(graph: Graph) {
  if (rejectIfHasSubgraphs(graph)) return
  currentGraph = graph
  setGraphLabel(graph)
  const warning = ensureLayoutFitsGraph(graph)
  await updateRender(graph, getSettings())
  if (warning) showError(warning)
}

// Sample-graphs dropdown
const sampleSelect = <HTMLSelectElement>document.getElementById('sample-select')
for (const s of SAMPLE_GRAPHS) {
  const option = document.createElement('option')
  option.value = s.url
  option.innerText = s.label
  sampleSelect.appendChild(option)
}
sampleSelect.selectedIndex = -1
sampleSelect.onchange = async () => {
  try {
    const picked = SAMPLE_GRAPHS.find((s) => s.url === sampleSelect.value)
    if (picked && picked.etaSec >= SLOW_GRAPH_ETA_SEC) {
      const ok = window.confirm(
        `"${picked.label}" is a large graph; loading might take a long time. Continue?`,
      )
      if (!ok) {
        sampleSelect.selectedIndex = -1
        return
      }
    }
    const graph = await loadGraphFromUrl(sampleSelect.value)
    if (!graph) {
      showError('Failed to parse sample graph.')
      return
    }
    await acceptGraph(graph)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    showError(`Failed to load sample: ${msg}`)
  }
}

// Layout dropdown
const layoutSelect = <HTMLSelectElement>document.getElementById('layouts')
for (const l in LAYOUT) {
  const option = document.createElement('option')
  option.value = l
  option.innerText = LAYOUT[l]
  layoutSelect.appendChild(option)
}
layoutSelect.onchange = async () => {
  if (currentGraph && isSugiyamaLayout(layoutSelect.value) &&
      currentGraph.nodeCountDeep > LARGE_GRAPH_NODE_THRESHOLD) {
    const msg =
      `Sugiyama layouts are blocked for graphs with more than ${LARGE_GRAPH_NODE_THRESHOLD} nodes ` +
      `(this graph has ${currentGraph.nodeCountDeep}).`
    layoutSelect.value = 'ipsepCola'
    await updateRender(getSettings())
    showError(msg)
    return
  }
  updateRender(getSettings())
}

// Smooth-corners toggle
const smoothCornersCheckbox = <HTMLInputElement>document.getElementById('smoothCorners')
smoothCornersCheckbox.onchange = () => updateRender(getSettings())

// File drop / picker
dropZone('drop-target', async (f: File) => {
  try {
    const graph = await loadGraphFromFile(f)
    if (!graph) {
      showError('Failed to parse file: ' + f.name)
      return
    }
    await acceptGraph(graph)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    showError(`Failed to load file: ${msg}`)
  }
})

// URL input
async function loadFromUrlInput(url: string) {
  if (!url) return
  try {
    const graph = await loadGraphFromUrl(url)
    if (!graph) {
      showError('Failed to parse graph from URL: ' + url)
      return
    }
    await acceptGraph(graph)
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

// Support ?url=... query param for deep-linking to a specific graph.
{
  const params = new URLSearchParams(window.location.search)
  const linked = params.get('url')
  if (linked) urlInput.value = linked
}

// Default graph on first load.
;(async () => {
  try {
    const params = new URLSearchParams(window.location.search)
    const linked = params.get('url')
    const src = linked || defaultGraphUrl
    const graph = await loadGraphFromUrl(src)
    if (!graph) {
      showError('Failed to load default graph.')
      return
    }
    await acceptGraph(graph)
  } catch (e) {
    console.error('Default graph load failed:', e)
    showError('Failed to load default graph.')
  }
})()
