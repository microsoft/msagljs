import {InsertionMode, IViewer} from './layoutEditing/iViewer'
import {IViewerEdge} from './layoutEditing/iViewerEdge'
import {IViewerGraph} from './layoutEditing/iViewerGraph'
import {IViewerNode} from './layoutEditing/iViewerNode'
import {IViewerObject} from './layoutEditing/iViewerObject'
import {LayoutEditor, viewerObj} from './layoutEditing/layoutEditor'
import {ModifierKeysEnum} from './layoutEditing/modifierKeys'

export {ArrowTypeEnum} from './arrowTypeEnum'
export {ShapeEnum} from './shapeEnum'
export {RankEnum} from './rankEnum'
export {StyleEnum} from './styleEnum'
export {DirTypeEnum} from './dirTypeEnum'
export {OrderingEnum} from './orderingEnum'
export {Color} from './color'
export {DrawingGraph} from './drawingGraph'
export {DrawingEdge} from './drawingEdge'
export {DrawingNode} from './drawingNode'
export {DrawingObject} from './drawingObject'
export type TextMeasurerOptions = {
  fontFamily: string
  fontSize: number
  lineHeight: number
  fontStyle: 'normal' | 'italic' | 'oblique'
  fontWeight: 'normal' | 'bold' | 'lighter' | 'bolder' | number
}
export {LayoutEditor, IViewer, IViewerEdge, IViewerGraph, IViewerNode, IViewerObject, ModifierKeysEnum, viewerObj, InsertionMode}
