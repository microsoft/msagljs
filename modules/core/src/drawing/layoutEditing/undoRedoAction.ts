// the interface for undo objects

import {GeomGraph} from '../../layout/core'
import {GeomObject} from '../../layout/core/geomObject'
import {Attribute} from '../../structs/attribute'
import {AttributeRegistry} from '../../structs/attributeRegistry'
import {Entity} from '../../structs/entity'
import {Assert} from '../../utils/assert'
import {DrawingObject} from '../drawingObject'
export class UndoRedoAction {
  private _readyForUndo = true // initially

  static count = 0 // used for debug : TODO remove
  id: number // used for debug : TODO remove
  get readyForRedo(): boolean {
    return !this.readyForUndo
  }
  /** readyForUndo = true means that the relevant objects, the keys of restoreDataDictionary, have old attributes, ready for undo
   *  readyForUndo = false means that the objects are in the new state
   */
  get readyForUndo() {
    return this._readyForUndo
  }
  set readyForUndo(v) {
    this._readyForUndo = v
  }

  /** creates an Array of affected objects */
  *entities(): IterableIterator<Entity> {
    yield* this.changes.keys()
  }

  has(o: Entity): boolean {
    return this.changes.has(o)
  }

  constructor() {
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
    Assert.assert(this.readyForRedo)
    for (const [e, v] of this.changes) {
      for (const pair of v) {
        const attr = pair.new
        attr.rebind(e)
      }
    }
    this.readyForUndo = true
  }

  protected changes = new Map<Entity, {old: Attribute; new: Attribute}[]>()

  /** It adds an entry for the entity if the changes does not contain the entity as a key
   *  Also, only one pair is added for each index.
   * old plays the role of 'old' field of the pair  */

  addOldNewPair(entity: Entity, old: Attribute) {
    if (!this.changes.has(entity)) {
      this.changes.set(entity, [])
    }

    const index: number = registryIndexOfAttribue(old)
    const pairs = this.changes.get(entity)
    if (pairs[index] != null) return

    pairs[index] = {old: old.clone(), new: null}
  }

  addGeomAttrForRedo(e: Entity) {
    const val = this.changes.get(e)
    val[AttributeRegistry.GeomObjectIndex].new = e.getAttr(AttributeRegistry.GeomObjectIndex).clone()
  }

  getAttribute(entity: Entity): any {
    return this.changes.get(entity)
  }

  // enumerates over all edited objects

  get EditedObjects(): IterableIterator<Entity> {
    return this.changes.keys()
  }

  undo() {
    Assert.assert(this.readyForUndo)
    for (const [e, v] of this.changes) {
      for (const pair of v) {
        // prepare for redo as well
        pair.new = e.getAttr(registryIndexOfAttribue(pair.old)).clone()
        pair.old.rebind(e)
      }
    }
    this.readyForUndo = false
  }
}
function registryIndexOfAttribue(old: Attribute) {
  let index: number
  if (old instanceof GeomObject) index = AttributeRegistry.GeomObjectIndex
  else if (old instanceof DrawingObject) index = AttributeRegistry.DrawingObjectIndex
  else {
    // todo: enforce type here
    index = AttributeRegistry.ViewerIndex
  }
  return index
}
