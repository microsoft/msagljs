import {loadGraphFromFile, loadGraphFromUrl} from './load-data'
import {dropZone} from './drag-n-drop'
import {Renderer, SearchControl, RenderOptions} from '@msagl/renderer'

import {EdgeRoutingMode, LayerDirectionEnum} from 'msagl-js'

import {SAMPLE_DOT, ROUTING, LAYOUT, FONT} from './settings'
import {parseDot} from '@msagl/parser'

const DefaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/examples/data/gameofthrones.json'

const renderer = new Renderer(document.getElementById('viewer'))
renderer.addControl(new SearchControl())

// Dot file selector
const queryString = window.location.search
console.log(queryString)
const urlParams = new URLSearchParams(queryString)
const dotFileSelect = <HTMLSelectElement>document.getElementById('gv')
let url = dotFileSelect.title
if (urlParams.has('models')) url += '&models=' + urlParams.get('models')
else url += '&models=ModelY'
if (urlParams.has('design')) url += '&design=' + urlParams.get('design')
if (urlParams.has('variants')) url += '&variants=' + urlParams.get('variants')
console.log(url)

fetch(url)
  .then((resp) => resp.json())
  .then((data) => {
    let first: any
    for (const k in data) {
      const option = document.createElement('option')
      if (!first) {
        first = k
      }
      option.value = k
      option.text = k
      option.id = k
      option.data = data[k]
      dotFileSelect.appendChild(option)
      console.log(k)
    }

    return {id: first, data: data[first]}
  })

  .then((key_val) => {
    const graph = parseDot(key_val.data)
    renderer.setGraph(graph)
    document.getElementById('graph-name').innerText = key_val.id
  })
dotFileSelect.onchange = () => {
  const graphElem = dotFileSelect.options[dotFileSelect.selectedIndex]
  const dg = graphElem.data
  const graph = parseDot(dg)
  renderer.setGraph(graph, getSettings())
  document.getElementById('graph-name').innerText = graphElem.id
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
  renderer.setRenderOptions(getSettings())
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
  renderer.setRenderOptions(getSettings())
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
  renderer.setRenderOptions(getSettings())
}

// File selector
dropZone('drop-target', async (f: File) => {
  const graph = await loadGraphFromFile(f)
  renderer.setGraph(graph)
  document.getElementById('graph-name').innerText = graph.id
})
;(async () => {
  renderer.setRenderOptions(getSettings())

  // const graph = await loadGraphFromUrl(DefaultGraph)

  // renderer.setGraph(graph)
  // document.getElementById('graph-name').innerText = graph.id
})()

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
