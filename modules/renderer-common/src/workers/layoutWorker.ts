import {parseJSON, graphToJSON} from '@msagl/parser'
import {DrawingGraph} from '@msagl/drawing'
import {layoutGraph} from '../layout'
import {GeomGraph, TileMap, serializeTileMap} from '@msagl/core'
import {Rectangle} from '@msagl/core'

export default function initLayoutWorker() {
  globalThis.onmessage = ({data}) => {
    switch (data.type) {
      case 'layout': {
        const graph = parseJSON(data.graph)

        console.debug('graph transfer to worker', Date.now() - data.timestamp + ' ms')
        //geometry has to be created before layout, and transfered to worker
        layoutGraph(graph, data.options, data.forceUpdate)
        console.debug('layout done', Date.now() - data.timestamp + ' ms')

        let tileMapDTO = null
        if (data.buildTiles) {
          try {
            const geomGraph = GeomGraph.getGeom(graph)
            const bb = geomGraph.boundingBox
            const rootTileSize = 2 ** Math.ceil(Math.log2(Math.max(bb.width, bb.height)))
            const rootTile = new Rectangle({
              left: bb.left - (rootTileSize - bb.width) / 2,
              bottom: bb.bottom - (rootTileSize - bb.height) / 2,
              right: bb.right + (rootTileSize - bb.width) / 2,
              top: bb.top + (rootTileSize - bb.height) / 2,
            })
            const tm = new TileMap(geomGraph, rootTile)
            tm.buildUpToLevel(data.maxLevels ?? 8)
            console.debug('tileMap built', Date.now() - data.timestamp + ' ms')
            tileMapDTO = serializeTileMap(tm, graph)
            console.debug('tileMap serialized', Date.now() - data.timestamp + ' ms')
          } catch (err) {
            // Fall back to sending graph without tileMap; main thread will
            // build it synchronously as before.
            console.error('worker tileMap build failed; falling back to main-thread build', err)
            tileMapDTO = null
          }
        }

        postMessage({
          type: 'layout-done',
          timestamp: Date.now(),
          graph: graphToJSON(graph),
          tileMap: tileMapDTO,
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
