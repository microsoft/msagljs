//import {loadGraphFromFile, loadGraphFromUrl} from './load-data'

import {dropZone} from './drag-n-drop'
import {Renderer, SearchControl, RenderOptions} from '@msagl/renderer'
import {parseDot, parseJSON} from '@msagl/parser'

import {EdgeRoutingMode, Graph, ICurve, Point} from 'msagl-js'

import {SAMPLE_DOT, ROUTING, LAYOUT, FONT} from './settings'
import {Color} from 'msagl-js/drawing'
import {Curve, LineSegment, Polyline} from '../../../modules/core/src/math/geometry'
import {BezierSeg} from '../../../modules/core/src/math/geometry/bezierSeg'
import {Ellipse} from '../../../modules/core/src/math/geometry/ellipse'
import {SvgRenderer} from './SvgCreator'

const viewer = document.getElementById('viewer')
const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/cairo.gv'

const svgCreator = new SvgRenderer()
// Dot file selector
const dotFileSelect = <HTMLSelectElement>document.getElementById('gv')
for (const name of SAMPLE_DOT) {
  const option = document.createElement('option')
  option.value = `${name}.gv`
  option.innerText = name
  dotFileSelect.appendChild(option)
}
dotFileSelect.onchange = () => {
  const url = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/' + dotFileSelect.value
  loadGraphFromUrl(url)
    .then((graph) => {
      return {svg_node: svgCreator.setGraph(graph, getSettings()), id: graph.id}
    })
    .then((p) => {
      viewer.removeChild(viewer.lastChild)
      viewer.appendChild(p.svg_node)
      return p.id
    })
    .then((id) => (document.getElementById('graph-name').innerText = id))
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
  //  renderer.setRenderOptions(getSettings())
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
  //renderer.setRenderOptions(getSettings())
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
  //renderer.setRenderOptions(getSettings())
}

// File selector
dropZone('drop-target', async (f: File) => {
  loadGraphFromFile(f)
    .then((graph) => {
      return {svg_node: svgCreator.setGraph(graph, getSettings()), id: graph.id}
    })
    .then((p) => {
      viewer.removeChild(viewer.lastChild)
      viewer.appendChild(p.svg_node)
      return p.id
    })
    .then((id) => (document.getElementById('graph-name').innerText = id))
})
;(async () => {
  //renderer.setRenderOptions(getSettings())
  const graph = await loadGraphFromUrl(defaultGraph)
  clearViewer()
  viewer.appendChild(svgCreator.setGraph(graph, getSettings()))
  document.getElementById('graph-name').innerText = graph.id
})()

function clearViewer() {
  while (viewer.childNodes.length > 1) viewer.removeChild(viewer.firstChild)
}

function getSettings(): RenderOptions {
  const opts: RenderOptions = {
    label: {
      fontFamily: fontSelect.value,
    },
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
async function loadGraphFromUrl(url: string): Promise<Graph> {
  const fileName = url.slice(url.lastIndexOf('/') + 1)
  const resp = await fetch(url)
  let graph: Graph

  if (fileName.endsWith('.json')) {
    const json = await resp.json()
    graph = parseJSON(json)
  } else {
    const content = await resp.text()
    graph = parseDot(content)
  }

  graph.id = fileName
  return graph
}
async function loadGraphFromFile(file: File): Promise<Graph> {
  const content: string = await file.text()
  let graph: Graph

  if (file.name.endsWith('.json')) {
    graph = parseJSON(JSON.parse(content))
  } else {
    graph = parseDot(content)
  }

  graph.id = file.name
  return graph
}
