import {EventHandler} from '../../layout/core/geomObject'
import {IViewerObject} from './iViewerObject'
import {Node} from './../../structs/node'
export interface IViewerNode extends IViewerObject {
  node: Node
  IsCollapsedChanged: EventHandler // TODO:should it be in IViewerGraph
}
