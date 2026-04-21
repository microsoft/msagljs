import {join} from 'path'
import * as fs from 'fs'
import {parseJSON} from '../../../../parser/src/dotparser'
import {
  GeomGraph,
  layoutGeomGraph,
  EdgeRoutingMode,
  MdsLayoutSettings,
  TileMap,
} from '../../../src'
import {DrawingGraph} from '../../../../drawing/src'
import {PlaneTransformation} from '../../../src/math/geometry/planeTransformation'
import {Rectangle} from '../../../src/math/geometry/rectangle'

/** Render two cropped fragments of the tile pyramid for the paper:
 *  one coarse level and one finer level, sharing the *same* crop window
 *  (bbox around the coarse level's top-ranked landmark, enlarged). */
test('dump tile pyramid fragments for GoT', () => {
  const fpath = join(__dirname, '../../data/JSONfiles/gameofthrones.json')
  const graphStr = fs.readFileSync(fpath, 'utf-8')
  const graph = parseJSON(JSON.parse(graphStr))
  const dg = DrawingGraph.getDrawingObj(graph) as DrawingGraph
  dg.createGeometry()
  const gg = GeomGraph.getGeom(graph) as GeomGraph
  gg.layoutSettings = new MdsLayoutSettings()
  gg.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Corridor
  layoutGeomGraph(gg, null)

  const tm = new TileMap(gg, gg.boundingBox)
  const nLevels = tm.buildUpToLevel(4)
  console.log('built', nLevels, 'levels')

  const outDir = join(__dirname, '../../../../../tmp/tile_pyramid')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})

  const coarseLevel = 2
  const fineLevel = 3

  const coarseData = collectLevel(tm, coarseLevel)
  const fineData = collectLevel(tm, fineLevel)

  const crop = cropAroundTopLandmark(coarseData.nodes, 3.2)

  writeFragmentSvg(join(outDir, 'fragment_coarse.svg'), coarseLevel, crop, coarseData)
  writeFragmentSvg(join(outDir, 'fragment_fine.svg'), fineLevel, crop, fineData)
  console.log(`fragment coarse: ${coarseData.nodes.size} level nodes`)
  console.log(`fragment fine:   ${fineData.nodes.size} level nodes`)
})

type LevelData = {nodes: Map<string, {node: any; scale: number}>; clips: {curve: any}[]}

function collectLevel(tm: TileMap, z: number): LevelData {
  const scales = (tm as any).nodeScales?.[z] as Map<unknown, number> | undefined
  const nodes = new Map<string, {node: any; scale: number}>()
  const clips: {curve: any}[] = []
  for (const t of tm.getTilesOfLevel(z)) {
    for (const n of t.data.nodes) {
      const id = (n.node as {id?: string}).id ?? String(Math.random())
      if (!nodes.has(id)) {
        const s = scales ? scales.get(n.node) ?? 1 : 1
        nodes.set(id, {node: n, scale: s})
      }
    }
    for (const cc of t.data.curveClips) clips.push({curve: cc.curve})
  }
  return {nodes, clips}
}

function cropAroundTopLandmark(nodes: Map<string, {node: any; scale: number}>, factor: number): Rectangle {
  let top: {node: any; scale: number} | null = null
  for (const v of nodes.values()) if (!top || v.scale > top.scale) top = v
  if (!top) throw new Error('no nodes')
  const bb = top.node.boundingBox as Rectangle
  // Square-ish crop around the landmark; use the longer axis to avoid
  // thin strips when the node is an elongated ellipse.
  const longSide = Math.max(bb.width, bb.height) * top.scale * factor
  const w = longSide
  const h = longSide
  const r = Rectangle.mkEmpty()
  r.left = bb.center.x - w / 2
  r.right = bb.center.x + w / 2
  r.bottom = bb.center.y - h / 2
  r.top = bb.center.y + h / 2
  return r
}

function writeFragmentSvg(path: string, z: number, crop: Rectangle, data: LevelData) {
  const minX = crop.left
  const minY = crop.bottom
  const w = crop.width
  const h = crop.height
  const pxWidth = 900
  const pxHeight = (pxWidth * h) / w
  let svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${-minY - h} ${w} ${h}" ` +
    `width="${pxWidth}" height="${pxHeight.toFixed(2)}" font-family="sans-serif">\n`
  svg += `  <rect x="${minX}" y="${-minY - h}" width="${w}" height="${h}" fill="white"/>\n`
  svg += `  <g transform="scale(1,-1)">\n`

  for (const c of data.clips) {
    if (!curveIntersectsRect(c.curve, crop)) continue
    svg += curveToSvg(c.curve, '#2b8a3e', 2.0)
  }

  let topNode: {node: any; scale: number} | null = null
  for (const v of data.nodes.values()) if (!topNode || v.scale > topNode.scale) topNode = v
  for (const {node, scale} of data.nodes.values()) {
    let bc = node.boundaryCurve
    if (scale && scale !== 1) {
      const t = PlaneTransformation.scaleAroundCenterTransformation(scale, scale, node.center)
      bc = bc.transform(t)
    }
    if (!curveIntersectsRect(bc, crop)) continue
    const isTop = node === topNode!.node
    const fill = isTop ? '#fde68a' : '#e0f2fe'
    const stroke = isTop ? '#b45309' : '#0369a1'
    svg += curveToSvg(bc, fill, 1.5, stroke)
  }

  svg += `  </g>\n`

  const labelScale = Math.max(w, h) / 40
  for (const {node, scale} of data.nodes.values()) {
    const id = (node.node as {id?: string}).id ?? ''
    if (!id) continue
    if (!crop.contains(node.center)) continue
    const isTop = node === topNode!.node
    if (!isTop && scale < 1.2) continue
    const fontSize = labelScale * Math.max(0.7, Math.min(1.6, scale * 0.45))
    svg +=
      `  <text x="${node.center.x}" y="${-node.center.y}" text-anchor="middle" ` +
      `dominant-baseline="middle" font-size="${fontSize.toFixed(1)}" font-weight="${isTop ? 700 : 500}" ` +
      `fill="#111">${escapeXml(id)}</text>\n`
  }

  const tagSize = labelScale * 0.8
  svg += `  <text x="${minX + tagSize * 0.4}" y="${-minY - h + tagSize * 1.2}" font-size="${tagSize.toFixed(1)}" fill="#444">level ${z}</text>\n`
  svg += `</svg>\n`
  fs.writeFileSync(path, svg)
}

function curveIntersectsRect(c: any, r: Rectangle): boolean {
  try {
    const bb = c.boundingBox as Rectangle
    return bb.intersects(r)
  } catch {
    return true
  }
}

function curveToSvg(c: any, fill: string, sw: number, stroke?: string): string {
  const pts: {x: number; y: number}[] = []
  const a = c.parStart
  const b = c.parEnd
  const N = 64
  for (let i = 0; i <= N; i++) {
    const p = c.value(a + ((b - a) * i) / N)
    pts.push({x: p.x, y: p.y})
  }
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const isClosed = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-3
  const fillAttr = isClosed ? fill : 'none'
  const strokeAttr = stroke ?? fill
  return `    <path d="${d}${isClosed ? ' Z' : ''}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${sw}"/>\n`
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'}[c]!))
}
