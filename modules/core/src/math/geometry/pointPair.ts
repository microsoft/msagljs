import {Point} from '.'
import {comparePointsYFirst as comparePointsYX} from '../../utils/compare'
import {distPP} from './point'

/** An unordered pair of points */
export class PointPair {
  first: Point

  second: Point

  public constructor(first: Point, second: Point) {
    if (comparePointsYX(first, second) < 0) {
      this.first = first
      this.second = second
    } else {
      this.first = second
      this.second = first
    }
  }

  public get First(): Point {
    return this.first
  }

  public get Second(): Point {
    return this.second
  }

  public get Length(): number {
    return distPP(this.first, this.second)
  }

  public CompareTo(other: PointPair): number {
    const cr: number = comparePointsYX(this.first, other.first)
    if (cr !== 0) {
      return cr
    }

    return comparePointsYX(this.second, other.second)
  }

  public static equal(pair0: PointPair, pair1: PointPair): boolean {
    return pair0.first.equal(pair1.first) && pair0.second.equal(pair1.second)
  }

  public toString(): string {
    return this.first + (' ' + this.second)
  }
}
