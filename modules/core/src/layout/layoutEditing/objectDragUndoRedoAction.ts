import {GeomNode, GeomEdge, GeomLabel, GeomGraph} from '../core'
import {GeomObject} from '../core/geomObject'
import {EdgeRestoreData} from './edgeRestoreData'
import {LabelRestoreData} from './labelRestoreData'
import {NodeRestoreData} from './nodeRestoreData'
import {RestoreData} from './restoreData'
import {UndoRedoAction} from './undoRedoAction'

export class ObjectDragUndoRedoAction extends UndoRedoAction {
  BoundingBoxChanges: boolean

  public constructor(geometryGraph: GeomGraph) {
    super(geometryGraph)
  }

  //  Undoes the editing

  public /* override */ Undo() {
    super.Undo()
    this.ClearAffectedObjects()
    const restDictionary = this.CloneRestoreDictionary()
    for (const kv of restDictionary) {
      ObjectDragUndoRedoAction.RestoreOnKevValue(kv)
    }
  }

  static RestoreOnKevValue(kv: [GeomObject | GeomLabel, RestoreData]) {
    if (kv[1].Action != null) {
      kv[1].Action()
      return
    }

    const geomObj = kv[0]
    const node = <GeomNode>geomObj
    if (geomObj instanceof GeomNode) {
      node.boundaryCurve = (kv[1] as NodeRestoreData).BoundaryCurve
    } else {
      const edge = <GeomEdge>geomObj
      if (edge != null) {
        const erd = <EdgeRestoreData>kv[1]
        edge.curve = erd.Curve
        edge.underlyingPolyline = erd.UnderlyingPolyline
        if (edge.sourceArrowhead != null) {
          edge.sourceArrowhead.tipPosition = erd.ArrowheadAtSourcePosition
        }

        if (edge.targetArrowhead != null) {
          edge.targetArrowhead.tipPosition = erd.ArrowheadAtTargetPosition
        }
      } else {
        const label = <GeomLabel>geomObj
        if (label != null) {
          const lrd = <LabelRestoreData>kv[1]
          label.center = lrd.Center
        } else {
          throw new Error('not implemented')
        }
      }
    }
  }

  CloneRestoreDictionary(): Map<GeomObject, RestoreData> {
    return new Map<GeomObject, RestoreData>(this.restoreDataDictionary)
  }

  Redo() {
    super.Redo()
    this.ClearAffectedObjects()
    const dict = this.CloneRestoreDictionary()
    for (const restoreData of dict) {
      ObjectDragUndoRedoAction.RestoreOnKevValue(restoreData)
    }
  }
}
