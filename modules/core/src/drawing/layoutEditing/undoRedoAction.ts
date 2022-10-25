import {GeomGraph} from '../../layout/core'
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
/** support for undo/redo functionality */
export class UndoRedoAction {
  deleteIsEmpty(): boolean {
    return this.deletedEntities.size == 0
  }
  hasAttributeChanges(): boolean {
    return this.changesInAttributes.size > 0
  }
  private _canUndo = true // initially
  private changesInAttributes = new Map<Entity, {old: Attribute; new: Attribute}[]>()
  private deletedEntities = new Set<Entity>()
  get canRedo(): boolean {
    return !this._canUndo
  }
  /** canUndo = true means that the relevant objects, the keys of restoreDataDictionary, have old attributes, ready for undo
   *  canUndo = false means that the objects are in the new state
   */
  get canUndo() {
    return this._canUndo
  }
  set canUndo(v) {
    this._canUndo = v
  }

  /** creates an Array of affected objects */
  *entities(): IterableIterator<Entity> {
    yield* this.changesInAttributes.keys()
    yield* this.deletedEntities
  }

  has(o: Entity): boolean {
    return this.changesInAttributes.has(o)
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
    for (const [e, v] of this.changesInAttributes) {
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
    if (!this.changesInAttributes.has(entity)) {
      this.changesInAttributes.set(entity, [])
    }

    const index: number = registryIndexOfAttribue(old)
    const pairs = this.changesInAttributes.get(entity)
    if (pairs[index] != null) return

    pairs[index] = {old: old.clone(), new: null}
  }

  addGeomAttrForRedo(e: Entity) {
    const val = this.changesInAttributes.get(e)
    val[AttributeRegistry.GeomObjectIndex].new = e.getAttr(AttributeRegistry.GeomObjectIndex).clone()
  }

  undo() {
    Assert.assert(this.canUndo)
    for (const [e, v] of this.changesInAttributes) {
      for (const pair of v) {
        // prepare for redo as well
        pair.new = e.getAttr(registryIndexOfAttribue(pair.old)).clone()
        pair.old.rebind(e)
      }
    }
    for (const e of this.deletedEntities) {
      restoreEntity(e)
    }
    this.canUndo = false
  }
  registerDelete(e: Entity) {
    this.deletedEntities.add(e)
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
function restoreEntity(e: Entity) {
  if (e instanceof Label) {
    const edge = <Edge>e.parent
    edge.label = e
  } else if (e instanceof Node) {
    const graph = e.parent as Graph
    graph.addNode(e)
  } else if (e instanceof Edge) e.add()
}
