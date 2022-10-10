import {UndoRedoAction} from './undoRedoAction'

export class UndoList {
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
