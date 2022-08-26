import {GeomGraph} from '../core/geomGraph'
import {UndoRedoAction} from './undoRedoAction'

export class ClustersCollapseExpandUndoRedoAction extends UndoRedoAction {
  ///  <summary>
  ///
  ///  </summary>
  ///  <param name="geometryGraph"></param>
  public constructor(geometryGraph: GeomGraph) {
    super(geometryGraph)
  }
}
