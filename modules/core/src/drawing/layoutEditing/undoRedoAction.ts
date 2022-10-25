import {GeomGraph} from '../../layout/core'
import {GeomObject} from '../../layout/core/geomObject'
import {Attribute} from '../../structs/attribute'
import {AttributeRegistry} from '../../structs/attributeRegistry'
import {Entity} from '../../structs/entity'
import {Assert} from '../../utils/assert'
import {DrawingObject} from '../drawingObject'
/** support for undo/redo functionality */
export class UndoRedoAction {
  private _canUndo = true // initially
  private changes = new Map<Entity, {old: Attribute; new: Attribute}[]>()

  get canRedo(): boolean {
    return !this.canUndo
  }
  /** readyForUndo = true means that the relevant objects, the keys of restoreDataDictionary, have old attributes, ready for undo
   *  readyForUndo = false means that the objects are in the new state
   */
  get canUndo() {
    return this._canUndo
  }
  set canUndo(v) {
    this._canUndo = v
  }

  /** creates an Array of affected objects */
  *entities(): IterableIterator<Entity> {
    yield* this.changes.keys()
  }

  has(o: Entity): boolean {
    return this.changes.has(o)
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
    Assert.assert(this.canRedo)
    for (const [e, v] of this.changes) {
      for (const pair of v) {
        const attr = pair.new
        attr.rebind(e)
      }
    }
    this.canUndo = true
  }

  /** It adds an entry for the entity if the changes does not contain the entity as a key
   *  Also, only one pair is added for each index.
   *  'old' will be restored by undo  */

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

  undo() {
    Assert.assert(this.canUndo)
    for (const [e, v] of this.changes) {
      for (const pair of v) {
        // prepare for redo as well
        pair.new = e.getAttr(registryIndexOfAttribue(pair.old)).clone()
        pair.old.rebind(e)
      }
    }
    this.canUndo = false
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
