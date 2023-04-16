import * as fs from 'fs'
import * as path from 'path'
import {parseDot} from '../src/dotparser'
import {sortedList} from '../../core/test/layout/sortedBySizeListOfgvFiles'

import {AttributeRegistry} from '../../core/src/structs/attributeRegistry'
import {DrawingGraph, DrawingNode, Color, DrawingEdge} from '../../drawing/src'
function parseDotGraph(fileName: string, absolutePath = false): DrawingGraph {
  try {
    const fpath = absolutePath ? fileName : path.resolve(__dirname, '../../core/test/data', fileName)
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
    'd [fontcolor=yellow, fillcolor=blue, color=orange]\n' +
    'subgraph clusterA {\n' +
    '  style=filled\n' +
    '  fillcolor=lightgray\n' +
    'pencolor=blue\n' +
    'e [peripheries=3, fontcolor=red, color=yellow]\n' +
    'e -> ee\n' +
    '}\n' +
    'd -> e [labelfontcolor=chocolate, headlabel=headlabel, label=flue, fontcolor=green, color=lightblue]\n' +
    '}'
  const graph = parseDot(dotString)
  expect(graph != null).toBe(true)
  //@ts-ignore
  const drawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  const ddNode: DrawingNode = drawingGraph.findNode('d')
  expect(ddNode != null).toBe(true)
  expect(ddNode.node.id).toBe('d')
  expect(Color.equal(ddNode.color, Color.Orange)).toBe(true)
  for (const e of graph.deepEdges) {
    const de = e.getAttr(AttributeRegistry.DrawingObjectIndex) as DrawingEdge
    if (de.labelText && de.labelText.length > 0) {
      expect(e.label != null).toBe(true)
    }
  }
})
