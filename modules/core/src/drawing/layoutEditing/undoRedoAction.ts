import {GeomObject} from '../../layout/core/geomObject'
import {Attribute} from '../../structs/attribute'
import {AttributeRegistry} from '../../structs/attributeRegistry'
import {Edge} from '../../structs/edge'
import {Entity} from '../../structs/entity'
import {Graph} from '../../structs/graph'
import {Node} from '../../structs/node'
import {Label} from '../../structs/label'
import {Assert} from '../../utils/assert'
import {DrawingObject} from '../drawingObject'
import {EdgeNudger} from '../../routing/spline/bundling/EdgeNudger'
type UndoChangeData = Map<Entity, {old: Attribute; new: Attribute}[]>
type UndoDeleteData = {deletedEnts: Set<Entity>}
type UndoInsertData = {insertedEnts: Set<Entity>}
type UndoData = UndoChangeData | UndoDeleteData | UndoInsertData
/** support for undo/redo functionality */
export class UndoRedoAction {
  undo() {
    Assert.assert(this.canUndo)
    if (this.data instanceof Map) {
      for (const [e, v] of this.data) {
        for (const pair of v) {
          // prepare for redo as well
          pair.new = e.getAttr(registryIndexOfAttribue(pair.old)).clone()
          pair.old.rebind(e)
        }
      }
    } else if ('deletedEnts' in this.data) {
      for (const e of this.data.deletedEnts) {
        restoreEntity(e)
      }
    } else if ('insertedEnts' in this.data) {
      throw new Error('not implemented')
    } else {
      throw new Error('unexpected undo data')
    }

    this.canUndo = false
  }
  redo() {
    Assert.assert(this.canRedo)
    if (this.data instanceof Map) {
      for (const [e, v] of this.data) {
        for (const pair of v) {
          const attr = pair.new
          attr.rebind(e)
        }
      }
    } else if ('deletedEnts' in this.data) {
      for (const ent of this.data.deletedEnts) {
        if (ent instanceof Node) {
          const graph = ent.parent as Graph
          graph.removeNode(ent)
        } else if (ent instanceof Edge) {
          ent.remove()
        } else if (ent instanceof Label) {
          const edge = ent.parent as Edge
          edge.label = null
        } else {
          throw new Error('unexpected type in redo')
        }
      }
    }
    this.canUndo = true
  }
  /** It adds an entry for the entity if the changes does not contain the entity as a key
   *  Also, only one pair is added for each index.
   *  'old' will be restored by undo  */

  addOldNewPair(entity: Entity, old: Attribute) {
    if (!this.data) {
      this.data = new Map<Entity, {old: Attribute; new: Attribute}[]>()
    }
    const changesInAttributes = this.data as UndoChangeData
    if (!changesInAttributes.has(entity)) {
      changesInAttributes.set(entity, [])
    }

    const index: number = registryIndexOfAttribue(old)
    const pairs = changesInAttributes.get(entity)
    if (pairs[index] != null) return
    pairs[index] = {old: old.clone(), new: null}
  }

  registerDelete(entity: Entity) {
    if (!this.data) this.data = {deletedEnts: new Set<Entity>()}

    const dd = this.data as UndoDeleteData
    dd.deletedEnts.add(entity)
  }
  private _canUndo = true // initially

  get canRedo(): boolean {
    return !this._canUndo
  }
  /** canUndo = true means that the relevant objects, the keys of restoreDataDictionary, have 'old' attributes set up: ready for undo
   *  canUndo = false means that the undo has been done already:
   */
  get canUndo() {
    return this._canUndo
  }
  set canUndo(v) {
    this._canUndo = v
  }

  data: UndoData;

  /** iterates over the affected objects */
  *entities(): IterableIterator<Entity> {
    if (!this.data) return
    if (this.data instanceof Map) yield* this.data.keys()
    else if ('deletedEnts' in this.data) yield* this.data.deletedEnts
    else if ('insertedEnts' in this.data) yield* this.data.insertedEnts
  }

  next: UndoRedoAction

  prev: UndoRedoAction
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
function restoreEntity(e: Entity) {
  if (e instanceof Label) {
    const edge = <Edge>e.parent
    edge.label = e
  } else if (e instanceof Node) {
    const graph = e.parent as Graph
    graph.addNode(e)
  } else if (e instanceof Edge) e.add()
}
