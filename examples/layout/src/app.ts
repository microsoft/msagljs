import {loadDefaultGraph, loadDotFile} from './load-data'
import {dropZone} from './drag-n-drop'
import {Renderer, SearchControl} from '@msagl/renderer'
import {parseDotString} from 'msagl-js/drawing'
import {
  Graph,
  EdgeRoutingMode,
  SugiyamaLayoutSettings,
  LayerDirectionEnum,
  GeomGraph,
  layoutGeomGraph,
  routeEdges,
  MdsLayoutSettings,
} from 'msagl-js'
const renderer = new Renderer()
renderer.addControl(new SearchControl())
const edgeRoutingSelect = <HTMLSelectElement>document.getElementById('rs')
edgeRoutingSelect.onchange = routeEdgesOnChange

const dotFileSelect = <HTMLSelectElement>document.getElementById('gv')
dotFileSelect.onchange = gvChange

const layoutSelect = <HTMLSelectElement>document.getElementById('layout')
layoutSelect.onchange = layoutSettingsChange

dropZone('drop-target', async (f: File) => {
  const drawingGraph = await loadDotFile(f)
  renderer.setGraph(drawingGraph, adjustLayoutSettings)
  document.getElementById('graph-name').innerText = drawingGraph.graph.id
})
;(async () => {
  const drawingGraph = await loadDefaultGraph()

  renderer.setGraph(drawingGraph, adjustLayoutSettings)
  document.getElementById('graph-name').innerText = drawingGraph.id
})()

function routeEdgesOnChange() {
  const gg = <GeomGraph>GeomGraph.getGeom(renderer.drawingGraph.graph)
  const settings = gg.layoutSettings
  switch (getRoutingStyle()) {
    case 'rectilinear':
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Rectilinear
      settings.edgeRoutingSettings.BundlingSettings = null
      routeEdges(gg, Array.from(gg.deepEdges()), null)
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      renderer.setGraph(renderer.drawingGraph, () => {}, false) // false is to avoid the layout and routing
      break
    case 'splines': {
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
      settings.edgeRoutingSettings.BundlingSettings = null
      routeEdges(gg, Array.from(gg.deepEdges()), null)
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      renderer.setGraph(renderer.drawingGraph, () => {}, false) // false is to avoid the layout and routing
      break
    }
    case 'bundles': {
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
      break
    }
    case 'straight': {
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.StraightLine
      settings.edgeRoutingSettings.BundlingSettings = null
      break
    }
    case 'default': {
      if (settings instanceof SugiyamaLayoutSettings) {
        if (settings.edgeRoutingSettings.EdgeRoutingMode != EdgeRoutingMode.SugiyamaSplines) {
          settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SugiyamaSplines
          // unfortunately I cannot restart just the routing for the layered layout, since the info about the prerouting step is lost
          layoutGeomGraph(GeomGraph.getGeom(renderer.drawingGraph.graph), null)
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          renderer.setGraph(renderer.drawingGraph, () => {}, false) // false is to avoid the layout and routing
        }
      } else {
        if (settings.edgeRoutingSettings.EdgeRoutingMode != EdgeRoutingMode.Spline) {
          settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
          // here just rerouting is fine
          const gg = GeomGraph.getGeom(renderer.drawingGraph.graph)
          routeEdges(gg, Array.from(gg.deepEdges()), null)
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          renderer.setGraph(renderer.drawingGraph, () => {}, false) // false is to avoid the layout and routing
        }
      }
      break
    }
  }
}

function layoutSettingsChange() {
  const gg = GeomGraph.getGeom(renderer.drawingGraph.graph)

  for (const e of gg.deepEdges()) {
    e.curve = null // zero all edges to kick of the routing
  }
  renderer.setGraph(renderer.drawingGraph, adjustLayoutSettings)
}

function gvChange() {
  const fn = dotFileSelect.options[dotFileSelect.selectedIndex].value
  const fullName = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/' + fn
  fetch(fullName)
    .then((resp) => resp.text())
    .then((data) => {
      renderer.setGraph(parseDotString(data), adjustLayoutSettings)
    })
}

function adjustLayoutSettings(graph: Graph): void {
  const geomGraph = <GeomGraph>GeomGraph.getGeom(graph)
  const settings = geomGraph.layoutSettings
  const wasSS = settings instanceof SugiyamaLayoutSettings
  let ss: SugiyamaLayoutSettings
  switch (getLayout()) {
    case 'lr':
      if (!wasSS) {
        geomGraph.layoutSettings = ss = new SugiyamaLayoutSettings()
      } else {
        ss = <SugiyamaLayoutSettings>geomGraph.layoutSettings
      }
      ss.layerDirection = LayerDirectionEnum.LR
      break
    case 'rl':
      if (!wasSS) {
        geomGraph.layoutSettings = ss = new SugiyamaLayoutSettings()
      } else {
        ss = <SugiyamaLayoutSettings>geomGraph.layoutSettings
      }

      ss.layerDirection = LayerDirectionEnum.RL
      break
    case 'tb':
      if (!wasSS) {
        geomGraph.layoutSettings = ss = new SugiyamaLayoutSettings()
      } else {
        ss = <SugiyamaLayoutSettings>geomGraph.layoutSettings
      }

      ss.layerDirection = LayerDirectionEnum.TB
      break
    case 'bt':
      if (!wasSS) {
        geomGraph.layoutSettings = ss = new SugiyamaLayoutSettings()
      } else {
        ss = <SugiyamaLayoutSettings>geomGraph.layoutSettings
      }
      ss.layerDirection = LayerDirectionEnum.BT
      break
    case 'mds':
      if (wasSS) geomGraph.layoutSettings = new MdsLayoutSettings()
      break
    default:
      break
  }
  adjustRoutingSettings(graph)
}
function adjustRoutingSettings(graph: Graph) {
  const geomGraph = <GeomGraph>GeomGraph.getGeom(graph)
  const settings = geomGraph.layoutSettings
  switch (getRoutingStyle()) {
    case 'rectilinear':
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Rectilinear
      settings.edgeRoutingSettings.BundlingSettings = null
      break
    case 'splines': {
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
      settings.edgeRoutingSettings.BundlingSettings = null
      break
    }
    case 'bundles': {
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
      break
    }
    case 'straight': {
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.StraightLine
      settings.edgeRoutingSettings.BundlingSettings = null
      break
    }
    case 'default': {
      if (settings instanceof SugiyamaLayoutSettings) {
        settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SugiyamaSplines
      } else {
        settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
      }
      break
    }
  }
}

function getRoutingStyle(): string {
  return edgeRoutingSelect.options[edgeRoutingSelect.selectedIndex].value
}

function getLayout(): string {
  return layoutSelect.options[layoutSelect.selectedIndex].value
}
