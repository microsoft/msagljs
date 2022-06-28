import {dropZone} from './drag-n-drop'
import {LayoutOptions} from '@msagl/renderer'
import {parseDot, parseSimpleJSON} from '@msagl/parser'

import {EdgeRoutingMode, layoutIsCalculated, geometryIsCreated, Graph} from 'msagl-js'

import {SAMPLE_DOT, ROUTING, LAYOUT, FONT} from './settings'
import {RendererSvg} from '@msagl/renderer'
import {parseJSON} from '@msagl/parser'

const viewer = document.getElementById('viewer')
const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/smlred.gv'

const svgRenderer = new RendererSvg(viewer)
const dotFileSelect = createDotGraphsSelect()
dotFileSelect.onchange = () => {
  const url = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/' + dotFileSelect.value
  loadGraphFromUrl(url)
    .then((graph) => {
      svgRenderer.setGraph(graph, getLayoutOptions())
      return graph.id
    })
    .then((id) => (document.getElementById('graph-name').innerText = id))
}

const edgeRoutingSelect = createEdgeRoutingSelect()
edgeRoutingSelect.onchange = () => {
  svgRenderer.setOptions(getLayoutOptions())
}

const layoutSelect = createLayoutSelect()
layoutSelect.onchange = () => {
  svgRenderer.setOptions(getLayoutOptions())
}

const fontSelect = createFontSelect()
fontSelect.onchange = () => {
  svgRenderer.setOptions(getLayoutOptions())
}

const svgSaveDiv = document.getElementById('save-svg')
svgSaveDiv.onclick = () => {
  const svgString = svgRenderer.getSvgString()
  download(svgRenderer.graph.id + '.svg', svgString)
}

const jsonSaveDiv = document.getElementById('save-JSON')
jsonSaveDiv.onclick = () => {
  const jsonString = svgRenderer.getJSONString()
  download(svgRenderer.graph.id + '.JSON', jsonString)
}

function download(filename, text) {
  const element = document.createElement('a')
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
  element.setAttribute('download', filename)

  element.style.display = 'none'
  document.body.appendChild(element)

  element.click()

  document.body.removeChild(element)
}
// File selector
dropZone('drop-target', async (f: File) => {
  loadGraphFromFile(f)
    .then((graph) => {
      if (geometryIsCreated(graph)) {
        svgRenderer.needCreateGeometry = false
        if (layoutIsCalculated(graph)) {
          svgRenderer.needCalculateLayout = false
        }
      }
      svgRenderer.setGraph(graph, getLayoutOptions())
      return graph.id
    })
    .then((id) => (document.getElementById('graph-name').innerText = id))
})
;(async () => {
  const graph = await loadGraphFromUrl(defaultGraph)
  svgRenderer.setOptions(getLayoutOptions())
  svgRenderer.setGraph(graph)
  document.getElementById('graph-name').innerText = graph.id
})()

function createFontSelect() {
  const fontSelect = <HTMLSelectElement>document.getElementById('fonts')
  for (const f of FONT) {
    const option = document.createElement('option')
    option.value = f
    option.innerText = f
    option.style.fontFamily = f
    fontSelect.appendChild(option)
  }
  return fontSelect
}

function createLayoutSelect() {
  const layoutSelect = <HTMLSelectElement>document.getElementById('layouts')
  for (const l in LAYOUT) {
    const option = document.createElement('option')
    option.value = l
    option.innerText = LAYOUT[l]
    layoutSelect.appendChild(option)
  }
  return layoutSelect
}

function createEdgeRoutingSelect() {
  const edgeRoutingSelect = <HTMLSelectElement>document.getElementById('routings')
  for (const r in ROUTING) {
    const option = document.createElement('option')
    option.value = r
    option.innerText = ROUTING[r]
    edgeRoutingSelect.appendChild(option)
  }
  return edgeRoutingSelect
}

function createDotGraphsSelect() {
  const dotFileSelect = <HTMLSelectElement>document.getElementById('gv')
  for (const name of SAMPLE_DOT) {
    const option = document.createElement('option')
    option.value = `${name}.gv`
    option.innerText = name
    dotFileSelect.appendChild(option)
  }
  return dotFileSelect
}

function getLayoutOptions(): LayoutOptions {
  const opts: LayoutOptions = {
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

  if (file.name.toLowerCase().endsWith('.json')) {
    graph = parseJSON(content) ?? parseSimpleJSON(JSON.parse(content))
  } else {
    graph = parseDot(content)
  }

  graph.id = file.name
  return graph
}
