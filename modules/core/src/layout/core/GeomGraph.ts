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
import {Curve, CurveFactory, ICurve, PointLocation} from '../../math/geometry'

// import {Curve} from '../../math/geometry/curve'
// import {Ellipse} from '../../math/geometry/ellipse'
// import {Entity} from '../../structs/entity'
class RRect extends Rectangle {
  isOk(): boolean {
    if (this.isEmpty()) {
      return true
    }
    return this.roundedRect_.boundingBox.equalEps(this)
  }
  setRect(value: Rectangle) {
    super.left_ = value.left
    super.right_ = value.right
    super.top_ = value.top
    super.bottom_ = value.bottom
    if (!this.isEmpty()) {
      this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(value.width, value.height, this.radX, this.radY, super.center)
    }
  }
  radX: number
  radY: number
  roundedRect_: Curve
  boundingBox_: Rectangle
  constructor(t: {left: number; right: number; top: number; bottom: number; radX: number; radY: number}) {
    super(t)
    this.radX = t.radX
    this.radY = t.radY
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, t.radX, t.radY, super.center)
  }
  get center() {
    return super.center
  }
  set center(value: Point) {
    super.center = value
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, this.radX, this.radY, super.center)
    // Assert.assert(this.isOk())
  }
  get left() {
    return super.left
  }
  set left(value: number) {
    super.left = value
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, this.radX, this.radY, super.center)
  }
  get right(): number {
    return super.right
  }
  set right(value: number) {
    super.right = value
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, this.radX, this.radY, super.center)
  }
  get top() {
    return super.top
  }

  set top(value: number) {
    super.top = value
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, this.radX, this.radY, super.center) // todo: optimize
  }
  get bottom() {
    return super.bottom
  }

  set bottom(value: number) {
    super.bottom = value
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, this.radX, this.radY, super.center) // todo: optimize
  }
}
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
  ignoreBBoxCheck = false
  bbIsCorrect(): boolean {
    return true
    if (this.ignoreBBoxCheck) {
      return true
    }
    const b = this.pumpTheBoxToTheGraphWithMargins()
    if (!Point.closeDistEps(b.center, new Point(0, 0)) && b.equalEps(this.boundingBox) == false) {
      return false
    }

    return true
  }
  /** The empty space between the graph inner entities and its boundary */
  margins = {left: 10, top: 10, bottom: 10, right: 10}
  /** Calculate bounding box from children, not updating the bounding boxes recursively. */
  calculateBoundsFromChildren() {
    const bb = Rectangle.mkEmpty()
    for (const n of this.shallowNodes()) {
      bb.addRecSelf(n.boundingBoxWithPadding)
    }
    bb.padEverywhere(this.margins)
    return bb
  }
  isCollapsed = false

  _rtree: RTree<GeomObject, Point>

  static getGeom(attrCont: Graph): GeomGraph {
    return <GeomGraph>attrCont.getAttr(GeomObject.attachIndex)
  }
  private rrect: RRect;
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
  get layoutSettings(): LayoutSettings {
    return this._layoutSettings
  }

  // recursively sets the same settings for subgraphs
  set layoutSettings(value: LayoutSettings) {
    this._layoutSettings = value
  }

  private _labelSize: Size

  get labelSize() {
    return this._labelSize
  }
  set labelSize(value: Size) {
    this._labelSize = value
  }
  get boundingBox(): Rectangle {
    return this.rrect.clone()
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

    for (const n of this.shallowNodes()) {
      n.transform(matrix)
    }
    for (const e of this.edges()) {
      e.transform(matrix)
    }

    this.boundingBox =
      this.rrect == null || this.rrect.isEmpty() ? this.pumpTheBoxToTheGraphWithMargins() : this.boundingBox.transform(matrix)
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
  pumpTheBoxToTheGraphWithMargins(): Rectangle {
    const t = {b: Rectangle.mkEmpty()}
    this.pumpTheBoxToTheGraph(t)
    t.b.padEverywhere(this.margins)
    if (this.MinimalWidth > 0) t.b.width = Math.max(t.b.width, this.MinimalWidth)
    if (this.MinimalHeight > 0) t.b.height = Math.max(t.b.height, this.MinimalHeight)

    return t.b
  }

  // Fields which are set by Msagl
  // return the center of the curve bounding box
  get center() {
    return this.boundingBox ? this.boundingBox.center : new Point(0, 0)
  }

  set center(value: Point) {
    // Assert.assert(this.bbIsCorrect())
    const del = value.sub(this.center)
    const t = new PlaneTransformation(1, 0, del.x, 0, 1, del.y)
    this.transform(t)
  }

  private pumpTheBoxToTheGraph(t: {b: Rectangle}) {
    //Assert.assert(this.graph.isEmpty() == false)
    for (const e of this.edges()) {
      if (e.underCollapsedGraph()) continue
      if (!(e.source.node.isDescendantOf(this.graph) && e.target.node.isDescendantOf(this.graph))) {
        continue
      }
      if (e.curve != null) {
        const cb = e.curve.boundingBox
        // cb.pad(e.lineWidth)
        t.b.addRecSelf(cb)
      }
      if (e.label != null) {
        t.b.addRecSelf(e.label.boundingBox)
      }
    }

    for (const n of this.shallowNodes()) {
      if (n.underCollapsedGraph() || !n.boundingBox) continue
      t.b.addRecSelf(n.boundingBox)
    }

    this.addLabelToGraphBB(t.b)
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
  /** The X radius of the rounded rectangle border */
  radX = 10
  /** The Y radius of the rounded rectangle border */
  radY = 10
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
    this.rrect = new RRect({left: 0, right: -1, top: 20, bottom: 0, radX: this.radX, radY: this.radY})
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

  FlipYAndMoveLeftTopToOrigin() {
    const bb = this.boundingBox
    const m = new PlaneTransformation(1, 0, -bb.left, 0, -1, bb.top)
    this.transform(m)
  }
}
