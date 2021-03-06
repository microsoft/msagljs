// the interface for undo objects

import {Rectangle} from '../../math/geometry'
import {Graph} from '../../structs/graph'
import {GeomGraph} from '../core'
import {GeomObject} from '../core/geomObject'
import {IViewerObject} from './iViewerObject'
import {RestoreData} from './restoreData'

export class UndoRedoAction {
  // the set of the objects that the viewer has to invalidate
  affectedObjects: Set<IViewerObject> = new Set<IViewerObject>()

  hasAffectedObject(o: IViewerObject): boolean {
    return this.affectedObjects.has(o)
  }

  AddAffectedObject(o: IViewerObject) {
    this.affectedObjects.add(o)
  }

  RemoveAffectedObject(o: IViewerObject) {
    this.affectedObjects.delete(o)
  }

  ClearAffectedObjects() {
    this.affectedObjects.clear()
  }

  constructor(graphPar: GeomGraph) {
    this.geomGraph = graphPar
    this.graphBoundingBoxBefore = this.geomGraph.boundingBox
  }

  graph: GeomGraph

  // the graph being edited

  get geomGraph(): GeomGraph {
    return this.graph
  }
  set geomGraph(value: GeomGraph) {
    this.graph = value
  }

  next: UndoRedoAction

  prev: UndoRedoAction

  // Undoes the action
  Undo() {
    if (this.GraphBoundingBoxHasChanged) {
      this.geomGraph.boundingBox = this.GraphBoundingBoxBefore
    }
  }

  // Redoes the action

  Redo() {
    if (this.GraphBoundingBoxHasChanged) {
      this.geomGraph.boundingBox = this.GraphBoundingBoxAfter
    }
  }

  // The pointer to the next undo object
  get Next(): UndoRedoAction {
    return this.next
  }
  set Next(value: UndoRedoAction) {
    this.next = value
  }

  // The pointer to the previous undo object
  get Previous(): UndoRedoAction {
    return this.prev
  }

  set Previous(value: UndoRedoAction) {
    this.prev = value
  }

  protected restoreDataDictionary: Map<GeomObject, RestoreData> = new Map<GeomObject, RestoreData>()

  AddRestoreData(msaglObject: GeomObject, restoreData: RestoreData) {
    // do nothing at the moment
    // this.restoreDataDictionary.set(msaglObject, restoreData)
  }

  private static GetParentGraph(geomObj: GeomObject): GeomGraph {
    let ent = geomObj.entity.parent
    do {
      if (ent instanceof Graph) {
        return GeomGraph.getGeom(ent)
      }
      if (ent == null) return null
      ent = ent.parent
    } while (true)
  }

  GetRestoreData(msaglObject: GeomObject): RestoreData {
    return this.restoreDataDictionary.get(msaglObject)
  }

  // enumerates over all edited objects

  get EditedObjects(): IterableIterator<GeomObject> {
    return this.restoreDataDictionary.keys()
  }

  graphBoundingBoxBefore: Rectangle = Rectangle.mkEmpty()

  // the graph bounding box before the change

  get GraphBoundingBoxBefore(): Rectangle {
    return this.graphBoundingBoxBefore
  }
  set GraphBoundingBoxBefore(value: Rectangle) {
    this.graphBoundingBoxBefore = value
  }

  graphBoundingBoxAfter: Rectangle

  // the graph bounding box after the change
  get GraphBoundingBoxAfter(): Rectangle {
    return this.graphBoundingBoxAfter
  }
  set GraphBoundingBoxAfter(value: Rectangle) {
    this.graphBoundingBoxAfter = value
  }

  // returns true if the was a change in the bounding box of the graph
  get GraphBoundingBoxHasChanged(): boolean {
    return this.graphBoundingBoxAfter != this.graphBoundingBoxBefore
  }
}
