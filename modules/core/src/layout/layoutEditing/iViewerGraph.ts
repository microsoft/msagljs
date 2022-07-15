import {Graph} from '../../structs/graph'
import {IViewerObject} from './iViewerObject'

export interface IViewerGraph extends IViewerObject {
  graph: Graph
}
