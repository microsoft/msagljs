import {GeomGraph} from '../../layout/core'
import {UndoRedoAction} from './undoRedoAction'

export class ClustersCollapseExpandUndoRedoAction extends UndoRedoAction {
  //

  public constructor(geometryGraph: GeomGraph) {
    super(geometryGraph)
  }
}
