import {Point} from '..'
import {PolylinePoint} from '../math/geometry/polylinePoint'

export class RelaxedPolylinePoint {
  private polylinePoint: PolylinePoint

  get PolylinePoint(): PolylinePoint {
    return this.polylinePoint
  }
  set PolylinePoint(value: PolylinePoint) {
    this.polylinePoint = value
  }

  private originalPosition: Point

  get OriginalPosition(): Point {
    return this.originalPosition
  }
  set OriginalPosition(value: Point) {
    this.originalPosition = value
  }

  constructor(polylinePoint: PolylinePoint, originalPosition: Point) {
    this.PolylinePoint = polylinePoint
    this.OriginalPosition = originalPosition
  }

  next: RelaxedPolylinePoint = null

  get Next(): RelaxedPolylinePoint {
    return this.next
  }
  set Next(value: RelaxedPolylinePoint) {
    this.next = value
  }

  prev: RelaxedPolylinePoint = null

  get Prev(): RelaxedPolylinePoint {
    return this.prev
  }
  set Prev(value: RelaxedPolylinePoint) {
    this.prev = value
  }
}
