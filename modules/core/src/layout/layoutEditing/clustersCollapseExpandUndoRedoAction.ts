import {GeomGraph} from '../core/geomGraph'
import {UndoRedoAction} from './undoRedoAction'

export class ClustersCollapseExpandUndoRedoAction extends UndoRedoAction {
  //

  public constructor(geometryGraph: GeomGraph) {
    super(geometryGraph)
  }
}
