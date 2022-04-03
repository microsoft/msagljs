import {loadDefaultGraph, loadDotFile} from './load-data'
import {dropZone} from './drag-n-drop'
import {Renderer, SearchControl} from '@msagl/renderer'
import {parseDotString} from 'msagl-js/drawing'
import {GeomGraph, EdgeRoutingMode, LayoutSettings, SugiyamaLayoutSettings} from 'msagl-js'
const renderer = new Renderer()
renderer.addControl(new SearchControl())
const edgeRoutingSelect = <HTMLSelectElement>document.getElementById('rs')
edgeRoutingSelect.onchange = routingChange

const dotFileSelect = <HTMLSelectElement>document.getElementById('gv')
dotFileSelect.onchange = gvChange

dropZone('drop-target', async (f: File) => {
  const drawingGraph = await loadDotFile(f)
  renderer.setGraph(drawingGraph)
  document.getElementById('graph-name').innerText = drawingGraph.graph.id
})
;(async () => {
  const drawingGraph = await loadDefaultGraph()

  renderer.setGraph(drawingGraph)
  document.getElementById('graph-name').innerText = drawingGraph.id
})()
function routingChange() {
  adjustLayoutSettings()
  renderer.setGraph()
}

function gvChange() {
  const fn = dotFileSelect.options[dotFileSelect.selectedIndex].value
  const fullName = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/' + fn
  fetch(fullName)
    .then((resp) => resp.text())
    .then((data) => {
      renderer.setGraph(parseDotString(data))
    })
}

function adjustLayoutSettings(): LayoutSettings {
  const rstyle: string = getRoutingStyle()
  const settings = (<GeomGraph>GeomGraph.getGeom(renderer.drawingGraph.graph)).layoutSettings

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
  return edgeRoutingSelect.options[edgeRoutingSelect.selectedIndex].value
}
