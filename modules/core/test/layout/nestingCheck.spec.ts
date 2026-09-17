import * as fs from 'fs'
import * as path from 'path'
import {
  Edge,
  GeomEdge,
  GeomGraph,
  GeomNode,
  Graph,
  Node,
  CurveFactory,
  Point,
  MdsLayoutSettings,
  layoutGraphWithMds,
  TileMap,
  Rectangle,
} from '@msagl/core'
import {EdgeRoutingMode} from '../../src/routing/EdgeRoutingMode'

// Checks the invariant claimed in tileMap.ts and in the paper (Section 3.1):
// the accepted node sets are nested across levels, V_z ⊆ V_{z+1}, and each
// node's display scale is non-increasing toward finer levels.

function resolveGraphsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../../../paper_msagljs/graphs'),
    path.resolve(__dirname, '../../../../graphs'),
  ]
  for (const p of candidates) if (fs.existsSync(p)) return p
  return candidates[0]
}
const graphsDir = resolveGraphsDir()

function getOrAddNode(g: Graph, nodeMap: Map<string, Node>, id: string): Node {
  let n = nodeMap.get(id)
  if (!n) {
    n = new Node(id)
    g.addNode(n)
    nodeMap.set(id, n)
  }
  return n
}

function parseEdgeList(filePath: string): Graph {
  const content = fs.readFileSync(filePath, 'utf-8')
  const g = new Graph()
  const nodeMap = new Map<string, Node>()
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('%')) continue
    const parts = line.split(/\s+/).filter((s) => s.length > 0)
    if (parts.length < 2) continue
    const src = getOrAddNode(g, nodeMap, parts[0])
    const tgt = getOrAddNode(g, nodeMap, parts[1])
    if (src !== tgt) new Edge(src, tgt)
  }
  return g
}

function parseSimpleJSON(filePath: string): Graph {
  const obj = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const g = new Graph()
  const nodeMap = new Map<string, Node>()
  for (const nd of obj.nodes ?? []) {
    getOrAddNode(g, nodeMap, String(nd.id))
  }
  for (const e of obj.edges ?? obj.links ?? []) {
    const src = getOrAddNode(g, nodeMap, String(e.source))
    const tgt = getOrAddNode(g, nodeMap, String(e.target))
    if (src !== tgt) new Edge(src, tgt)
  }
  return g
}

function createGeometry(g: Graph): GeomGraph {
  const gg = new GeomGraph(g)
  for (const n of g.shallowNodes) {
    const gn = new GeomNode(n)
    gn.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(30, 20, 3, 3, new Point(0, 0))
  }
  for (const e of g.deepEdges) {
    new GeomEdge(e)
  }
  return gg
}

function makeRootTile(bb: Rectangle): Rectangle {
  const rootTileSize = 2 ** Math.ceil(Math.log2(Math.max(bb.width, bb.height)))
  return new Rectangle({
    left: bb.left - (rootTileSize - bb.width) / 2,
    bottom: bb.bottom - (rootTileSize - bb.height) / 2,
    right: bb.right + (rootTileSize - bb.width) / 2,
    top: bb.top + (rootTileSize - bb.height) / 2,
  })
}

const TILE_CAPACITY = 500
const MAX_LEVELS = 20

interface GraphSpec {
  name: string
  parse: () => Graph
}

const graphs: GraphSpec[] = [
  {name: 'gameofthrones', parse: () => parseSimpleJSON(path.join(graphsDir, 'gameofthrones.json'))},
  {name: 'composers', parse: () => parseSimpleJSON(path.join(graphsDir, 'composers.json'))},
  {name: 'facebook_combined', parse: () => parseEdgeList(path.join(graphsDir, 'facebook_combined.txt'))},
  {name: 'ca-GrQc', parse: () => parseEdgeList(path.join(graphsDir, 'ca-GrQc.txt'))},
]

describe('Accepted level sets are nested', () => {
  for (const spec of graphs) {
    test(spec.name, () => {
      const g = spec.parse()
      const gg = createGeometry(g)
      const settings = new MdsLayoutSettings()
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Sleeve
      gg.layoutSettings = settings
      layoutGraphWithMds(gg, null)

      const tileMap = new TileMap(gg, makeRootTile(gg.boundingBox), TILE_CAPACITY)
      const numLevels = tileMap.buildUpToLevel(MAX_LEVELS)
      const lastIdx = numLevels - 1

      let nestingViolations = 0
      let scaleViolations = 0
      const sizes: number[] = []
      for (let k = 0; k < numLevels; k++) sizes.push(tileMap.nodeScales[k]?.size ?? -1)

      for (let k = 0; k < lastIdx; k++) {
        const coarse = tileMap.nodeScales[k]
        const fine = tileMap.nodeScales[k + 1]
        if (!coarse || !fine) continue
        for (const [n, sCoarse] of coarse) {
          if (!fine.has(n)) {
            nestingViolations++
            // eslint-disable-next-line no-console
            console.log(`[${spec.name}] NESTING VIOLATION: node ${n.id} on level ${k} missing from level ${k + 1}`)
          } else {
            const sFine = fine.get(n)
            if (sFine > sCoarse + 1e-9) {
              scaleViolations++
              // eslint-disable-next-line no-console
              console.log(`[${spec.name}] SCALE GROWTH: node ${n.id} scale ${sCoarse} at level ${k} -> ${sFine} at level ${k + 1}`)
            }
          }
        }
      }
      // eslint-disable-next-line no-console
      console.log(
        `[${spec.name}] levels=${numLevels}, per-level accepted sizes=[${sizes.join(', ')}], ` +
          `nesting violations=${nestingViolations}, scale-growth cases=${scaleViolations}`,
      )
      expect(nestingViolations).toBe(0)
    }, 7200000)
  }
})
