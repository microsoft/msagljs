// the interface for undo objects

import {GeomGraph} from '../../layout/core'
import {GeomObject} from '../../layout/core/geomObject'
import {Attribute} from '../../structs/attribute'
import {AttributeRegistry} from '../../structs/attributeRegistry'
import {Entity} from '../../structs/entity'
import {Graph} from '../../structs/graph'
import {Assert} from '../../utils/assert'
export class UndoRedoAction {
  private _readyForUndo: boolean
  addNewAttr(e: any) {
    const val = this.changes.get(e)
    val[AttributeRegistry.GeomObjectIndex].new = e.getAttr(AttributeRegistry.GeomObjectIndex).clone()
  }
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
    Assert.assert(this.readyForUndo)
    for (const [e, v] of this.changes) {
      for (const pair of v) {
        const attr = pair.new
        attr.rebind(e)
      }
    }
  }

  protected changes = new Map<Entity, {old: Attribute; new: Attribute}[]>()

  /** it adds only when the key entity is not present */
  addOldNewPair(entity: Entity, pair: {old: Attribute; new: Attribute}) {
    if (!this.changes.has(entity)) {
      this.changes.set(entity, [])
    }
    this.changes.get(entity).push(pair)
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

  undo() {
    Assert.assert(this.readyForUndo == false)
    for (const [e, v] of this.changes) {
      for (const pair of v) {
        pair.old.rebind(e)
      }
    }
  }
}
