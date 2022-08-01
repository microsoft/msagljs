import {parseJSON, graphToJSON} from '@msagl/parser'
import {GeomGraph} from 'msagl-js'
import {DrawingGraph} from 'msagl-js/drawing'

import {layoutGraph} from '../layout'

export default function initLayoutWorker() {
  globalThis.onmessage = ({data}) => {
    switch (data.command) {
      case 'layout': {
        const graph = parseJSON(data.graph)

        const drawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(graph) || new DrawingGraph(graph)
        drawingGraph.createGeometry()

        layoutGraph(graph, data.options, data.forceUpdate)
        console.debug('[worker] layout completed', new Date().toJSON().slice(11))

        postMessage({
          type: 'layout-done',
          graph: graphToJSON(graph),
        })
      }
    }
  }

  globalThis.onerror = (e) => {
    postMessage({
      type: 'Error',
      message: e.toString(),
    })
  }
}
