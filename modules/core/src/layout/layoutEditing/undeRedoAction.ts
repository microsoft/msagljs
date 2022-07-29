import {Rectangle} from '../../math/geometry'
import {GeomGraph} from '../core'
import {GeomObject} from '../core/geomObject'
import {IViewerObject} from './iViewerObject'
import {RestoreData} from './restoreData'

export class UndoRedoAction {
  affectedObjects: Set<IViewerObject> = new Set<IViewerObject>()

  //  the set of the objects that the viewer has to invalidate

  get AffectedObjects(): Iterable<IViewerObject> {
    return this.affectedObjects
  }

  ContainsAffectedObject(o: IViewerObject): boolean {
    return this.affectedObjects.has(o)
  }

  AddAffectedObject(o: IViewerObject) {
    this.affectedObjects
    // TODO: lock is not supported at this time
    this.affectedObjects.add(o)
  }

  RemoveAffectedObject(o: IViewerObject) {
    this.affectedObjects
    this.affectedObjects.delete(o)
  }

  ClearAffectedObjects() {
    this.affectedObjects
    // TODO: lock is not supported at this time
    this.affectedObjects.clear()
  }

  constructor(graphPar: GeomGraph) {
    this.Graph = graphPar
    this.graphBoundingBoxBefore = this.Graph.boundingBox
  }

  graph: GeomGraph

  //  the graph being edited

  public get Graph(): GeomGraph {
    return this.graph
  }
  public set Graph(value: GeomGraph) {
    this.graph = value
  }

  next: UndoRedoAction

  prev: UndoRedoAction

  //  Undoes the action

  publicUndo() {
    if (this.GraphBoundingBoxHasChanged) {
      this.Graph.boundingBox = this.GraphBoundingBoxBefore
    }
  }

  //  Redoes the action

  public /* virtual */ Redo() {
    if (this.GraphBoundingBoxHasChanged) {
      this.Graph.boundingBox = this.GraphBoundingBoxAfter
    }
  }

  //  The pointer to the next undo object

  public get Next(): UndoRedoAction {
    return this.next
  }
  public set Next(value: UndoRedoAction) {
    this.next = value
  }

  //  The pointer to the previous undo object

  public get Previous(): UndoRedoAction {
    return this.prev
  }
  public set Previous(value: UndoRedoAction) {
    this.prev = value
  }

  //

  protected restoreDataDictionary: Map<GeomObject, RestoreData> = new Map<GeomObject, RestoreData>()

  AddRestoreData(msaglObject: GeomObject, restoreData: RestoreData) {
    this.restoreDataDictionary.set(msaglObject, restoreData)
  }

  GetRestoreData(msaglObject: GeomObject): RestoreData {
    return this.restoreDataDictionary.get(msaglObject)
  }

  //  enumerates over all edited objects

  public get EditedObjects(): Iterable<GeomObject> {
    return this.restoreDataDictionary.keys()
  }

  graphBoundingBoxBefore: Rectangle

  //  the graph bounding box before the change

  public get GraphBoundingBoxBefore(): Rectangle {
    return this.graphBoundingBoxBefore
  }
  public set GraphBoundingBoxBefore(value: Rectangle) {
    this.graphBoundingBoxBefore = value
  }

  graphBoundingBoxAfter: Rectangle

  //  the graph bounding box after the change

  public get GraphBoundingBoxAfter(): Rectangle {
    return this.graphBoundingBoxAfter
  }
  public set GraphBoundingBoxAfter(value: Rectangle) {
    this.graphBoundingBoxAfter = value
  }

  //  returns true if the was a change in the bounding box of the graph

  public get GraphBoundingBoxHasChanged(): boolean {
    return this.graphBoundingBoxAfter !== this.graphBoundingBoxBefore
  }
}
