import {AttributeRegistry} from '../../structs/attributeRegistry'
import {Entity} from '../../structs/entity'
import {Assert} from '../../utils/assert'
import {UndoRedoAction} from './undoRedoAction'

export class UndoList {
  *entitiesToBeChangedByRedo(): IterableIterator<Entity> {
    if (this.currentBridge == null) return
    if (this.currentBridge.readyForRedo) {
      yield* this.currentBridge.entities()
    } else if (this.currentBridge.next != null && this.currentBridge.next.readyForRedo) {
      yield* this.currentBridge.next.entities()
    }
  }
  *entitiesToBeChangedByUndo(): IterableIterator<Entity> {
    if (this.currentBridge == null) return
    if (this.currentBridge.readyForUndo) {
      yield* this.currentBridge.entities()
    } else if (this.currentBridge.prev != null && this.currentBridge.prev.readyForUndo) {
      yield* this.currentBridge.prev.entities()
    }
  }
  private currentBridge: UndoRedoAction

  /** registers some attributes of the entity for undo */
  registerForUndo(e: Entity) {
    if (this.currentBridge == null) {
      this.currentBridge = new UndoRedoAction()
    }
    this.currentBridge.addOldNewPair(e, e.getAttr(AttributeRegistry.GeomObjectIndex))
  }
  canUndo(): boolean {
    if (this.currentBridge == null) return false
    if (this.currentBridge.readyForUndo) return true
    if (this.currentBridge.prev != null && this.currentBridge.prev.readyForUndo) return true
    return false
  }
  canRedo(): boolean {
    if (this.currentBridge == null) return false
    if (this.currentBridge.readyForRedo) return true
    if (this.currentBridge.next != null && this.currentBridge.next.readyForRedo) return true
    return false
  }
  undo() {
    if (this.currentBridge.readyForUndo) {
      this.currentBridge.undo()
    } else {
      this.currentBridge.prev.undo()
    }

    if (this.currentBridge.prev) this.currentBridge = this.currentBridge.prev
  }

  redo() {
    if (this.currentBridge.readyForRedo) {
      this.currentBridge.redo()
    } else {
      this.currentBridge.next.redo()
    }

    if (this.currentBridge.next) {
      this.currentBridge = this.currentBridge.next
    }
  }

  /** adds the "action" ufter the currentUndo and sets currentUndo=action */
  addAction(): UndoRedoAction {
    const action = new UndoRedoAction()
    if (!this.currentBridge) {
      this.currentBridge = action
    } else if (this.currentBridge.readyForUndo) {
      this.currentBridge.next = action
      action.prev = this.currentBridge
      this.currentBridge = action
    } else {
      Assert.assert(this.currentBridge.readyForRedo)
      // we need to discard this.currentBridge as it is undone already
      const prev = this.currentBridge.prev
      if (prev) {
        action.prev = prev
        prev.next = action
      }
      this.currentBridge = action
    }
    return action
  }
}
