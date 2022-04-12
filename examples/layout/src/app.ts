import {loadDefaultGraph, loadDotFile} from './load-data'
import {dropZone} from './drag-n-drop'
import {Renderer, SearchControl, RenderOptions} from '@msagl/renderer'
import {parseDotString} from 'msagl-js/drawing'

import {EdgeRoutingMode, LayerDirectionEnum} from 'msagl-js'

import {SAMPLE_DOT, ROUTING, LAYOUT, FONT} from './settings'

const renderer = new Renderer(document.getElementById('viewer'))
renderer.addControl(new SearchControl())

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
  fetch(url)
    .then((resp) => resp.text())
    .then((data) => {
      renderer.setGraph(parseDotString(data))
      document.getElementById('graph-name').innerText = dotFileSelect.value
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
  const drawingGraph = await loadDotFile(f)
  renderer.setGraph(drawingGraph)
  document.getElementById('graph-name').innerText = drawingGraph.graph.id
})
;(async () => {
  renderer.setRenderOptions(getSettings())

  const drawingGraph = await loadDefaultGraph()

  renderer.setGraph(drawingGraph)
  document.getElementById('graph-name').innerText = drawingGraph.graph.id
})()

function getSettings(): RenderOptions {
  const opts: RenderOptions = {
    label: {
      fontFamily: fontSelect.value,
    },
  }

  switch (layoutSelect.value) {
    case 'lr':
      opts.type = 'Sugiyama'
      opts.layerDirection = LayerDirectionEnum.LR
      break
    case 'rl':
      opts.type = 'Sugiyama'
      opts.layerDirection = LayerDirectionEnum.RL
      break
    case 'tb':
      opts.type = 'Sugiyama'
      opts.layerDirection = LayerDirectionEnum.TB
      break
    case 'bt':
      opts.type = 'Sugiyama'
      opts.layerDirection = LayerDirectionEnum.BT
      break
    case 'mds':
      opts.type = 'MDS'
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
