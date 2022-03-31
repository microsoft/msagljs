import {Point} from './point'

export class GeomConstants {
  static distanceEpsilonPrecision = 6
  static RoundPoint(point: Point): Point {
    return new Point(GeomConstants.RoundDouble(point.x), GeomConstants.RoundDouble(point.y))
  }
  static RoundDouble(num: number): number {
    return Math.round(num * GeomConstants.mult) / GeomConstants.mult
  }
  static mult = Math.pow(10, 6)
  static defaultLeafBoxesOffset = 0.5
  static lineSegmentThreshold = 0.05
  static intersectionEpsilon = 0.0001
  static distanceEpsilon = Math.pow(10, -GeomConstants.distanceEpsilonPrecision)
  static squareOfDistanceEpsilon = Math.pow(10, -GeomConstants.distanceEpsilonPrecision * 2)
  static tolerance = 1.0e-8
}
