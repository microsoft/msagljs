import {GeomEdge, GeomGraph} from '../../layout/core'
import {Point} from '../../math/geometry'
import {CornerSite} from '../../math/geometry/cornerSite'
import {Graph} from '../../structs/graph'

import {GeometryGraphEditor} from './geomGraphEditor'
import {UndoRedoAction} from './undoRedoAction'

export class SiteRemoveUndoAction extends UndoRedoAction {
  removedSite: CornerSite

  get RemovedSite(): CornerSite {
    return this.removedSite
  }
  set RemovedSite(value: CornerSite) {
    this.removedSite = value
  }

  editedEdge: GeomEdge

  //  At the moment of the constructor call the site should not be inserted yet

  public constructor(geomEdge: GeomEdge) {
    super(GeomGraph.getGeom(geomEdge.edge.parent as Graph) as GeomGraph)
    this.editedEdge = geomEdge
    this.AddRestoreData(this.editedEdge.edge, null /*RestoreHelper.GetRestoreData(this.editedEdge)*/)
  }

  /**  undoes the editing*/

  public Undo() {
    const prev: CornerSite = this.RemovedSite.prev
    const next: CornerSite = this.RemovedSite.next
    prev.next = this.RemovedSite
    next.prev = this.RemovedSite
    GeometryGraphEditor.DragEdgeWithSite(new Point(0, 0), this.editedEdge, prev)
  }

  /**   redoes the editing*/

  public Redo() {
    const prev: CornerSite = this.RemovedSite.prev
    const next: CornerSite = this.RemovedSite.next
    prev.next = next
    next.prev = prev
    GeometryGraphEditor.DragEdgeWithSite(new Point(0, 0), this.editedEdge, prev)
  }
}
