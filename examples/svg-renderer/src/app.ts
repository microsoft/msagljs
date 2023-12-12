import {dropZone} from './drag-n-drop'
import {RendererSvg} from '@msagl/renderer-svg'

import {EdgeRoutingMode, layoutIsCalculated, geometryIsCreated, Entity, GeomNode, Node, Graph} from '@msagl/core'

import {SAMPLE_DOT, ROUTING, LAYOUT, FONT} from './settings'

import {AttributeRegistry} from '@msagl/core'
import {DrawingNode, InsertionMode} from '@msagl/drawing'
import {loadGraphFromFile, loadGraphFromUrl} from '@msagl/parser'
import {LayoutOptions} from '@msagl/renderer-common'
import cytoscape from 'cytoscape';
import klay from 'cytoscape-klay';

cytoscape.use( klay );
const viewer = document.getElementById('viewer')
const cy = cytoscape({
  container: document.getElementById('cy'), // container to render in
});
viewer.setAttribute('style', 'touch-action: none;')
//const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/examples/data/gameofthrones.json'
const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/fsm.gv'
const svgRenderer = new RendererSvg(viewer)
const graphExamplesSelect = createDotGraphsSelect()
let objectWithEditedLabel: Entity
viewer.addEventListener('dblclick', (e) => {
  // to disable the double click zoom under panZoom of anvaka
  e.stopImmediatePropagation()
})

window.addEventListener('click', (e) => {
  if (e.target !== textedit && textedit.style.display === 'table-cell') {
    displayHideElement(textedit, 'hide')
    svgRenderer.layoutEditor.resizeLabel(textedit.innerText, objectWithEditedLabel)
    objectWithEditedLabel = null
  }
})

/** setup the viewer */
viewer.addEventListener('keydown', (e: KeyboardEvent) => {
  //console.log('svg keydown: ', e.key)
  if (e.ctrlKey) {
    switch (e.key.toLowerCase()) {
      case 'e':
        svgRenderer.layoutEditingEnabled = !svgRenderer.layoutEditingEnabled
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
      case 'i':
        if (svgRenderer.insertionMode != InsertionMode.Node) svgRenderer.insertionMode = InsertionMode.Node
        else svgRenderer.insertionMode = InsertionMode.Default

        e.preventDefault()
        break
      case 'd':
        if (svgRenderer.insertionMode != InsertionMode.Edge) svgRenderer.insertionMode = InsertionMode.Edge
        else svgRenderer.insertionMode = InsertionMode.Default

        e.preventDefault()
        break
    }
  } else if (e.key == 'Delete') {
    let first = true
    for (const v of svgRenderer.selectedEntities()) {
      if (first) {
        svgRenderer.createUndoPoint()
        first = false
      }
      svgRenderer.remove(v, true)
    }
  } else {
    if (svgRenderer.objectUnderMouseCursor != null) {
      editLabel(svgRenderer.objectUnderMouseCursor.entity, svgRenderer, textedit, e)
    }
  }
})

graphExamplesSelect.onchange = () => {
  const url = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/' + graphExamplesSelect.value
  loadGraphFromUrl(url)
    .then((graph) => {
      svgRenderer.setGraph(graph, getLayoutOptions())
      layoutGrapForCy(graph)
      return graph
    })
    .then(
      (graph) =>
        (document.getElementById('graph-name').innerText = graph.id + '(' + graph.nodeCountDeep + ',' + graph.deepEdgesCount + ')'),
    )
}

const textedit = document.getElementById('textedit')

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
      layoutGrapForCy(graph)
      return graph
    })
    .then(
      (graph) =>
        (document.getElementById('graph-name').innerText = graph.id + '(' + graph.nodeCountDeep + ',' + graph.deepEdgesCount + ')'),
    )
})
;(async () => {
  const graph = await loadGraphFromUrl(defaultGraph)
  svgRenderer.setOptions(getLayoutOptions())
  svgRenderer.setGraph(graph)
  layoutGrapForCy(graph)
  document.getElementById('graph-name').innerText = graph.id + '(' + graph.nodeCountDeep + ',' + graph.deepEdgesCount + ')'

})()

function layoutGrapForCy(graph: Graph) {
  let i = 0
  const nodes = Array.from(graph.nodesBreadthFirst).map(node => ({ data: { id: node.id } }))
  const edges = Array.from(graph.deepEdges).map(edge => ({ data: { id: 'e' + i++, source: edge.source.id, target: edge.target.id } }))

  // Add the elements to the cytoscape instance
  const elements = nodes.concat(edges)
  cy.add(elements)
  cy.layout({ name: 'klay' }).run()
}

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
  const graphExamples = <HTMLSelectElement>document.getElementById('gv')
  for (const name of SAMPLE_DOT) {
    const option = document.createElement('option')
    option.value = name
    option.innerText = name
    graphExamples.appendChild(option)
  }
  graphExamples.selectedIndex = -1
  return graphExamples
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
function setPositionAndShow(e: PointerEvent, elem: HTMLElement) {
  elem.style.left = `${e.pageX}px`
  elem.style.top = `${e.pageY}px`
  displayHideElement(elem, 'show')
}
function displayHideElement(elem: HTMLElement, command: string) {
  if (command === 'show') {
    elem.style.display = 'table-cell'
  } else {
    elem.style.display = 'none'
  }
}

function editLabel(entity: Entity, svgRenderer: RendererSvg, elem: HTMLElement, e: KeyboardEvent) {
  if (entity instanceof Node) {
    const gNode = entity.getAttr(AttributeRegistry.GeomObjectIndex) as GeomNode
    const m = svgRenderer.Transform
    const pos = m.multiplyPoint(gNode.boundingBox.leftTop)
    elem.style.left = `${pos.x}px`
    elem.style.top = `${pos.y}px`
    const dn = entity.getAttr(AttributeRegistry.DrawingObjectIndex) as DrawingNode
    elem.innerText = dn.labelText
    objectWithEditedLabel = entity
    displayHideElement(elem, 'show')
    e.stopImmediatePropagation()
  }
}
