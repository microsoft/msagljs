import {loadDefaultGraph, loadDotFile} from './load-data'
import {dropZone} from './drag-n-drop'
import {Renderer, SearchControl} from '@msagl/renderer'
import {DrawingGraph} from 'msagl-js/dist/drawing'
import {GeomGraph, EdgeRoutingMode, LayoutSettings, SugiyamaLayoutSettings} from 'msagl-js'
const renderer = new Renderer()
renderer.addControl(new SearchControl())
let drawingGraph: DrawingGraph
const dropDown = <HTMLSelectElement>document.getElementById('rs')
dropDown.onchange = routingChange

dropZone('drop-target', async (f: File) => {
  drawingGraph = await loadDotFile(f)
  renderer.setGraph(drawingGraph)
  document.getElementById('graph-name').innerText = drawingGraph.graph.id
})
;(async () => {
  drawingGraph = await loadDefaultGraph()

  renderer.setGraph(drawingGraph)
  document.getElementById('graph-name').innerText = drawingGraph.id
})()
function routingChange() {
  adjustLayoutSettings()
  renderer.setGraph(drawingGraph)
}

function adjustLayoutSettings(): LayoutSettings {
  const rstyle: string = getRoutingStyle()
  const settings = (<GeomGraph>GeomGraph.getGeom(drawingGraph.graph)).layoutSettings

  switch (rstyle) {
    case 'rectilinear':
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Rectilinear
      settings.edgeRoutingSettings.BundlingSettings = null
      settings.runRoutingOnly = true
      break
    case 'splines': {
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
      settings.edgeRoutingSettings.BundlingSettings = null
      settings.runRoutingOnly = true
      break
    }
    case 'bundles': {
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
      settings.runRoutingOnly = true
      break
    }
    case 'straight': {
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.StraightLine
      settings.edgeRoutingSettings.BundlingSettings = null
      settings.runRoutingOnly = true
      break
    }
    case 'default': {
      settings.edgeRoutingSettings.BundlingSettings = null

      if (settings instanceof SugiyamaLayoutSettings) {
        settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SugiyamaSplines
        settings.runRoutingOnly = false
      } else {
        settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
        settings.runRoutingOnly = true
      }

      break
    }
    case 'default':
      break
  }

  return settings
}
function getRoutingStyle(): string {
  return dropDown.options[dropDown.selectedIndex].value
}
