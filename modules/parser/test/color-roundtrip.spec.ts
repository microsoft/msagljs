import {DrawingEdge, DrawingGraph, Color} from '@msagl/drawing'
import {graphToJSON, parseDot, parseJSON} from '../src/dotparser'
import {parseColor} from '../src/utils'

test('preserves node defaults and explicit colors through two JSON round trips', () => {
  let graph = parseDot(`digraph Colors {
    node [style=filled, fillcolor=lightblue, fontcolor=blue, color=green]
    a [fillcolor=red, fontcolor=purple, color=orange]
    b
    a -> b [color=gold, fontcolor=purple]
  }`)

  for (let transfer = 0; transfer < 2; transfer++) {
    graph = parseJSON(JSON.parse(JSON.stringify(graphToJSON(graph))))
    const drawing = DrawingGraph.getDrawingObj(graph) as DrawingGraph
    expect(drawing.findNode('a').fillColor).toEqual(Color.Red)
    expect(drawing.findNode('a').fontColor).toEqual(Color.Purple)
    expect(drawing.findNode('a').color).toEqual(Color.Orange)
    expect(drawing.findNode('b').fillColor).toEqual(Color.LightBlue)
    expect(drawing.findNode('b').fontColor).toEqual(Color.Blue)
    expect(drawing.findNode('b').color).toEqual(Color.Green)
    expect(drawing.defaultNodeObject.fillColor).toEqual(Color.LightBlue)
    expect(drawing.defaultNodeObject.fontColor).toEqual(Color.Blue)
    const edge = DrawingEdge.getDrawingObj(Array.from(graph.deepEdges)[0])
    expect(edge.color).toEqual(Color.Gold)
    expect(edge.fontColor).toEqual(Color.Purple)
  }
})

test('serializes fill and font colors using canonical DOT attribute names', () => {
  const graph = parseDot('digraph { a [fillcolor=red, fontcolor=blue] }')
  const json = graphToJSON(graph)
  expect(json.children).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: 'node_stmt',
        attr_list: expect.arrayContaining([
          {type: 'attr', id: 'fillcolor', eq: 'red'},
          {type: 'attr', id: 'fontcolor', eq: 'blue'},
        ]),
      }),
    ]),
  )
  expect(JSON.stringify(json)).not.toMatch(/"(?:fillColor|fontColor)"/)
})

test('loads colors from JSON exported with legacy camel-case attribute names', () => {
  const graph = parseJSON({
    type: 'digraph',
    id: 'Colors',
    children: [
      {
        type: 'node_stmt',
        node_id: {type: 'node_id', id: 'a'},
        attr_list: [
          {type: 'attr', id: 'fillColor', eq: 'red'},
          {type: 'attr', id: 'fontColor', eq: 'blue'},
        ],
      },
    ],
  })
  const drawing = DrawingGraph.getDrawingObj(graph) as DrawingGraph
  expect(drawing.findNode('a').fillColor).toEqual(Color.Red)
  expect(drawing.findNode('a').fontColor).toEqual(Color.Blue)
})

test.each(['#123456', '#12345678', '#12345600', 'rgba(255, 0, 0, 0.5)'])('preserves %s in defaults and JSON round trips', (value) => {
  let graph = parseDot(`digraph {
    node [color="${value}", fillcolor="${value}", fontcolor="${value}"]
    a -> b [color="${value}", fontcolor="${value}", labelfontcolor="${value}"]
  }`)
  const expected = parseColor(value)
  for (let transfer = 0; transfer < 3; transfer++) {
    const drawing = DrawingGraph.getDrawingObj(graph) as DrawingGraph
    expect(drawing.findNode('a').color).toEqual(expected)
    expect(drawing.findNode('a').fillColor).toEqual(expected)
    expect(drawing.findNode('a').fontColor).toEqual(expected)
    const edge = DrawingEdge.getDrawingObj(Array.from(graph.deepEdges)[0]) as DrawingEdge
    expect(edge.color).toEqual(expected)
    expect(edge.fontColor).toEqual(expected)
    expect(edge.labelfontcolor).toEqual(expected)
    expect(edge.clone().color).toEqual(expected)
    expect(edge.clone().fontColor).toEqual(expected)
    expect(edge.clone().labelfontcolor).toEqual(expected)
    if (transfer < 2) graph = parseJSON(JSON.parse(JSON.stringify(graphToJSON(graph))))
  }
})

test.each([
  ['blue', 'black'],
  ['black', 'red'],
])('preserves black colors with %s defaults and %s overrides', (defaultColor, overrideColor) => {
  let graph = parseDot(`digraph {
    node [color=${defaultColor}, fontcolor=${defaultColor}, pencolor=${defaultColor}]
    a [color=${overrideColor}, fontcolor=${overrideColor}, pencolor=${overrideColor}]
    b
  }`)
  for (let transfer = 0; transfer < 3; transfer++) {
    const drawing = DrawingGraph.getDrawingObj(graph) as DrawingGraph
    expect(drawing.findNode('a').color).toEqual(Color.parse(overrideColor))
    expect(drawing.findNode('a').fontColor).toEqual(Color.parse(overrideColor))
    expect(drawing.findNode('a').pencolor).toEqual(Color.parse(overrideColor))
    expect(drawing.findNode('b').color).toEqual(Color.parse(defaultColor))
    expect(drawing.findNode('b').fontColor).toEqual(Color.parse(defaultColor))
    expect(drawing.findNode('b').pencolor).toEqual(Color.parse(defaultColor))
    if (transfer < 2) graph = parseJSON(JSON.parse(JSON.stringify(graphToJSON(graph))))
  }
})
