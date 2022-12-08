import {parseJSON, graphToJSON} from '@msagl/parser'
import {Arrowhead, GeomGraph, GeomLabel, Graph, ICurve, IntPairMap, Rectangle, Node, pageRank, Edge, GeomEdge, GeomNode} from 'msagl-js'
import {DrawingGraph} from 'msagl-js/drawing'

import {layoutGraph} from '../layout'

export default function initLayoutWorker() {
  globalThis.onmessage = ({data}) => {
    switch (data.type) {
      case 'layout': {
        const graph = parseJSON(data.graph)

        console.debug('graph transfer to worker', Date.now() - data.timestamp + ' ms')

        const drawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(graph) || new DrawingGraph(graph)
        // GeomEdge is missing without this step
        drawingGraph.createGeometry()
        layoutGraph(graph, data.options, data.forceUpdate)

        postMessage({
          type: 'layout-done',
          timestamp: Date.now(),
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
