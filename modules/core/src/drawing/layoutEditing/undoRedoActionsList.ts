import {AttributeRegistry} from '../../structs/attributeRegistry'
import {Entity} from '../../structs/entity'
import {UndoRedoAction} from './undoRedoAction'

export class UndoList {
  /** registers some attributes of the entity for undo */
  registerForUndo(e: Entity) {
    if (this.currentUndo == null) {
      this.currentUndo = new UndoRedoAction()
    }
    this.currentUndo.addOldNewPair(e, e.getAttr(AttributeRegistry.GeomObjectIndex))
  }
  canUndo(): boolean {
    if (this.currentUndo == null) return false
    return this.currentUndo.readyForRedo
    return false
  }
  canRedo(): boolean {
    if (this.currentUndo == null) return false
    if (this.currentUndo.readyForUndo) return true
    return false
  }
  undo() {
    this.currentUndo.undo()
    if (this.currentUndo.prev) this.currentUndo = this.currentUndo.prev
  }

  redo() {
    this.currentUndo.redo()
    if (this.currentUndo.next) {
      this.currentUndo = this.currentUndo.next
    }
  }

  currentUndo: UndoRedoAction

  /** adds the "action" ufter the currentUndo and sets currentUndo=action */
  addAction(action: UndoRedoAction): UndoRedoAction {
    if (this.currentUndo != null) {
      this.currentUndo.next = action
    }

    action.prev = this.currentUndo
    this.currentUndo = action
    return action
  }
}
