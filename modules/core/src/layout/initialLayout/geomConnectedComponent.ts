import {Point, Rectangle} from '../../math/geometry'
import {GeomNode, Node} from '../..'
import {IGeomGraph} from './iGeomGraph'

export class GeomConnectedComponent implements IGeomGraph {
  RectangularBoundary: any
  topNodes: Node[]
  constructor(topNodes: Node[]) {
    this.topNodes = topNodes
  }
  uniformMargins: number
  edges() {
    throw new Error('Method not implemented.')
  }
  shallowNodes(): Iterable<GeomNode> {
    throw new Error('Method not implemented.')
  }
  pumpTheBoxToTheGraphWithMargins(): Rectangle {
    throw new Error('Method not implemented.')
  }
  shallowNodeCount: number
  translate(delta: Point) {
    throw new Error('Method not implemented.')
  }
  boundingBox: Rectangle
}
