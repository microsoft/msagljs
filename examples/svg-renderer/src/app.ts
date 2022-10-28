import {dropZone} from './drag-n-drop'
import {LayoutOptions} from '@msagl/renderer'

import {EdgeRoutingMode, layoutIsCalculated, geometryIsCreated, GeomGraph} from 'msagl-js'

import {SAMPLE_DOT, ROUTING, LAYOUT, FONT} from './settings'
import {RendererSvg} from '@msagl/renderer'
import {loadGraphFromFile, loadGraphFromUrl} from './load-data'

const viewer = document.getElementById('viewer')

const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/fsm.gv'

const svgRenderer = new RendererSvg(viewer)
const dotFileSelect = createDotGraphsSelect()

window.addEventListener('contextmenu', (e) => {
  if (!svgRenderer.graph) return
  const geomGraph = GeomGraph.getGeom(svgRenderer.graph)
  if (!geomGraph) return
  const mousePosition = svgRenderer.screenToSource(e)
  // only react on the context menu inside of the graph bounding box
  if (geomGraph.boundingBox.contains(mousePosition)) {
    e.preventDefault()
    setPositionAndShow(e, contmenu)
  }
})

window.addEventListener('click', () => {
  toggleContextMenu(contmenu, 'hide')
})
/** setup the viewer */
viewer.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.ctrlKey) {
    switch (e.key.toLowerCase()) {
      case 'e':
        svgRenderer.LayoutEditingEnabled = !svgRenderer.LayoutEditingEnabled
        e.preventDefault()
        break
      case 'z':
        svgRenderer.undo()
        e.preventDefault()
        break
      case 'y':
        svgRenderer.redo()
        e.preventDefault()
        break
    }
  }
  if (e.key == 'Delete') {
    let first = true
    for (const v of svgRenderer.selectedEntities()) {
      if (first) {
        svgRenderer.createUndoPoint()
        first = false
      }
      svgRenderer.remove(v, true)
    }
  }
})

dotFileSelect.onchange = () => {
  const url = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/' + dotFileSelect.value
  loadGraphFromUrl(url)
    .then((graph) => {
      svgRenderer.setGraph(graph, getLayoutOptions())
      return graph.id
    })
    .then((id) => (document.getElementById('graph-name').innerText = id))
}

const contmenu = document.getElementById('contmenu')

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

function download(filename: string, text: string) {
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
  dotFileSelect.selectedIndex = -1
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
function setPositionAndShow(e: MouseEvent, contextmenu: HTMLElement) {
  contextmenu.style.left = `${e.pageX}px`
  contextmenu.style.top = `${e.pageY}px`
  toggleContextMenu(contextmenu, 'show')
}
function toggleContextMenu(contextmenu: HTMLElement, command: string) {
  if (command === 'show') {
    contextmenu.style.display = 'block'
  } else {
    contextmenu.style.display = 'none'
  }
}
