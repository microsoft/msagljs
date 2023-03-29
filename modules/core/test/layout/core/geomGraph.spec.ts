import {parseJSON} from '../../../../parser/src/jsonparser'
import {parseDot} from '../../../../parser/src/dotparser'
import * as fs from 'fs'
import * as path from 'path'
import {
  SugiyamaLayoutSettings,
  LayeredLayout,
  CancelToken,
  Size,
  GeomNode,
  Graph,
  Node,
  GeomGraph,
  Edge,
  buildRTree,
  intersectedObjects,
  AttributeRegistry,
  GeomEdge,
  Point,
  TileMap,
  GeomObject,
  LineSegment,
  Assert,
  Curve,
  SplineRouter,
  FastIncrementalLayoutSettings,
  CurveClip,
  MdsLayoutSettings,
} from '../../../src'
import {ArrowTypeEnum} from '../../../src/drawing/arrowTypeEnum'
import {DrawingGraph} from '../../../src/drawing/drawingGraph'
import {buildRTreeWithInterpolatedEdges, getGeomIntersectedObjects} from '../../../src/layout/core/geomGraph'
import {DebugCurve} from '../../../src/math/geometry/debugCurve'
import {initRandom} from '../../../src/utils/random'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'
import {nodeBoundaryFunc, parseDotGraph} from '../../utils/testUtils'
import {createGeometry} from '../mds/SingleSourceDistances.spec'
import {PivotMDS} from '../../../src/layout/mds/pivotMDS'
test('subgraphs', () => {
  const graph = new Graph()
  const graphA = new Graph('a')
  graphA.addNode(new Node('node_of_a'))
  graph.addNode(graphA)
  const graphB = new Graph('b')
  graph.addNode(graphB)
  const graphAA = new Graph('aa')
  graphA.addNode(graphAA)
  const aaIds = Array.from(graph.allSuccessorsDepthFirst()).map((a) => a.id)

  const node_of_aIndex = aaIds.findIndex((a) => a == 'node_of_a')
  const aaIndex = aaIds.findIndex((a) => a == 'aa')

  const bIndex = aaIds.findIndex((a) => a == 'b')
  expect(bIndex > aaIndex).toBe(true)
  expect(node_of_aIndex < aaIndex)
})

test('empty subgraphs', () => {
  const g = GeomGraph.mk('graph', new Size(20, 30))

  expect(g.shallowNodeCount).toBe(0)
})
test('geom subgraphs', () => {
  const graph = new Graph()
  const graphA = new Graph('a')
  graphA.addNode(new Node('node_of_a'))
  graph.addNode(graphA)
  const graphB = new Graph('b')
  graph.addNode(graphB)
  const graphAA = new Graph('aa')
  graphA.addNode(graphAA)
  const gg = createGeometry(graph, nodeBoundaryFunc, () => null)
  const aaIds = Array.from(gg.subgraphsDepthFirst).map((n) => (n as unknown as GeomNode).id)
  const node_of_aIndex = aaIds.findIndex((a) => a == 'node_of_a')
  expect(node_of_aIndex).toBe(-1)
  const aaIndex = aaIds.findIndex((a) => a == 'aa')

  const bIndex = aaIds.findIndex((a) => a == 'b')
  expect(bIndex > aaIndex).toBe(true)
})

test('buildRTreeWithInterpolatedEdges', () => {
  const g = parseDotGraph('graphvis/fsm.gv')
  const dg = DrawingGraph.getDrawingObj(g) as DrawingGraph
  //create an edge with the arrowhead at source
  const edge = Array.from(g.deepEdges)[0]
  edge.getAttr(AttributeRegistry.DrawingObjectIndex).arrowhead = ArrowTypeEnum.normal
  edge.getAttr(AttributeRegistry.DrawingObjectIndex).arrowtail = ArrowTypeEnum.normal
  const geomGraph = dg.createGeometry()
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(geomGraph, ss, new CancelToken())
  ll.run()
  //SvgDebugWriter.writeGeomGraph('./tmp/fsm.svg', geomGraph)
  initRandom(2) // to remove randomness further on
  const slack = 0.05
  const tree = buildRTreeWithInterpolatedEdges(g, slack)

  // centers are hit
  for (const n of g.nodesBreadthFirst) {
    const gn = n.getAttr(AttributeRegistry.GeomObjectIndex)
    let found = false
    for (const n of getGeomIntersectedObjects(tree, slack, gn.center)) {
      if (n === gn) found = true
    }
    expect(found).toBe(true)
  }

  // edges are hit
  for (const n of g.deepEdges) {
    const ge = n.getAttr(AttributeRegistry.GeomObjectIndex) as GeomEdge
    const t = Math.random()
    let found = false
    const hitItems: Array<GeomObject> = Array.from(
      getGeomIntersectedObjects(tree, slack, ge.curve.value(ge.curve.parStart * t + (1 - t) * ge.curve.parEnd)),
    )
    for (const n of hitItems) {
      if (n === ge) found = true
    }
    // if (found == false) {
    //   const p = ge.curve.value(ge.curve.parStart * t + (1 - t) * ge.curve.parEnd)
    //   const rect = Rectangle.mkSizeCenter(new Size(slack * 2), p)
    //   const hitItems: Array<HitTreeNodeType> = Array.from(tree.RootNode.AllHitItems(rect, null))
    //   /*const subHitItems = hitItems.filter((i) => i instanceof Entity == false) as Array<{edge: Edge; pp: PointPair}>

    //   const distances = subHitItems.map((a) => dist(p, a.pp.first, a.pp._second))

    //   SvgDebugWriter.dumpICurves(
    //     './tmp/debug.svg',
    //     [CurveFactory.mkCircle(5, p) as ICurve].concat(subHitItems.map((m) => LineSegment.mkPP(m.pp._first, m.pp._second))),
    //   )*/
    // }
    expect(found).toBe(true)
    // target arrowheads are hit
    if (ge.targetArrowhead) {
      found = false
      for (const n of getGeomIntersectedObjects(tree, slack, Point.middle(ge.curve.end, ge.targetArrowhead.tipPosition))) {
        if (n === ge) found = true
      }
      expect(found).toBe(true)
    }
    // source arrowheads are hit
    if (ge.sourceArrowhead) {
      found = false
      for (const n of getGeomIntersectedObjects(tree, slack, Point.middle(ge.curve.start, ge.sourceArrowhead.tipPosition))) {
        if (n === ge) found = true
      }
      expect(found).toBe(true)
    }
  }
  //labels are hit
  for (const n of g.deepEdges) {
    const ge = n.getAttr(AttributeRegistry.GeomObjectIndex) as GeomEdge
    const label = ge.label
    if (label == null) continue
    let found = false
    for (const n of getGeomIntersectedObjects(tree, slack, label.boundingBox.leftTop)) {
      if (n === ge.label) found = true
    }
    expect(found).toBe(true)
  }

  initRandom(0) // to remove randomness further on
})

test('intersectedEnities', () => {
  const g = parseDotGraph('graphvis/abstract.gv')
  const dg = DrawingGraph.getDrawingObj(g) as DrawingGraph
  const geomGraph = dg.createGeometry(() => new Size(20, 20))
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(geomGraph, ss, new CancelToken())
  ll.run()
  const rect = geomGraph.boundingBox
  const rtree = buildRTree(geomGraph.graph)
  const intersectedNodes = Array.from(intersectedObjects(rtree, rect))
  let n = 0 // the number of nodes that intersected the bounding box
  let e = 0 // the number of edges that intersected the bounding box
  for (const o of intersectedNodes) {
    if (o instanceof Node) {
      n++
    } else if (o instanceof Edge) {
      e++
    }
  }

  expect(n).toBe(Array.from(geomGraph.nodesBreadthFirst).length)
  expect(e).toBe(0)

  const intersectedNodesAndEdges = Array.from(intersectedObjects(rtree, rect, false)).filter((e) => e instanceof Edge)

  expect(intersectedNodesAndEdges.length).toBe(Array.from(geomGraph.deepEdges).length)
  for (const e of geomGraph.deepEdges) {
    const r = e.boundingBox
    const intersected_e = Array.from(intersectedObjects(rtree, r, false))
    expect(intersected_e.indexOf(e.edge)).toBeGreaterThan(-1)
    expect(intersected_e.indexOf(e.edge.source)).toBeGreaterThan(-1)
    expect(intersected_e.indexOf(e.edge.target)).toBeGreaterThan(-1)
  }
})

test('tiles gameofthrones', () => {
  // const fpath = path.join(__dirname, '../../../../../examples/data/gameofthrones.json')
  // const graphStr = fs.readFileSync(fpath, 'utf-8')

  // const json = JSON.parse(graphStr)
  // const graph = parseJSON(json)
  // const dg = graph.getAttr(AttributeRegistry.DrawingObjectIndex) as DrawingGraph
  // dg.createGeometry()
  // const geomGraph = graph.getAttr(AttributeRegistry.GeomObjectIndex) as GeomGraph
  // layoutGeomGraph(geomGraph)
  // geomGraph.pumpTheBoxToTheGraphWithMargins()

  // const t = graphToJSON(graph)
  // const content = JSON.stringify(t, null, 2)
  // const ws = fs.openSync('./tmp/got.JSON', 'w', 0o666)
  // fs.writeFileSync(ws, content)
  // fs.close(ws)

  const fpath = path.join(__dirname, '../../data/JSONfiles/got.JSON')
  const str = fs.readFileSync(fpath, 'utf-8')
  const json = JSON.parse(str)
  const graph = parseJSON(json)
  //Curve.dumper = SvgDebugWriter.dumpDebugCurves
  const geomGraph = graph.getAttr(AttributeRegistry.GeomObjectIndex) as GeomGraph
  geomGraph.layoutSettings = new FastIncrementalLayoutSettings()
  const sr = new SplineRouter(geomGraph, Array.from(geomGraph.deepEdges))
  sr.run()
  const ts = new TileMap(geomGraph, geomGraph.boundingBox)
  ts.buildUpToLevel(6)
  // dumpTiles(ts)
})

test('mds with length', () => {
  const dotString =
    'graph G {\n' +
    'run -- intr;\n' +
    'intr -- runbl;\n' +
    'runbl -- run;\n' +
    'run -- runmem;\n' +
    /* run -- kernel; */
    'kernel -- zombie;\n' +
    'kernel -- sleep;\n' +
    'kernel -- runmem;\n' +
    'sleep -- swap;\n' +
    'swap -- runswap;\n' +
    'runswap -- new;\n' +
    'runswap -- runmem;\n' +
    'new -- runmem;\n' +
    'sleep -- runmem;\n' +
    '}'
  const g = parseDot(dotString)
  const dg = DrawingGraph.getDrawingObj(g) as DrawingGraph
  const geomGraph = dg.createGeometry()
  geomGraph.layoutSettings = new MdsLayoutSettings()
  const pivotMds = new PivotMDS(geomGraph, null, (e) => length(e), geomGraph.layoutSettings as MdsLayoutSettings)
  pivotMds.run()
  const sr = new SplineRouter(geomGraph, Array.from(geomGraph.deepEdges))
  sr.run()

  function length(e: GeomEdge) {
    return nodeWeight(e.source) + nodeWeight(e.target)
  }
  function nodeWeight(node: GeomNode): number {
    if (node.id == 'sleep') {
      return 5
    }

    return 1
  }
  SvgDebugWriter.writeGeomGraph('./tmp/gra.svg', geomGraph)
})

test('tile abstract.dot', () => {
  const g = parseDotGraph('graphvis/abstract.gv')
  const dg = DrawingGraph.getDrawingObj(g) as DrawingGraph
  const geomGraph = dg.createGeometry(() => new Size(20, 20))
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(geomGraph, ss, new CancelToken())
  ll.run()
  const rect = geomGraph.boundingBox
  const tileMap = new TileMap(geomGraph, rect)
  tileMap.buildUpToLevel(6)

  //  dumpTiles(tileMap)
})
function dumpTiles(tileMap: TileMap) {
  for (let z = 0; ; z++) {
    const tilesOfLevel = Array.from(tileMap.getTilesOfLevel(z))
    if (tilesOfLevel.length == 0) {
      break
    }
    const ts = tilesOfLevel.filter(tileIsCool)
    for (const t of ts) {
      try {
        const cc = t.data.curveClips.filter(clipIsCool)

        SvgDebugWriter.dumpDebugCurves(
          './tmp/tile' + z + '-' + t.x + '-' + t.y + '.svg',
          cc
            .map((c) => DebugCurve.mkDebugCurveCI('Green', c.curve))
            .concat([DebugCurve.mkDebugCurveTWCI(100, 0.2, 'Black', t.data.rect.perimeter())])
            .concat(t.data.nodes.map((n) => DebugCurve.mkDebugCurveCI('Red', n.boundaryCurve)))
            .concat(t.data.arrowheads.map((t) => LineSegment.mkPP(t.base, t.tip)).map((l) => DebugCurve.mkDebugCurveWCI(1, 'Blue', l))),
        )
      } catch (Error) {
        console.log(Error.message)
      }
    }
  }
}

function clipIsCool(c: CurveClip) {
  return c.edge.source.id == 'NED' && c.edge.target.id == 'STEFFON'
}

function tileIsCool(t: {x: number; y: number; data: import('../../../src').TileData}): unknown {
  for (const c of t.data.curveClips) {
    if (clipIsCool(c)) return true
  }
  return false
}
// function isLegal(e: GeomEdge): boolean {
//   const c = e.curve
//   if (c instanceof Curve) {
//     for (let i = 0; i < c.segs.length - 1; i++) {
//       if (Point.closeDistEps(c.segs[i].end, c.segs[i + 1].start)) continue
//       Assert.assert(false)
//     }
//     return true
//   } else {
//     return true
//   }
// }
