import {GeomGraph, GeomNode, GeomEdge, GeomLabel} from '../../layout/core'
import {GeomObject} from '../../layout/core/geomObject'
import {Entity} from '../../structs/entity'
import {EdgeRestoreData} from './edgeRestoreData'
import {LabelRestoreData} from './labelRestoreData'
import {NodeRestoreData} from './nodeRestoreData'
import {UndoRedoAction} from './undoRedoAction'

export class ObjectDragUndoRedoAction extends UndoRedoAction {
  BoundingBoxChanges: boolean

  public constructor(geometryGraph: GeomGraph) {
    super(geometryGraph)
  }

  //  Undoes the editing

  public Undo() {
    super.Undo()
    this.ClearAffectedObjects()
    const restDictionary = this.CloneRestoreDictionary()
    for (const kv of restDictionary) {
      ObjectDragUndoRedoAction.RestoreOnKevValue(kv)
    }
  }

  static RestoreOnKevValue(kv: [Entity, LabelRestoreData | NodeRestoreData | EdgeRestoreData]) {
    const geomObj = GeomObject.getGeom(kv[0])
    if (geomObj instanceof GeomNode) {
      geomObj.boundaryCurve = (kv[1] as NodeRestoreData).BoundaryCurve
    } else if (geomObj instanceof GeomEdge) {
      const erd = <EdgeRestoreData>kv[1]
      geomObj.curve = erd.Curve
      geomObj.underlyingPolyline = erd.UnderlyingPolyline
      if (geomObj.sourceArrowhead != null) {
        geomObj.sourceArrowhead.tipPosition = erd.ArrowheadAtSourcePosition
      }

      if (geomObj.targetArrowhead != null) {
        geomObj.targetArrowhead.tipPosition = erd.ArrowheadAtTargetPosition
      }
    } else if (geomObj instanceof GeomLabel) {
      const lrd = <LabelRestoreData>kv[1]
      geomObj.positionCenter(lrd.Center)
    } else {
      throw new Error('not implemented')
    }
  }

  CloneRestoreDictionary(): Map<Entity, LabelRestoreData | NodeRestoreData | EdgeRestoreData | LabelRestoreData> {
    return new Map<Entity, any>(this.restoreDataDictionary)
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
