import {CompassVector} from '../../math/geometry/compassVector'
import {Direction} from '../../math/geometry/direction'
import {GeomConstants} from '../../math/geometry/geomConstants'
import {Point} from '../../math/geometry/point'

import {VisibilityVertex} from '../visibility/VisibilityVertex'

export class PointComparer {
  // Due to the vagaries of rounding, we may encounter a result that is not quite 0
  // when subtracting two numbers that are close.
  // ReSharper disable InconsistentNaming
  static differenceEpsilon: number = GeomConstants.distanceEpsilon / 2

  // ReSharper restore InconsistentNaming
  static get DifferenceEpsilon(): number {
    return PointComparer.differenceEpsilon
  }

  // Determines whether the specified Points, which are assumed to have been Round()ed,
  // are close enough to be considered equal.

  // <returns>True if the inputs are close enough to be considered equal, else false</returns>
  static EqualPP(a: Point, b: Point): boolean {
    return PointComparer.Equal(a.x, b.x) && PointComparer.Equal(a.y, b.y)
  }

  // Determines whether the specified double values, which are assumed to have been Round()ed,
  // are close enough to be considered equal.

  // <returns>True if the inputs are close enough to be considered equal, else false</returns>
  static Equal(x: number, y: number): boolean {
    return PointComparer.Compare(x, y) === 0
  }

  // The usual Compare operation, with inputs that are assumed to have been Round()ed.

  //
  //
  // <returns>0 if the inputs are close enough to be considered equal, else -1 if lhs is
  // less than rhs, else 1.</returns>
  static Compare(lhs: number, rhs: number): number {
    // If the inputs are not rounded, then two numbers that are close together at the
    // middle of the rounding range may Compare as 0 but Round to different values
    // (e.g., with rounding to 6 digits, xxx.yyyyyy49 and xxx.yyyyyy51 will exhibit this).
    // PointComparer.Assert_Rounded(lhs)
    // PointComparer.Assert_Rounded(rhs)
    let cmp = 0
    if (lhs + PointComparer.DifferenceEpsilon < rhs) {
      cmp = -1
    } else if (rhs + PointComparer.DifferenceEpsilon < lhs) {
      cmp = 1
    }

    // Just to be sure we're in sync with CompassVector
    /*Assert.assert(
      cmp < 0 ==
        (Direction.East ==
          CompassVector.VectorDirectionPP(
            new Point(lhs, 0),
            new Point(rhs, 0),
          )),
    )*/
    /*Assert.assert(
      (0 === cmp) ==
        (Direction.None ==
          CompassVector.VectorDirectionPP(
            new Point(lhs, 0),
            new Point(rhs, 0),
          )),
    )*/
    return cmp
  }

  // The usual Compare operation, with inputs that are assumed to have been Round()ed.

  // <returns>0 if the inputs are close enough to be considered equal, else -1 if lhs is
  // less than rhs, else 1.</returns>
  static ComparePP(lhs: Point, rhs: Point): number {
    let cmp: number = PointComparer.Compare(lhs.x, rhs.x)
    if (cmp === 0) {
      cmp = PointComparer.Compare(lhs.y, rhs.y)
    }

    return cmp
  }

  // return true if less or equal holds for two values that are assumed to have been Round()ed
  static LessOrEqual(a: number, b: number): boolean {
    const comp: number = PointComparer.Compare(a, b)
    return comp < 0 || comp === 0
  }

  static Less(a: number, b: number): boolean {
    return PointComparer.Compare(a, b) < 0
  }

  // static Assert_Rounded(d: number) {
  //  //  Be sure there is enough precision to round that far; anything larger than this is
  //  //  unlikely to be a graph coordinate (it's probably a line intersection way out of range).
  //  if (Math.log10(Math.abs(d)) < 14 - GeomConstants.distanceEpsilonPrecision) {
  //    /*Assert.assert(
  //      Math.abs(Point.RoundDouble(d) - d) <
  //        PointComparer.DifferenceEpsilon,
  //      'unRounded value passed',
  //    )*/
  //  }
  // }

  // static Assert_RoundedP(p: Point) {
  //  // PointComparer.Assert_Rounded(p.x)
  //  // PointComparer.Assert_Rounded(p.y)
  // }

  static GetDirections(a: Point, b: Point): Direction {
    // PointComparer.Assert_RoundedP(a)
    // PointComparer.Assert_RoundedP(b)
    return CompassVector.DirectionFromPointToPoint(a, b)
  }

  static IsPureDirection(a: Point, b: Point): boolean {
    // PointComparer.Assert_RoundedP(a)
    // PointComparer.Assert_RoundedP(b)
    return CompassVector.IsPureDirection(PointComparer.GetDirections(a, b))
  }

  static IsPureDirectionD(dir: Direction): boolean {
    return CompassVector.IsPureDirection(dir)
  }

  static IsPureLower(a: Point, b: Point): boolean {
    // PointComparer.Assert_RoundedP(a)
    // PointComparer.Assert_RoundedP(b)
    // Is a lower than b along the orthogonal line segment?  That means moving
    // from a to b is in the increasing direction.
    const dir: Direction = PointComparer.GetDirections(a, b)
    return Direction.East === dir || Direction.North === dir
  }

  static GetPureDirectionVV(first: VisibilityVertex, second: VisibilityVertex): Direction {
    return PointComparer.GetDirections(first.point, second.point)
  }
}
