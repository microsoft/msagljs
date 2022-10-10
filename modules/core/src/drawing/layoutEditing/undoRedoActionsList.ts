import {Entity} from '../../structs/entity'
import {UndoRedoAction} from './undoRedoAction'

export class UndoList {
  registerForUndo(e: Entity) {
    if (this.currentUndo == null) {
      this.currentUndo = new UndoRedoAction()
    }
    this.currentUndo.addOldNewPair
  }
  canUndo(): boolean {
    if (this.currentUndo == null) return false
    return this.currentUndo.isNew
    return false
  }
  canRedo(): boolean {
    if (this.currentUndo == null) return false
    if (this.currentUndo.isOld) return true
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

  AddAction(action: UndoRedoAction): UndoRedoAction {
    if (this.currentUndo != null) {
      this.currentUndo.next = action
    }

    action.prev = this.currentUndo
    this.currentUndo = action
    return action
  }
}
