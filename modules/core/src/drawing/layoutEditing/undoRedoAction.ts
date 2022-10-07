// the interface for undo objects

import {GeomGraph} from '../../layout/core'
import {GeomObject} from '../../layout/core/geomObject'
import {Rectangle} from '../../math/geometry'
import {Entity} from '../../structs/entity'
import {Graph} from '../../structs/graph'

export class UndoRedoAction {
  /** creates an Array of affected objects */
  *getAffectedObjects(): IterableIterator<Entity> {
    yield* this.restoreDataDictionary.keys()
  }

  hasAffectedObject(o: Entity): boolean {
    return this.restoreDataDictionary.has(o)
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

  protected restoreDataDictionary = new Map<Entity, any>()

  /** it adds only when the key entity is not present */
  AddRestoreData(entity: Entity, restoreData: any) {
    if (!this.restoreDataDictionary.has(entity)) {
      this.restoreDataDictionary.set(entity, restoreData)
    }
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

  GetRestoreData(entity: Entity): any {
    return this.restoreDataDictionary.get(entity)
  }

  // enumerates over all edited objects

  get EditedObjects(): IterableIterator<Entity> {
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
    return this.graphBoundingBoxAfter !== this.graphBoundingBoxBefore
  }
}
