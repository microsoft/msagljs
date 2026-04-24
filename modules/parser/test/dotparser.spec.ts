import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import {parseDot, loadGraphFromFile, loadGraphFromUrl} from '../src/dotparser'
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

test('loadGraphFromFile reads gzipped json', async () => {
  const sample = {
    nodes: [{id: 'a'}, {id: 'b'}, {id: 'c'}],
    edges: [{source: 'a', target: 'b'}, {source: 'b', target: 'c'}],
  }
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(sample), 'utf-8'))
  const file = new File([gz], 'sample.json.gz')
  const graph = await loadGraphFromFile(file)
  expect(graph).not.toBeNull()
  expect(graph.nodeCountDeep).toBe(3)
  expect(graph.deepEdgesCount).toBe(2)
  expect(graph.id).toBe('sample.json.gz')
})

test('loadGraphFromFile reads plain json', async () => {
  const sample = {nodes: [{id: 'x'}, {id: 'y'}], edges: [{source: 'x', target: 'y'}]}
  const file = new File([JSON.stringify(sample)], 'plain.json')
  const graph = await loadGraphFromFile(file)
  expect(graph.nodeCountDeep).toBe(2)
  expect(graph.deepEdgesCount).toBe(1)
})

test('loadGraphFromUrl reads gzipped json via data URL', async () => {
  const sample = {
    nodes: [{id: 'n1'}, {id: 'n2'}, {id: 'n3'}, {id: 'n4'}],
    edges: [{source: 'n1', target: 'n2'}, {source: 'n3', target: 'n4'}],
  }
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(sample), 'utf-8'))
  const b64 = Buffer.from(gz).toString('base64')
  // Fake a filename with .json.gz so the loader picks JSON + gzip paths.
  const origFetch = global.fetch
  global.fetch = (async (u: string) => {
    const resp = await origFetch(u)
    return resp
  }) as any
  // Use data: URL but ensure extension heuristic kicks in by appending #name=...
  // Since URL extension parsing uses slice after last '/', embed the file name in the path.
  // We serve the data via a mocked fetch keyed on a sentinel URL.
  const sentinel = 'http://example.invalid/fixture/graph.json.gz'
  global.fetch = (async (u: string) => {
    if (u === sentinel) {
      return new Response(gz, {status: 200, headers: {'content-type': 'application/gzip'}})
    }
    throw new Error('unexpected url ' + u)
  }) as any
  try {
    const graph = await loadGraphFromUrl(sentinel)
    expect(graph.nodeCountDeep).toBe(4)
    expect(graph.deepEdgesCount).toBe(2)
    expect(graph.id).toBe('graph.json.gz')
  } finally {
    global.fetch = origFetch
  }
  void b64
})

test('parseJSON handles JGF v1 (nodes as object, single "graph")', async () => {
  const jgf = {
    graph: {
      id: 'les_mis_sample',
      nodes: {
        Myriel: {label: 'Myriel'},
        Napoleon: {label: 'Napoleon'},
        Baptistine: {label: 'Baptistine'},
      },
      edges: [
        {source: 'Myriel', target: 'Napoleon'},
        {source: 'Myriel', target: 'Baptistine'},
      ],
    },
  }
  const file = new File([JSON.stringify(jgf)], 'jgf.json')
  const graph = await loadGraphFromFile(file)
  expect(graph.nodeCountDeep).toBe(3)
  expect(graph.deepEdgesCount).toBe(2)
})

test('parseJSON handles JGF v2 (nodes as array)', async () => {
  const jgf = {
    graph: {
      id: 'v2',
      directed: true,
      nodes: [{id: 'a'}, {id: 'b'}, {id: 'c'}],
      edges: [{source: 'a', target: 'b'}, {source: 'b', target: 'c'}],
    },
  }
  const file = new File([JSON.stringify(jgf)], 'jgf_v2.json')
  const graph = await loadGraphFromFile(file)
  expect(graph.nodeCountDeep).toBe(3)
  expect(graph.deepEdgesCount).toBe(2)
})

test('parseJSON handles JGF multi-graph document (first graph wins)', async () => {
  const jgf = {
    graphs: [
      {id: 'g1', nodes: [{id: 'x'}, {id: 'y'}], edges: [{source: 'x', target: 'y'}]},
      {id: 'g2', nodes: [{id: 'z'}], edges: []},
    ],
  }
  const file = new File([JSON.stringify(jgf)], 'multi.json')
  const graph = await loadGraphFromFile(file)
  expect(graph.nodeCountDeep).toBe(2)
  expect(graph.deepEdgesCount).toBe(1)
})
