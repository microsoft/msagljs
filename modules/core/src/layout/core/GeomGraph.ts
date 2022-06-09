import {Graph} from '../../structs/graph'
import {Rectangle, Size} from '../../math/geometry/rectangle'
import {GeomObject} from './geomObject'
import {GeomNode} from './geomNode'
import {GeomEdge} from './geomEdge'
import {PlaneTransformation} from '../../math/geometry/planeTransformation'
import {Point} from '../../math/geometry/point'
import {OptimalRectanglePacking} from '../../math/geometry/rectanglePacking/OptimalRectanglePacking'
import {LayoutSettings} from '../layered/SugiyamaLayoutSettings'
import {mkRTree, RTree} from '../../math/geometry/RTree/rTree'
import {Curve, PointLocation} from '../../math/geometry'
import {Entity} from '../../structs/entity'

// import {Curve} from '../../math/geometry/curve'
// import {Ellipse} from '../../math/geometry/ellipse'
// import {Entity} from '../../structs/entity'

// packs the subgraphs and set the bounding box of the parent graph
export function optimalPackingRunner(geomGraph: GeomGraph, subGraphs: GeomGraph[]) {
  const originalLeftBottoms = new Array<{g: GeomGraph; lb: Point}>()
  for (const g of subGraphs) {
    originalLeftBottoms.push({g: g, lb: g.boundingBox.leftBottom.clone()})
  }
  const rectangles = subGraphs.map((g) => g.boundingBox)
  const packing = new OptimalRectanglePacking(
    rectangles,
    1.5, // TODO - pass as a parameter: PackingAspectRatio,
  )
  packing.run()
  for (const {g, lb} of originalLeftBottoms) {
    const delta = g.boundingBox.leftBottom.sub(lb)
    g.translate(delta)
  }
  geomGraph.boundingBox = new Rectangle({
    left: 0,
    bottom: 0,
    right: packing.PackedWidth,
    top: packing.PackedHeight,
  })
  geomGraph.addLabelToGraphBB(geomGraph.boundingBox)
}

/** GeomGraph is an attribute on a Graph. The underlying Graph keeps all structural information but GeomGraph holds the geometry data, and the layout settings */
export class GeomGraph extends GeomNode {
  isCollapsed = false

  _rtree: RTree<GeomObject, Point>

  static getGeom(attrCont: Graph): GeomGraph {
    return <GeomGraph>attrCont.getAttr(0)
  }

  /** iterate over the graph objects intersected by a rectangle: by default return only the intersected nodes */
  *intersectedObjects(rect: Rectangle, onlyNodes = true): IterableIterator<GeomObject> {
    if (this._rtree == null) {
      this._rtree = this.buildRTree()
    }
    const result = this._rtree.GetAllIntersecting(rect)
    const perimeter = rect.perimeter()
    for (const r of result) {
      if (r instanceof GeomNode) yield r
      if (onlyNodes) continue
      if (r instanceof GeomEdge) {
        const curveUnderTest = (r as GeomEdge).curve
        if (
          Curve.intersectionOne(curveUnderTest, perimeter, false) != null ||
          Curve.PointRelativeToCurveLocation(curveUnderTest.start, perimeter) == PointLocation.Inside
        )
          yield r
      }
    }
  }

  buildRTree(): RTree<GeomObject, Point> {
    const data: Array<[Rectangle, GeomObject]> = (Array.from(this.deepNodes) as GeomObject[])
      .concat(Array.from(this.deepEdges()) as GeomObject[])
      .map((o) => [o.boundingBox, o])
    return mkRTree(data)
  }

  isEmpty(): boolean {
    return this.graph.isEmpty()
  }
  setSettingsRecursively(ls: LayoutSettings) {
    this.layoutSettings = ls
    for (const n of this.deepNodes) {
      const gg = <GeomGraph>n
      gg.layoutSettings = ls
    }
  }
  private _layoutSettings: LayoutSettings
  public get layoutSettings(): LayoutSettings {
    return this._layoutSettings
  }

  // recursively sets the same settings for subgraphs
  public set layoutSettings(value: LayoutSettings) {
    this._layoutSettings = value
  }
  translate(delta: Point) {
    if (delta.x == 0 && delta.y == 0) return
    const m = new PlaneTransformation(1, 0, delta.x, 0, 1, delta.y)
    this.transform(m)
  }
  private _boundingBox: Rectangle
  private _labelSize: Size

  public get labelSize() {
    return this._labelSize
  }
  public set labelSize(value: Size) {
    this._labelSize = value
  }
  public get boundingBox(): Rectangle {
    return this._boundingBox
  }
  public set boundingBox(value: Rectangle) {
    this._boundingBox = value
    /*
    if (this.boundaryCurve) {
      // suppose it is a rectangle with rounded corners
      if (this.boundaryCurve instanceof Curve) {
        const r = <Curve>this.boundaryCurve
        let rx = 0
        let ry = 0
        for (const seg of r.segs) {
          if (seg instanceof Ellipse) {
            const ell = <Ellipse>seg
            rx = ell.aAxis.length
            ry = ell.bAxis.length
            break
          }
        }
        this.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(
          value.width,
          value.height,
          rx,
          ry,
          value.center,
        )
      }
    }*/
  }
  transform(matrix: PlaneTransformation, updateBoundingBox = true) {
    if (matrix.isIdentity()) return
    if (this.boundaryCurve != null) this.boundaryCurve = this.boundaryCurve.transform(matrix)

    for (const n of this.shallowNodes()) {
      n.transform(matrix, updateBoundingBox)
    }
    for (const e of this.edges()) {
      e.transform(matrix)
    }
    if (updateBoundingBox) {
      this.updateBoundingBox()
    }
  }
  get deepNodes(): IterableIterator<GeomNode> {
    return this.deepNodesIt()
  }
  *deepNodesIt(): IterableIterator<GeomNode> {
    for (const n of this.graph.deepNodes) {
      yield GeomObject.getGeom(n) as unknown as GeomNode
    }
  }
  setEdge(s: string, t: string): GeomEdge {
    const structEdge = this.graph.setEdge(s, t)
    return new GeomEdge(structEdge)
  }

  MinimalWidth = 0
  MinimalHeight = 0
  pumpTheBoxToTheGraphWithMargins(minSeparation: number): Rectangle {
    const t = {b: Rectangle.mkEmpty()}
    this.pumpTheBoxToTheGraph(t)
    t.b.pad(Math.max(this.Margins, minSeparation))
    if (this.MinimalWidth > 0) t.b.width = Math.max(t.b.width, this.MinimalWidth)
    if (this.MinimalHeight > 0) t.b.height = Math.max(t.b.height, this.MinimalHeight)

    this._boundingBox = t.b

    return t.b
  }

  // Fields which are set by Msagl
  // return the center of the curve bounding box
  get center() {
    return this.boundingBox ? this.boundingBox.center : new Point(0, 0)
  }

  set center(value: Point) {
    const del = value.sub(this.center)
    const t = new PlaneTransformation(1, 0, del.x, 0, 1, del.y)
    this.transform(t)
  }

  pumpTheBoxToTheGraph(t: {b: Rectangle}) {
    //Assert.assert(this.graph.isEmpty() == false)
    for (const e of this.edges()) {
      if (e.underCollapsedGraph()) continue
      if (e.curve != null) {
        const cb = e.curve.boundingBox
        cb.pad(e.lineWidth)
        t.b.addRecSelf(cb)
      }
      if (e.label != null) t.b.addRecSelf(e.label.boundingBox)
    }

    for (const n of this.shallowNodes()) {
      if (n.underCollapsedGraph() || !n.boundingBox) continue
      t.b.addRecSelf(n.boundingBox)
    }
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
  Margins = 10
  get edgeCount() {
    return this.graph.edgeCount
  }

  *shallowNodes(): IterableIterator<GeomNode> {
    for (const n of this.graph.shallowNodes) yield GeomObject.getGeom(n) as GeomNode
  }

  *edges(): IterableIterator<GeomEdge> {
    for (const n of this.graph.edges) yield GeomObject.getGeom(n) as GeomEdge
  }

  *deepEdges(): IterableIterator<GeomEdge> {
    for (const e of this.graph.deepEdges()) {
      yield <GeomEdge>GeomObject.getGeom(e)
    }
  }
  static mk(id: string, labelSize: Size = new Size(0, 0)): GeomGraph {
    const g = new GeomGraph(new Graph(id))
    g.labelSize = labelSize
    return g
  }

  *subgraphs(): IterableIterator<GeomGraph> {
    for (const g of this.graph.subgraphs()) {
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

  updateBoundingBox(): void {
    if (this.graph.isEmpty()) {
      return
    }
    const rect = Rectangle.mkEmpty()
    let padding = 0
    for (const e of this.graph.edges) {
      const ge = GeomObject.getGeom(e) as GeomEdge
      if (ge.curve == null) continue
      rect.addRecSelf(ge.boundingBox)
      padding = Math.max(padding, ge.lineWidth)
    }
    for (const gn of this.shallowNodes()) {
      if (gn.boundingBox) {
        rect.addRecSelf(gn.boundingBox)
        padding = Math.max(padding, gn.padding)
      }
    }
    this.addLabelToGraphBB(rect)

    rect.pad(Math.max(padding, this.Margins))
    this.boundingBox = rect
  }

  addLabelToGraphBB(rect: Rectangle) {
    if (this.labelSize) {
      rect.top += this.labelSize.height + 2 // 2 for label margin
      if (rect.width < this.labelSize.width) {
        rect.width = this.labelSize.width
      }
    }
  }

  FlipYAndMoveLeftTopToOrigin() {
    const m = new PlaneTransformation(1, 0, -this.left, 0, -1, this.top)
    this.transform(m, false)
    for (const v of this.deepNodes) {
      if (v instanceof GeomGraph) {
        const g = <GeomGraph>v
        if (!g.graph.isEmpty()) {
          const bb = v.boundingBox
          v.boundingBox = Rectangle.mkSizeCenter(new Size(bb.width, bb.height), m.multiplyPoint(bb.center))
        }
      }
    }
    const bb = this.boundingBox
    this.boundingBox = Rectangle.mkSizeCenter(new Size(bb.width, bb.height), m.multiplyPoint(bb.center))
  }
}
