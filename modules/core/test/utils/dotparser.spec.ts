import {join} from 'path'
import {parseDotString, DrawingNode} from '../../src/drawing'
import {Color} from '../../src/drawing/color'
import {sortedList} from '../layout/sortedBySizeListOfgvFiles'
import {parseDotGraph} from './testUtils'

test('all gv files list ', () => {
  const path = 'graphvis/'
  for (const f of sortedList) {
    try {
      parseDotGraph(join(path, f))
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
  const drawingGraph = parseDotString(dotString)
  expect(drawingGraph != null).toBe(true)
  const ddNode: DrawingNode = drawingGraph.findNode('ddddddd')
  expect(ddNode != null).toBe(true)
  expect(ddNode.node.id).toBe('ddddddd')
  expect(Color.equal(ddNode.color, Color.Orange)).toBe(true)
})
