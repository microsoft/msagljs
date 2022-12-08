import {Graph, pageRank} from '../../structs/graph'
import {Rectangle, Size} from '../../math/geometry/rectangle'
import {GeomObject} from './geomObject'
import {GeomNode} from './geomNode'
import {GeomEdge} from './geomEdge'
import {PlaneTransformation} from '../../math/geometry/planeTransformation'
import {Point} from '../../math/geometry/point'
import {OptimalRectanglePacking} from '../../math/geometry/rectanglePacking/OptimalRectanglePacking'
import {mkRTree, RTree} from '../../math/geometry/RTree/rTree'
import {Curve, ICurve, interpolateICurve, PointLocation} from '../../math/geometry'
import {RRect} from './RRect'
import {IGeomGraph} from '../initialLayout/iGeomGraph'
import {ILayoutSettings} from '../iLayoutSettings'
import {Entity} from '../../structs/entity'
import {AttributeRegistry} from '../../structs/attributeRegistry'
import {Edge} from '../../structs/edge'
import {Node} from '../../structs/node'
import {PointPair} from '../../math/geometry/pointPair'
import {IntPairMap} from '../../utils/IntPairMap'
import {Arrowhead} from './arrowhead'
import {GeomLabel} from './geomLabel'
import {clipWithRectangleInsideInterval} from '../../math/geometry/curve'
import {Assert} from '../../utils/assert'
// packs the subgraphs and set the bounding box of the parent graph
export function optimalPackingRunner(geomGraph: GeomGraph, subGraphs: GeomGraph[]) {
  const subgraphsRects = subGraphs.map((g) => [g, g.boundingBox] as [GeomGraph, Rectangle]) // g.boundingBox is a clone of the graph rectangle

  const rectangles = subgraphsRects.map((t) => t[1]) as Array<Rectangle>
  const packing = new OptimalRectanglePacking(
    rectangles,
    1.5, // TODO - pass as a parameter: PackingAspectRatio,
  )
  packing.run()
  for (const [g, rect] of subgraphsRects) {
    const delta = rect.leftBottom.sub(g.boundingBox.leftBottom)
    g.translate(delta)
  }
  geomGraph.boundingBox = new Rectangle({
    left: 0,
    bottom: 0,
    right: packing.PackedWidth,
    top: packing.PackedHeight,
  })
}

/** GeomGraph is an attribute on a Graph. The underlying Graph keeps all structural information but GeomGraph holds the geometry data, and the layout settings */
export class GeomGraph extends GeomNode {
  isAncestor(source: GeomNode): boolean {
    return this.graph.isAncestor(source.node)
  }
  deepTranslate(delta: Point) {
    for (const n of this.nodesBreadthFirst) {
      if (n instanceof GeomGraph) {
        n.boundingBox = n.boundingBox.translate(delta)
      } else {
        n.translate(delta)
      }
      for (const e of n.selfEdges()) {
        e.translate(delta)
      }
      for (const e of n.outEdges()) {
        if (this.graph.isAncestor(e.target.node)) e.translate(delta)
      }
    }
    this.boundingBox = this.boundingBox.translate(delta)
  }
  /** The empty space between the graph inner entities and its boundary */
  margins = {left: 10, top: 10, bottom: 10, right: 10}
  private rrect: RRect
  private _layoutSettings: ILayoutSettings
  private _labelSize: Size
  /** The X radius of the rounded rectangle border */
  radX = 10
  /** The Y radius of the rounded rectangle border */
  radY = 10
  /** it is a rather shallow clone */
  clone(): GeomGraph {
    const gg = new GeomGraph(null)
    gg.boundingBox = this.boundingBox.clone()
    gg.layoutSettings = this.layoutSettings
    gg.margins = this.margins
    gg.radX = this.radX
    gg.radY = this.radY
    return gg
  }

  /** Calculate bounding box from children, not updating the bounding boxes recursively. */
  calculateBoundsFromChildren() {
    const bb = Rectangle.mkEmpty()
    for (const n of this.shallowNodes) {
      bb.addRecSelf(n.boundingBoxWithPadding)
    }
    bb.padEverywhere(this.margins)
    return bb
  }
  *allSuccessorsWidthFirst(): IterableIterator<GeomNode> {
    for (const n of this.graph.allSuccessorsWidthFirst()) {
      yield GeomNode.getGeom(n) as GeomNode
    }
  }

  static getGeom(attrCont: Graph): GeomGraph {
    return <GeomGraph>GeomObject.getGeom(attrCont)
  }

  edgeCurveOrArrowheadsIntersectRect(geomEdge: GeomEdge, rect: Rectangle): boolean {
    for (const p of geomEdge.sourceArrowheadPoints(25)) {
      if (rect.contains(p)) return true
    }
    for (const p of geomEdge.targetArrowheadPoints(25)) {
      if (rect.contains(p)) return true
    }
    const curveUnderTest = geomEdge.curve
    const perimeter = rect.perimeter()
    return (
      Curve.intersectionOne(curveUnderTest, perimeter, false) != null ||
      Curve.PointRelativeToCurveLocation(curveUnderTest.start, perimeter) === PointLocation.Inside
    )
  }

  isEmpty(): boolean {
    return this.graph.isEmpty()
  }
  setSettingsRecursively(ls: ILayoutSettings) {
    this.layoutSettings = ls
    for (const n of this.nodesBreadthFirst) {
      const gg = <GeomGraph>n
      gg.layoutSettings = ls
    }
  }
  get layoutSettings(): ILayoutSettings {
    return this._layoutSettings
  }

  // recursively sets the same settings for subgraphs
  set layoutSettings(value: ILayoutSettings) {
    this._layoutSettings = value
  }

  get labelSize() {
    return this._labelSize
  }
  set labelSize(value: Size) {
    this._labelSize = value
  }
  get boundingBox(): Rectangle {
    if (this.rrect) return this.rrect.clone()
    else return null
  }

  set boundingBox(value: Rectangle) {
    if (value) {
      this.rrect.setRect(value)
    } else {
      this.rrect.roundedRect_ = null
    }
    // Assert.assert(this.bbIsCorrect())
  }
  transform(matrix: PlaneTransformation) {
    if (matrix.isIdentity()) return

    for (const n of this.shallowNodes) {
      n.transform(matrix)
    }
    for (const e of this.shallowEdges) {
      e.transform(matrix)
      if (e.label) e.label.transform(matrix)
    }

    this.boundingBox =
      this.rrect == null || this.rrect.isEmpty() ? this.pumpTheBoxToTheGraphWithMargins() : this.boundingBox.transform(matrix)
  }

  /** Contrary to the deepTranslate() it also translates edges leading out of the graph */
  translate(delta: Point) {
    if (delta.x === 0 && delta.y === 0) return
    this.deepTranslate(delta)
  }
  get nodesBreadthFirst(): IterableIterator<GeomNode> {
    return this.nodesBreadthFirstIter()
  }
  private *nodesBreadthFirstIter(): IterableIterator<GeomNode> {
    for (const n of this.graph.nodesBreadthFirst) {
      yield GeomObject.getGeom(n) as unknown as GeomNode
    }
  }
  setEdge(s: string, t: string): GeomEdge {
    const structEdge = this.graph.setEdge(s, t)
    return new GeomEdge(structEdge)
  }
  /** this does not change the graph bounding box */
  getPumpedGraphWithMarginsBox(): Rectangle {
    const t = {b: Rectangle.mkEmpty()}
    pumpTheBoxToTheGraph(this, t)
    t.b.padEverywhere(this.margins)
    return t.b
  }
  /** sets the bounding box and the boundary curve as well */
  pumpTheBoxToTheGraphWithMargins(): Rectangle {
    return (this.boundingBox = this.getPumpedGraphWithMarginsBox())
  }

  // Fields which are set by Msagl
  // return the center of the curve bounding box
  get center() {
    return this.boundingBox || this.boundingBox.isEmpty ? this.boundingBox.center : new Point(0, 0)
  }

  set center(value: Point) {
    // Assert.assert(this.bbIsCorrect())
    const del = value.sub(this.center)
    const t = new PlaneTransformation(1, 0, del.x, 0, 1, del.y)
    this.transform(t)
  }

  get left() {
    return this.boundingBox.left
  }
  get right() {
    return this.boundingBox.right
  }
  get top() {
    return this.boundingBox.top
  }
  get bottom() {
    return this.boundingBox.bottom
  }
  CheckClusterConsistency(): boolean {
    throw new Error('Method not implemented.')
  }
  get edgeCount() {
    return this.graph.edgeCount
  }

  get boundaryCurve(): ICurve {
    // Assert.assert(this.rrect.isOk())
    return this.rrect.roundedRect_
  }

  set boundaryCurve(value: ICurve) {
    throw new Error()
  }

  get shallowNodes(): IterableIterator<GeomNode> {
    return this.shallowNodes_()
  }

  *shallowNodes_(): IterableIterator<GeomNode> {
    for (const n of this.graph.shallowNodes) yield GeomObject.getGeom(n) as GeomNode
  }

  /** iterates over the edges of the graph which adjacent to the nodes of the graph:
   * not iterating over the subgraphs
   */
  /** iterates over the edges of the graph including subgraphs */
  get deepEdges() {
    return this.deepEdgesIt()
  }
  private *deepEdgesIt(): IterableIterator<GeomEdge> {
    for (const e of this.graph.deepEdges) {
      yield <GeomEdge>GeomObject.getGeom(e)
    }
  }
  get shallowEdges() {
    return this.shallowEdgesIt()
  }
  private *shallowEdgesIt(): IterableIterator<GeomEdge> {
    for (const e of this.graph.shallowEdges) {
      yield <GeomEdge>GeomObject.getGeom(e)
    }
  }
  static mk(id: string, labelSize: Size = new Size(0, 0)): GeomGraph {
    const g = new GeomGraph(new Graph(id))
    g.labelSize = labelSize
    return g
  }

  get Clusters(): IterableIterator<IGeomGraph> {
    return this.subgraphs()
  }
  /** iterates over all subgraphs  */
  *subgraphs(): IterableIterator<GeomGraph> {
    for (const g of this.graph.subgraphsBreadthFirst()) {
      yield <GeomGraph>GeomObject.getGeom(g)
    }
  }

  static mkWithGraphAndLabel(graph: Graph, labelSize: Size): GeomGraph {
    const g = new GeomGraph(graph)
    g.labelSize = labelSize
    return g
  }

  constructor(graph: Graph) {
    super(graph)
    this.rrect = new RRect({left: 0, right: -1, top: 20, bottom: 0, radX: this.radX, radY: this.radY})
  }
  get deepNodeCount(): number {
    let n = 0
    for (const v of this.graph.nodesBreadthFirst) n++
    return n
  }
  get subgraphsDepthFirst(): IterableIterator<IGeomGraph> {
    return this.getSubgraphsDepthFirst()
  }
  *getSubgraphsDepthFirst(): IterableIterator<IGeomGraph> {
    for (const n of this.graph.allSuccessorsDepthFirst()) {
      if (n instanceof Graph) yield GeomGraph.getGeom(n)
    }
  }
  get uniformMargins() {
    return Math.max(this.margins.left, this.margins.right, this.margins.right, this.margins.bottom)
  }
  set uniformMargins(value: number) {
    this.margins.left = this.margins.right = this.margins.right = this.margins.bottom = value
  }

  get height() {
    return this.boundingBox.height
  }

  get width() {
    return this.boundingBox.width
  }

  get shallowNodeCount() {
    return this.graph.shallowNodeCount
  }

  get graph() {
    return this.entity as Graph
  }

  liftNode(n: GeomNode): GeomNode {
    const liftedNode = this.graph.liftNode(n.node)
    return liftedNode ? <GeomNode>GeomObject.getGeom(liftedNode) : null
  }

  findNode(id: string): GeomNode {
    const n = this.graph.findNode(id)
    if (!n) return null
    return <GeomNode>GeomObject.getGeom(n)
  }

  addNode(gn: GeomNode): GeomNode {
    this.graph.addNode(gn.node)
    return gn
  }

  addLabelToGraphBB(rect: Rectangle) {
    if (this.labelSize) {
      rect.top += this.labelSize.height + 2 // 2 for label margin
      if (rect.width < this.labelSize.width) {
        rect.width = this.labelSize.width
      }
    }
  }
}

export function pumpTheBoxToTheGraph(igraph: IGeomGraph, t: {b: Rectangle}) {
  for (const e of igraph.shallowEdges) {
    if (!isProperEdge(e)) continue

    const cb = e.curve.boundingBox
    // cb.pad(e.lineWidth)
    t.b.addRecSelf(cb)
    if (e.edge.label != null) {
      t.b.addRecSelf(GeomObject.getGeom(e.edge.label).boundingBox)
    }
  }

  for (const n of igraph.shallowNodes) {
    if ('shallowEdges' in n) {
      pumpTheBoxToTheGraph(n as unknown as IGeomGraph, t)
    }
    if (n.underCollapsedGraph() || !n.boundingBox) continue
    t.b.addRecSelf(n.boundingBox)
  }
  if (igraph instanceof GeomGraph) {
    igraph.addLabelToGraphBB(t.b)
  }
  function isProperEdge(geomEdge: GeomEdge): boolean {
    if (geomEdge.curve == null) return false
    if (geomEdge.underCollapsedGraph()) return false
    if (igraph instanceof GeomGraph) {
      const graph = igraph.entity as Graph
      return graph.isAncestor(geomEdge.source.entity) && graph.isAncestor(geomEdge.target.entity)
    } else {
      return true
    }
  }
}

/** iterate over the graph objects intersected by a rectangle: by default, return only the intersected nodes */
export function* intersectedObjects(rtree: RTree<Entity, Point>, rect: Rectangle, onlyNodes = true): IterableIterator<Entity> {
  const result = rtree.GetAllIntersecting(rect)
  if (onlyNodes) {
    for (const r of result) {
      if (r instanceof Node) yield r
    }
  } else {
    // nodes and edges
    for (const r of result) {
      if (r instanceof Node || r instanceof Edge) yield r
    }
  }
}

export function buildRTree(graph: Graph): RTree<Entity, Point> {
  const data: Array<[Rectangle, Entity]> = (Array.from(graph.nodesBreadthFirst) as Array<Entity>)
    .concat(Array.from(graph.deepEdges) as Array<Entity>)
    .map((o) => [GeomObject.getGeom(o).boundingBox, o])
  return mkRTree(data)
}

type PpEdge = {edge: Edge; pp: PointPair}
export type HitTreeNodeType = Entity | PpEdge

export function* getGeomIntersectedObjects(tree: RTree<HitTreeNodeType, Point>, slack: number, point: Point): IterableIterator<GeomObject> {
  if (!tree) return
  const rect = Rectangle.mkSizeCenter(new Size(slack * 2), point)
  for (const t of tree.RootNode.AllHitItems(rect, null)) {
    if ('edge' in t) {
      if (dist(point, t.pp._first, t.pp._second) < slack) {
        yield GeomObject.getGeom(t.edge)
      }
    } else {
      yield GeomObject.getGeom(t)
    }
  }

  function dist(p: Point, s: Point, e: Point): number {
    const l = e.sub(s)
    const len = l.length
    if (len < 1.0 / 10) {
      return p.sub(Point.middle(s, e)).length
    }

    const perp = l.rotate90Cw()
    return Math.abs(p.sub(s).dot(perp)) / len
  }
}

export function buildRTreeWithInterpolatedEdges(graph: Graph, slack: number): RTree<HitTreeNodeType, Point> {
  if (graph == null) return null
  const nodes: Array<[Rectangle, HitTreeNodeType]> = Array.from(graph.nodesBreadthFirst).map((n) => [GeomNode.getGeom(n).boundingBox, n])

  const edgesPlusEdgeLabels: Array<[Rectangle, HitTreeNodeType]> = []
  for (const e of graph.deepEdges) {
    const ge = e.getAttr(AttributeRegistry.GeomObjectIndex) as GeomEdge
    if (ge.label) {
      edgesPlusEdgeLabels.push([ge.label.boundingBox, e.label])
    }
    const poly = interpolateICurve(ge.curve, slack / 2)
    if (ge.sourceArrowhead) {
      edgesPlusEdgeLabels.push([
        Rectangle.mkPP(ge.sourceArrowhead.tipPosition, ge.curve.start),
        {edge: e, pp: new PointPair(ge.sourceArrowhead.tipPosition, ge.curve.start)},
      ])
    }
    for (let i = 0; i < poly.length - 1; i++) {
      edgesPlusEdgeLabels.push([Rectangle.mkPP(poly[i], poly[i + 1]), {edge: e, pp: new PointPair(poly[i], poly[i + 1])}])
    }
    if (ge.targetArrowhead) {
      edgesPlusEdgeLabels.push([
        Rectangle.mkPP(ge.curve.end, ge.targetArrowhead.tipPosition),
        {edge: e, pp: new PointPair(ge.curve.end, ge.targetArrowhead.tipPosition)},
      ])
    }
  }
  const t = nodes.concat(edgesPlusEdgeLabels)
  return mkRTree(t)
}

export function edgesAreAttached(graph: Graph): boolean {
  for (const e of graph.deepEdges) {
    if (edgeIsAttached(e) == false) {
      edgeIsAttached(e)
      return false
    }
  }
  return true
}
function edgeIsAttached(e: Edge): boolean {
  return pointIsAttached(edgeStart(e), e.source) && pointIsAttached(edgeEnd(e), e.target)
}
function pointIsAttached(p: Point, target: Node): boolean {
  const bc = (GeomNode.getGeom(target) as GeomNode).boundaryCurve
  const loc = Curve.PointRelativeToCurveLocation(p, bc)
  return loc == PointLocation.Boundary
}
function edgeStart(e: Edge): Point {
  const ge = GeomEdge.getGeom(e)
  if (ge.sourceArrowhead) return ge.sourceArrowhead.tipPosition
  return ge.curve.start
}
function edgeEnd(e: Edge): Point {
  const ge = GeomEdge.getGeom(e)
  if (ge.targetArrowhead) return ge.targetArrowhead.tipPosition
  return ge.curve.end
}
/** Represents a part of the curve containing in a tile.
 * One tile can have several parts of clips corresponding to the same curve.
 */
export type CurveClip = {startPar: number; endPar: number; curve: ICurve}
/** keeps all the data needed to render a tile */
export type TileData = {
  curveClips: CurveClip[] // the curves are ranked
  arrowheads: {arrowhead: Arrowhead; edge: Edge; atSource: boolean}[]
  nodes: GeomNode[]
  labels: GeomLabel[]
  rect: Rectangle // it seems needed only for debug
}
/** keeps the data needed to render the tile hierarchy */
export class TileMap {
  private dataArray: IntPairMap<TileData>[] = []
  /** retrieves the data for a single tile(x-y-z) */
  getTileData(x: number, y: number, z: number): TileData {
    const mapOnLevel = this.dataArray[z]
    if (!mapOnLevel) return null
    return mapOnLevel.get(x, y)
  }

  *getTilesOfLevel(z: number): IterableIterator<{x: number; y: number; data: TileData}> {
    const tm = this.dataArray[z]
    if (tm == null) return
    for (const [key, val] of tm.keyValues()) {
      yield {x: key.x, y: key.y, data: val}
    }
  }

  geomGraph: GeomGraph
  topLevelTileRect: Rectangle
  constructor(geomGraph: GeomGraph, topLevelTileRect: Rectangle) {
    this.geomGraph = geomGraph
    this.topLevelTileRect = topLevelTileRect
    this.fillTopLevelTile()
  }

  fillTopLevelTile() {
    const tileMap = new IntPairMap<TileData>(1)
    let edges = Array.from(this.geomGraph.graph.deepEdges)
    const rank = pageRank(this.geomGraph.graph, 0.85)
    edges = edges.sort((u: Edge, v: Edge) => {
      const rv = rank.get(v.source) + rank.get(v.target)
      const ru = rank.get(u.source) + rank.get(u.target)
      return ru - rv
    })
    // inject edges to curves
    for (const e of edges) {
      const c = GeomEdge.getGeom(e).curve
      // @ts-ignore
      c.edge = e
    }
    const curveClips = edges
      .map((e) => GeomEdge.getGeom(e).curve)
      .map((c) => {
        return {startPar: c.parStart, endPar: c.parEnd, curve: c}
      })

    const arrows = []
    const geomLabels = []
    for (const e of edges) {
      const geomEdge = GeomEdge.getGeom(e)
      if (geomEdge.sourceArrowhead) {
        arrows.push({edge: geomEdge.edge, arrowhead: geomEdge.sourceArrowhead, atSource: true})
      }
      if (geomEdge.targetArrowhead) {
        arrows.push({edge: geomEdge.edge, arrowhead: geomEdge.targetArrowhead, atSource: false})
      }
      if (geomEdge.label) {
        geomLabels.push(geomEdge.label)
      }
    }
    const data: TileData = {
      curveClips: curveClips,
      arrowheads: arrows,
      nodes: Array.from(rank.keys()).map((n) => GeomNode.getGeom(n)),
      labels: geomLabels,
      rect: this.topLevelTileRect,
    }
    tileMap.set(0, 0, data)
    this.dataArray.push(tileMap)
  }
  /** creates tilings for levels from 0 to z, including the level z
   */
  buildUpToLevel(z: number) {
    // the 0 level is filled in the constructor
    for (let i = 1; i <= z; i++) {
      this.subdivideToLevel(i)
    }
  }
  /** it is assumed that the previous levels have been calculated */
  private subdivideToLevel(z: number) {
    const tilesInRow = Math.pow(2, z)
    const levelTiles = (this.dataArray[z] = new IntPairMap<TileData>(tilesInRow))
    /** the width and the height of the previous level tile */
    let w = this.topLevelTileRect.width
    let h = this.topLevelTileRect.height
    for (let i = 0; i < z - 1; i++) {
      w /= 2
      h /= 2
    }
    /** the width and the height of z-th level tile */
    const wz = w / 2
    const hz = h / 2

    for (const [key, tile] of this.dataArray[z - 1].keyValues()) {
      const xp = key.x
      const yp = key.y
      const left = this.topLevelTileRect.left + xp * w
      const bottom = this.topLevelTileRect.bottom + yp * h
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const tileRect = new Rectangle({
            left: left + wz * i,
            right: left + wz * (i + 1),
            bottom: bottom + hz * j,
            top: bottom + hz * (j + 1),
          })
          const tileData: TileData = this.generateSubTile(tile, tileRect)
          if (tileData) {
            levelTiles.set(2 * xp + i, 2 * yp + j, tileData)
          }
        }
    }
  }

  generateSubTile(upperTile: TileData, tileRect: Rectangle): TileData {
    const sd: TileData = {nodes: [], arrowheads: [], labels: [], curveClips: [], rect: tileRect}
    for (const n of upperTile.nodes) {
      if (n.boundingBox.intersects(tileRect)) {
        sd.nodes.push(n)
      }
    }

    for (const lab of upperTile.labels) {
      if (lab.boundingBox.intersects(tileRect)) {
        sd.labels.push(lab)
      }
    }
    for (const clip of upperTile.curveClips) {
      for (const newClip of clipWithRectangleInsideInterval(clip.curve, clip.startPar, clip.endPar, tileRect)) {
        sd.curveClips.push({curve: clip.curve, startPar: newClip.start, endPar: newClip.end})
      }
    }
    for (const clip of sd.curveClips) {
      // @ts-ignore
      const geomEdge = clip.curve.edge as GeomEdge
      if (geomEdge.sourceArrowhead && geomEdge.curve.parStart === clip.startPar)
        sd.arrowheads.push({arrowhead: geomEdge.sourceArrowhead, edge: geomEdge.edge, atSource: true})
      if (geomEdge.targetArrowhead && geomEdge.curve.parStart === clip.startPar)
        sd.arrowheads.push({arrowhead: geomEdge.targetArrowhead, edge: geomEdge.edge, atSource: false})
    }
    if (!emptyTile(sd)) {
      return sd
    }
  }
}
function emptyTile(sd: TileData): boolean {
  return sd.arrowheads.length === 0 && sd.curveClips.length === 0 && sd.nodes.length === 0
}
