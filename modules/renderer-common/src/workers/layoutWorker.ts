import {parseJSON, graphToJSON} from '@msagl/parser'
import {DrawingGraph} from '@msagl/drawing'
import {layoutGraph} from '../layout'

export default function initLayoutWorker() {
  globalThis.onmessage = ({data}) => {
    switch (data.type) {
      case 'layout': {
        const graph = parseJSON(data.graph)

        console.debug('graph transfer to worker', Date.now() - data.timestamp + ' ms')
        //geometry has to be created before layout, and transfered to worker
        layoutGraph(graph, data.options, data.forceUpdate)
        console.debug('layout done', Date.now() - data.timestamp + ' ms')
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
