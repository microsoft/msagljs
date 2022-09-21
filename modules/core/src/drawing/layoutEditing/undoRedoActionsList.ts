import {UndoRedoAction} from './undoRedoAction'

export class UndoRedoActionsList {
  currentUndo: UndoRedoAction

  get CurrentUndo(): UndoRedoAction {
    return this.currentUndo
  }
  set CurrentUndo(value: UndoRedoAction) {
    this.currentUndo = value
  }

  currentRedo: UndoRedoAction

  get CurrentRedo(): UndoRedoAction {
    return this.currentRedo
  }
  set CurrentRedo(value: UndoRedoAction) {
    this.currentRedo = value
  }

  AddAction(action: UndoRedoAction): UndoRedoAction {
    if (this.CurrentUndo != null) {
      this.CurrentUndo.Next = action
    }

    action.Previous = this.CurrentUndo
    this.CurrentUndo = action
    this.CurrentRedo = null
    return action
  }
}
