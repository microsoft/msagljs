// the interface for undo objects

import {GeomGraph} from '../../layout/core'
import {GeomObject} from '../../layout/core/geomObject'
import {Rectangle} from '../../math/geometry'
import {Attribute} from '../../structs/attribute'
import {AttributeRegistry} from '../../structs/attributeRegistry'
import {Entity} from '../../structs/entity'
import {Graph} from '../../structs/graph'
import {Assert} from '../../utils/assert'
export class UndoRedoAction {
  static count = 0 // used for debug : TODO remove
  id: number // used for debug : TODO remove
  /** isOld = true means that the relevant objects, the keys of restoreDataDictionary, have old attributes
   *  isOld = false means that the objects are in the new state
   */
  get isOld() {
    // check that the the saved geometry is present in the current state
    for (const [e, attrs] of this.changes) {
      const geomAttr = e.getAttr(AttributeRegistry.GeomObjectIndex)
      for (const a of attrs) {
        if (geomAttr === a.old) return true
      }
      return false
    }
  }

  /** creates an Array of affected objects */
  *getAffectedEntities(): IterableIterator<Entity> {
    yield* this.changes.keys()
  }

  has(o: Entity): boolean {
    return this.changes.has(o)
  }

  constructor(graphPar: GeomGraph) {
    this.geomGraph = graphPar
    this.graphBoundingBoxBefore_ = this.geomGraph.boundingBox
    this.id = UndoRedoAction.count++
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

  redo() {
    if (this.graphBoundingBoxHasChanged) {
      this.geomGraph.boundingBox = this.graphBoundingBoxAfter
    }
  }

  protected changes = new Map<Entity, {old: Attribute; new: Attribute}[]>()

  /** it adds only when the key entity is not present */
  addRestoreData(entity: Entity, data: {old: Attribute; new: Attribute}[]) {
    if (!this.changes.has(entity)) {
      this.changes.set(entity, data)
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

  getAttribute(entity: Entity): any {
    return this.changes.get(entity)
  }

  // enumerates over all edited objects

  get EditedObjects(): IterableIterator<Entity> {
    return this.changes.keys()
  }

  graphBoundingBoxBefore_: Rectangle = Rectangle.mkEmpty()

  // the graph bounding box before the change

  get graphBoundingBoxBefore(): Rectangle {
    return this.graphBoundingBoxBefore_
  }
  set graphBoundingBoxBefore(value: Rectangle) {
    this.graphBoundingBoxBefore_ = value
  }

  graphBoundingBoxAfter_: Rectangle

  // the graph bounding box after the change
  get graphBoundingBoxAfter(): Rectangle {
    return this.graphBoundingBoxAfter_
  }
  set graphBoundingBoxAfter(value: Rectangle) {
    this.graphBoundingBoxAfter_ = value
  }

  // returns true if the was a change in the bounding box of the graph
  get graphBoundingBoxHasChanged(): boolean {
    return this.graphBoundingBoxAfter_ !== this.graphBoundingBoxBefore_
  }
  undo() {
    Assert.assert(this.isOld == false)
    for (const v of this.changes.values()) {
      for (const pair of v) {
        pair.old.rebind()
      }
    }
  }
}
