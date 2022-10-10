import {GeomEdge, GeomGraph} from '../../layout/core'
import {Graph} from '../../structs/graph'

import {EdgeRestoreData} from './edgeRestoreData'
import {UndoRedoAction} from './undoRedoAction'

export class EdgeDragUndoRedoAction extends UndoRedoAction {
  editedEdge: GeomEdge

  //  constructor

  public constructor(editedEdgePar: GeomEdge) {
    super(GeomGraph.getGeom(editedEdgePar.edge.parent as Graph))
    this.editedEdge = editedEdgePar
  }

  /**    undoes the editing*/
  public Undo() {
    this.Restore()
  }

  /**   redoes the editing*/
  public redo() {
    this.Restore()
  }

  Restore() {
    const erd = <EdgeRestoreData>this.getAttribute(this.editedEdge.edge)
    this.editedEdge.curve = erd.Curve
    this.editedEdge.underlyingPolyline = erd.UnderlyingPolyline
    if (this.editedEdge.sourceArrowhead != null) {
      this.editedEdge.sourceArrowhead.tipPosition = erd.ArrowheadAtSourcePosition
    }

    if (this.editedEdge.targetArrowhead != null) {
      this.editedEdge.targetArrowhead.tipPosition = erd.ArrowheadAtTargetPosition
    }
  }
}
