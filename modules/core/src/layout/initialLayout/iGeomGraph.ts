import {Point, Rectangle} from '../../math/geometry'
import {RectangularClusterBoundary} from '../../math/geometry/overlapRemoval/rectangularClusterBoundary'
import {GeomEdge, GeomNode} from '../core'

export interface IGeomGraph {
  Clusters: IterableIterator<IGeomGraph>
  subgraphsDepthFirst: IterableIterator<IGeomGraph>
  uniformMargins: number
  edges(): IterableIterator<GeomEdge>
  shallowNodes(): Iterable<GeomNode>
  pumpTheBoxToTheGraphWithMargins(): Rectangle
  shallowNodeCount: number
  translate(delta: Point)
  boundingBox: Rectangle
  RectangularBoundary: RectangularClusterBoundary
}
