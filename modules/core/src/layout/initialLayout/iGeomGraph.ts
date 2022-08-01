import {Point, Rectangle} from '../../math/geometry'
import {RectangularClusterBoundary} from '../../math/geometry/overlapRemoval/rectangularClusterBoundary'

export interface IGeomGraph {
  shallowNodeCount: number
  translate(delta: Point)
  boundingBox: Rectangle
  RectangularBoundary: RectangularClusterBoundary
}
