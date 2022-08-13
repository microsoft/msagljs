import {Point, Rectangle} from '../../math/geometry'
import {RectangularClusterBoundary} from '../../math/geometry/overlapRemoval/rectangularClusterBoundary'
import {GeomEdge, GeomNode} from '../core'

export interface IGeomGraph {
  calculateBoundsFromChildren(clusterMargin: number)
  Clusters: IterableIterator<IGeomGraph>
  subgraphsDepthFirst: IterableIterator<IGeomGraph>
  uniformMargins: number
  edges(): IterableIterator<GeomEdge>
  shallowNodes: IterableIterator<GeomNode>
  deepNodes: IterableIterator<GeomNode>
  pumpTheBoxToTheGraphWithMargins(): Rectangle
  shallowNodeCount: number
  deepNodeCount: number
  translate(delta: Point)
  boundingBox: Rectangle
  RectangularBoundary: RectangularClusterBoundary
}
