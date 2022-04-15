import * as fs from 'fs'
import * as path from 'path'
import {parseDot} from '../src/dotparser'
import {Color, DrawingNode, DrawingGraph} from '../../core/src/drawing'
import {sortedList} from '../../core/test/layout/sortedBySizeListOfgvFiles'

function parseDotGraph(fileName: string, absolutePath = false): DrawingGraph {
  try {
    const fpath = absolutePath ? fileName : path.resolve(__dirname, '../data', fileName)
    const graphStr = fs.readFileSync(fpath, 'utf-8')
    const graph = parseDot(graphStr)
    return <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  } catch (Error) {
    // console.log('file = ' + fileName + ' error:' + Error.message)
    return null
  }
}

test('all gv files list ', () => {
  for (const f of sortedList) {
    try {
      parseDotGraph(path.join('graphvis/', f))
    } catch (Error) {
      console.log('Cannot parse file = ' + f + ' error:' + Error.message)
    }
  }
})

test('pack gv', () => {
  const g = parseDotGraph('graphvis/pack.gv')
  expect(g == null).toBe(false)
})

test('dot parser', () => {
  const g = parseDotGraph('graphvis/clust4.gv')
  expect(g == null).toBe(false)
})

test('parse with colors ', () => {
  const dotString =
    'digraph G {\n' +
    'node [style=filled, shape=box]\n' +
    'ddddddd [fontcolor=yellow, fillcolor=blue, color=orange]\n' +
    'subgraph clusterA {\n' +
    '  style=filled\n' +
    '  fillcolor=lightgray\n' +
    'pencolor=blue\n' +
    'eeeee [peripheries=3, fontcolor=red, color=yellow]\n' +
    'eeeee -> ee\n' +
    '}\n' +
    'ddddddd -> eeeee [labelfontcolor=chocolate, headlabel=headlabel, label=flue, fontcolor=green, color=lightblue]\n' +
    '}'
  const graph = parseDot(dotString)
  expect(graph != null).toBe(true)
  const drawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  const ddNode: DrawingNode = drawingGraph.findNode('ddddddd')
  expect(ddNode != null).toBe(true)
  expect(ddNode.node.id).toBe('ddddddd')
  expect(Color.equal(ddNode.color, Color.Orange)).toBe(true)
})
