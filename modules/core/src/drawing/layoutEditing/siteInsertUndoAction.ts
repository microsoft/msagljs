import {GeomEdge, GeomGraph} from '../../layout/core'
import {Point} from '../../math/geometry'
import {CornerSite} from '../../math/geometry/cornerSite'
import {Graph} from '../../structs/graph'

import {GeometryGraphEditor} from './geomGraphEditor'
import {UndoRedoAction} from './undoRedoAction'

export class SiteInsertUndoAction extends UndoRedoAction {
  insertedSite: CornerSite

  insertionPoint: Point

  prevSite: CornerSite

  get PrevSite(): CornerSite {
    return this.prevSite
  }
  set PrevSite(value: CornerSite) {
    this.prevSite = value
  }

  siteKPrevious: number

  //  k - the coefficient giving the start and the end spline points

  public get SiteKPrevious(): number {
    return this.siteKPrevious
  }
  public set SiteKPrevious(value: number) {
    this.siteKPrevious = value
  }

  siteKNext: number

  //  k - the coefficient giving the start and the end spline points

  public get SiteKNext(): number {
    return this.siteKNext
  }
  public set SiteKNext(value: number) {
    this.siteKNext = value
  }

  //  The point where the new polyline corner was inserted

  public get InsertionPoint(): Point {
    return this.insertionPoint
  }
  public set InsertionPoint(value: Point) {
    this.insertionPoint = value
  }

  private get /* internal */ InsertedSite(): CornerSite {
    return this.insertedSite
  }
  private set /* internal */ InsertedSite(value: CornerSite) {
    this.insertedSite = value
    this.InsertionPoint = this.insertedSite.point
    this.SiteKNext = this.insertedSite.nextBezierCoefficient
    this.SiteKPrevious = this.insertedSite.previouisBezierCoefficient
    this.PrevSite = this.insertedSite.prev
  }

  editedEdge: GeomEdge

  //  Constructor. At the moment of the constructor call the site should not be inserted yet

  public constructor(edgeToEdit: GeomEdge) {
    super(GeomGraph.getGeom(edgeToEdit.edge.parent as Graph))
    this.editedEdge = edgeToEdit
    this.AddRestoreData(this.editedEdge.edge, null) // RestoreHelper.GetRestoreData(this.editedEdge))
  }

  //  undoes the editing

  public Undo() {
    const prev: CornerSite = this.InsertedSite.prev
    const next: CornerSite = this.InsertedSite.next
    prev.next = next
    next.prev = prev
    GeometryGraphEditor.DragEdgeWithSite(new Point(0, 0), this.editedEdge, prev)
  }

  //  redoes the editing

  public Redo() {
    this.insertedSite = CornerSite.mkSiteSPS(this.PrevSite, this.InsertionPoint, this.PrevSite.next)
    this.insertedSite.nextBezierCoefficient = this.SiteKNext
    this.insertedSite.previouisBezierCoefficient = this.SiteKPrevious
    GeometryGraphEditor.DragEdgeWithSite(new Point(0, 0), this.editedEdge, this.insertedSite)
  }
}
