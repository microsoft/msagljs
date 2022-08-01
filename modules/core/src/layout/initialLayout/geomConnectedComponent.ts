import {Point, Rectangle} from '../../math/geometry'
import {Node} from '../..'
import {IGeomGraph} from './iGeomGraph'

export class GeomConnectedComponent implements IGeomGraph {
  RectangularBoundary: any
  topNodes: Node[]
  constructor(topNodes: Node[]) {
    this.topNodes = topNodes
  }
  shallowNodeCount: number
  translate(delta: Point) {
    throw new Error('Method not implemented.')
  }
  boundingBox: Rectangle
}
