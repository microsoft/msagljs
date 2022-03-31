import {loadDefaultGraph, loadDotFile} from './load-data'
import {dropZone} from './drag-n-drop'
import {Renderer, SearchControl} from '@msagl/renderer'
import {DrawingGraph} from 'msagl-js/dist/drawing'

const renderer = new Renderer()
renderer.addControl(new SearchControl())

dropZone('drop-target', async (f: File) => {
  const graph: DrawingGraph = await loadDotFile(f)
  renderer.setGraph(graph)
  document.getElementById('graph-name').innerText = graph.graph.id
})
;(async () => {
  const g = await loadDefaultGraph()
  renderer.setGraph(g)
  document.getElementById('graph-name').innerText = g.id
})()
