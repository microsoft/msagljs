import {GeomGraph} from 'msagl-js'
import {UndoRedoAction} from './undoRedoAction'

export class ClustersCollapseExpandUndoRedoAction extends UndoRedoAction {
  //

  public constructor(geometryGraph: GeomGraph) {
    super(geometryGraph)
  }
}
