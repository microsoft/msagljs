import {Accessor, Color as DeckColor} from '@deck.gl/core/typed'
import {IconLayer, TextLayer} from '@deck.gl/layers/typed'
import {CurveClip, Edge, GeomGraph, GeomNode, Graph, LineSegment, Node, Point} from '@msagl/core'
import {Color, DrawingEdge, DrawingGraph, DrawingNode} from '@msagl/drawing'
import {getArrowHeadLayer, getEdgeLayer} from '../src/layers/get-edge-layers'
import {getNodeLayers} from '../src/layers/get-node-layers'
import CurveLayer from '../src/layers/curve-layer'
import GeometryLayer from '../src/layers/geometry-layer'
import GraphStyleExtension from '../src/layers/graph-style-extension'
import {ParsedGraphEdgeLayerStyle, ParsedGraphNodeLayerStyle} from '../src/styles/graph-style-evaluator'

// Layer accessors can be tested without a browser canvas or a WebGL context.
jest.mock('../src/layers/arrows', () => ({iconMapping: {}, getIconAtlas: jest.fn()}))
jest.mock('@mapbox/tiny-sdf', () => jest.fn())

const nodeStyle: ParsedGraphNodeLayerStyle = {
  id: 'nodes',
  type: 'node',
  filter: null,
  visible: true,
  minZoom: -Infinity,
  maxZoom: Infinity,
  size: null,
  opacity: null,
  fillColor: null,
  strokeWidth: null,
  strokeColor: null,
  labelSize: null,
  labelColor: null,
}

const edgeStyle: ParsedGraphEdgeLayerStyle = {
  id: 'edges',
  type: 'edge',
  filter: null,
  visible: true,
  minZoom: -Infinity,
  maxZoom: Infinity,
  opacity: null,
  strokeWidth: null,
  strokeColor: null,
  arrowSize: null,
  arrowColor: null,
  labelSize: null,
  labelColor: null,
}

function readColor<T>(accessor: Accessor<T, DeckColor>, datum: T): DeckColor {
  return typeof accessor === 'function' ? accessor(datum, {index: 0, data: [datum], target: []}) : accessor
}

function nodeLayers(node: Node, style = nodeStyle): [GeometryLayer<GeomNode>, TextLayer<GeomNode>] {
  const geom = node instanceof Graph ? new GeomGraph(node) : new GeomNode(node)
  return getNodeLayers({id: 'test', data: [geom], textColor: [0, 0, 0], textSizeScale: 1}, style) as [
    GeometryLayer<GeomNode>,
    TextLayer<GeomNode>,
  ]
}

function curveClip(edges: Edge[]): CurveClip {
  return {edges, curve: new LineSegment(0, 0, 10, 0), startPar: 0, endPar: 1}
}

test('uses independent DOT colors for node fill, outline, and label', () => {
  const node = new Node('a')
  const drawing = new DrawingNode(node)
  drawing.fillColor = Color.Red
  drawing.color = Color.Green
  drawing.fontColor = Color.Blue
  drawing.pencolor = Color.Purple
  const [boundary, label] = nodeLayers(node)
  const geom = GeomNode.getGeom(node)
  expect(readColor(boundary.props.getFillColor, geom)).toEqual([255, 0, 0, 255])
  expect(readColor(boundary.props.getLineColor, geom)).toEqual([0, 128, 0, 255])
  expect(readColor(label.props.getColor, geom)).toEqual([0, 0, 255, 255])
})

test('preserves the alpha channel of explicit node colors', () => {
  const node = new Node('a')
  const drawing = new DrawingNode(node)
  drawing.fillColor = new Color(40, 10, 20, 30)
  drawing.color = new Color(80, 50, 60, 70)
  drawing.fontColor = new Color(120, 90, 100, 110)
  const [boundary, label] = nodeLayers(node)
  const geom = GeomNode.getGeom(node)
  expect(readColor(boundary.props.getFillColor, geom)).toEqual([10, 20, 30, 40])
  expect(readColor(boundary.props.getLineColor, geom)).toEqual([50, 60, 70, 80])
  expect(readColor(label.props.getColor, geom)).toEqual([90, 100, 110, 120])
})

test('keeps the default node colors when DOT colors are absent', () => {
  const node = new Node('a')
  new DrawingNode(node)
  const [boundary, label] = nodeLayers(node)
  const geom = GeomNode.getGeom(node)
  expect(readColor(boundary.props.getFillColor, geom)).toEqual([255, 255, 255, 255])
  expect(readColor(boundary.props.getLineColor, geom)).toEqual([0, 0, 0, 60])
  expect(readColor(label.props.getColor, geom)).toEqual([0, 0, 0, 255])
})

test('retains pencolor as an outline fallback without coloring the label', () => {
  const node = new Node('a')
  const drawing = new DrawingNode(node)
  drawing.pencolor = Color.Purple
  const [boundary, label] = nodeLayers(node)
  const geom = GeomNode.getGeom(node)
  expect(readColor(boundary.props.getLineColor, geom)).toEqual([128, 0, 128, 255])
  expect(readColor(label.props.getColor, geom)).toEqual([0, 0, 0, 255])
})

test('retains pencolor precedence over color for cluster outlines', () => {
  const cluster = new Graph('cluster_a')
  const drawing = new DrawingGraph(cluster)
  drawing.color = Color.Green
  drawing.pencolor = Color.Purple
  const [boundary] = nodeLayers(cluster)
  expect(readColor(boundary.props.getLineColor, GeomNode.getGeom(cluster))).toEqual([128, 0, 128, 255])
})

test('uses the same explicit color and alpha for edge curves and arrowheads', () => {
  const edge = new Edge(new Node('a'), new Node('b'))
  const drawing = new DrawingEdge(edge, true)
  drawing.color = new Color(120, 255, 165, 0)
  const clip = curveClip([edge])
  const curve = getEdgeLayer({id: 'test', data: [clip]}, edgeStyle) as CurveLayer<CurveClip>
  const arrow = {edge, tip: new Point(10, 0), base: new Point(9, 0)}
  const arrowLayer = getArrowHeadLayer({id: 'test', data: [arrow]}, edgeStyle) as IconLayer<typeof arrow>
  expect(readColor(curve.props.getColor, clip)).toEqual([255, 165, 0, 120])
  expect(readColor(arrowLayer.props.getColor, arrow)).toEqual([255, 165, 0, 120])
})

test('keeps unstyled edge curves translucent black, including empty clips', () => {
  const edge = new Edge(new Node('a'), new Node('b'))
  new DrawingEdge(edge, true)
  const clip = curveClip([edge])
  const curve = getEdgeLayer({id: 'test', data: [clip]}, edgeStyle) as CurveLayer<CurveClip>
  expect(readColor(curve.props.getColor, clip)).toEqual([0, 0, 0, 160])
  expect(readColor(curve.props.getColor, curveClip([]))).toEqual([0, 0, 0, 160])
})

test('uses the first edge as the color representative of a bundled curve', () => {
  const first = new Edge(new Node('a'), new Node('b'))
  const second = new Edge(new Node('c'), new Node('d'))
  new DrawingEdge(first, true).color = Color.Orange
  new DrawingEdge(second, true).color = Color.Purple
  const clip = curveClip([first, second])
  const curve = getEdgeLayer({id: 'test', data: [clip]}, edgeStyle) as CurveLayer<CurveClip>
  expect(readColor(curve.props.getColor, clip)).toEqual([255, 165, 0, 255])
})

test('keeps graph-style color overrides available on the layers', () => {
  const node = new Node('a')
  new DrawingNode(node)
  const override = [10, 20, 30, 255]
  const [boundary, label] = nodeLayers(node, {...nodeStyle, fillColor: override, strokeColor: override, labelColor: override})
  const boundaryExtension = boundary.props.extensions[0] as GraphStyleExtension
  const labelExtension = label.props.extensions[0] as GraphStyleExtension
  expect(boundaryExtension.opts.overrideProps.getFillColor).toEqual(override)
  expect(boundaryExtension.opts.overrideProps.getLineColor).toEqual(override)
  expect(labelExtension.opts.overrideProps.getColor).toEqual(override)
  const curve = getEdgeLayer({id: 'test', data: []}, {...edgeStyle, strokeColor: override})
  const curveExtension = curve.props.extensions[0] as GraphStyleExtension
  expect(curveExtension.opts.overrideProps.getColor).toEqual(override)
})
