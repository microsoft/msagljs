import {Point, Rectangle} from '../../math/geometry'
import {RectangularClusterBoundary} from '../../math/geometry/overlapRemoval/rectangularClusterBoundary'
import {GeomNode} from '../core'

export interface IGeomGraph {
  subgraphsDepthFirst: IterableIterator<IGeomGraph>
  uniformMargins: number
  edges()
  shallowNodes(): Iterable<GeomNode>
  pumpTheBoxToTheGraphWithMargins(): Rectangle
  shallowNodeCount: number
  translate(delta: Point)
  boundingBox: Rectangle
  RectangularBoundary: RectangularClusterBoundary
}
