import {IViewerObject} from './iViewerObject'
import {Node, EventHandler} from 'msagl-js'
export interface IViewerNode extends IViewerObject {
  node: Node
  IsCollapsedChanged: EventHandler
}
