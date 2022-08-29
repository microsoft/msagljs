import {RBTree} from '../../math/RBTree/rbTree'
import {CdtEdge} from './CdtEdge'
import {CdtFrontElement} from './CdtFrontElement'
import {CdtSite} from './CdtSite'
import {InCircle} from './CdtSweeper'
import {CdtTriangle} from './CdtTriangle'
import {EdgeTracer} from './EdgeTracer'

export class EdgeInserter {
  edge: CdtEdge

  triangles: Set<CdtTriangle>

  front: RBTree<CdtFrontElement>

  createEdgeDelegate: (a: CdtSite, b: CdtSite) => CdtEdge

  rightPolygon: Array<CdtSite> = new Array<CdtSite>()

  leftPolygon: Array<CdtSite> = new Array<CdtSite>()

  addedTriangles: Array<CdtTriangle> = new Array<CdtTriangle>()

  public constructor(
    edge: CdtEdge,
    triangles: Set<CdtTriangle>,
    front: RBTree<CdtFrontElement>,
    createEdgeDelegate: (a: CdtSite, b: CdtSite) => CdtEdge,
  ) {
    this.edge = edge
    this.triangles = triangles
    this.front = front
    this.createEdgeDelegate = createEdgeDelegate
  }

  public Run() {
    this.TraceEdgeThroughTriangles()
    this.TriangulatePolygon0(this.rightPolygon, this.edge.upperSite, this.edge.lowerSite, true)
    this.TriangulatePolygon0(this.leftPolygon, this.edge.upperSite, this.edge.lowerSite, false)
    this.UpdateFront()
  }

  UpdateFront() {
    const newFrontEdges = new Set<CdtEdge>()
    for (const t of this.addedTriangles) {
      for (const e of t.TriEdges) if (e.CwTriangle == null || e.CcwTriangle == null) newFrontEdges.add(e)
    }
    for (const e of newFrontEdges) this.AddEdgeToFront(e)
  }

  AddEdgeToFront(e: CdtEdge) {
    const leftSite = e.upperSite.point.x < e.lowerSite.point.x ? e.upperSite : e.lowerSite
    this.front.insert(new CdtFrontElement(leftSite, e))
  }

  TriangulatePolygon0(polygon: Array<CdtSite>, a: CdtSite, b: CdtSite, reverseTrangleWhenCompare: boolean) {
    if (polygon.length > 0) {
      this.TriangulatePolygon1(0, polygon.length - 1, polygon, a, b, reverseTrangleWhenCompare)
    }
  }

  TriangulatePolygon1(start: number, end: number, polygon: Array<CdtSite>, a: CdtSite, b: CdtSite, reverseTrangleWhenCompare: boolean) {
    //            if(CdtSweeper.db)
    //               CdtSweeper.ShowFront(triangles,front, Enumerable.Range(start, end-start+1).Select(i=> new Ellipse(10,10,polygon[i].point)).ToArray(), new[]{new LineSegment(a.point,b.point)});
    let c = polygon[start]
    let cIndex: number = start
    for (let i: number = start + 1; i <= end; i++) {
      const v = polygon[i]
      if (EdgeInserter.LocalInCircle(v, a, b, c, reverseTrangleWhenCompare)) {
        cIndex = i
        c = v
      }
    }

    const t = CdtTriangle.mkSSSD(a, b, c, this.createEdgeDelegate)
    this.triangles.add(t)
    this.addedTriangles.push(t)
    if (start < cIndex) {
      this.TriangulatePolygon1(start, cIndex - 1, polygon, a, c, reverseTrangleWhenCompare)
    }

    if (cIndex < end) {
      this.TriangulatePolygon1(cIndex + 1, end, polygon, c, b, reverseTrangleWhenCompare)
    }
  }

  static LocalInCircle(v: CdtSite, a: CdtSite, b: CdtSite, c: CdtSite, reverseTrangleWhenCompare: boolean): boolean {
    return reverseTrangleWhenCompare ? InCircle(v, a, c, b) : InCircle(v, a, b, c)
  }

  TraceEdgeThroughTriangles() {
    const edgeTracer = new EdgeTracer(this.edge, this.triangles, this.front, this.leftPolygon, this.rightPolygon)
    edgeTracer.Run()
  }
}
