import {IViewerObject} from './iViewerObject'
import {Node} from '../../structs/node'
import {EventHandler} from './eventHandler'
export interface IViewerNode extends IViewerObject {
  node: Node
  IsCollapsedChanged: EventHandler
}
