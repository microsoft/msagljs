import {Point} from '../../../src'
import {LineSegment} from '../../../src/math/geometry'
import {Parallelogram} from '../../../src/math/geometry/parallelogram'

test('parallelogram line seg intersection', () => {
  const ls0 = LineSegment.mkPP(new Point(0, 0), new Point(100, 100))
  const ls1 = LineSegment.mkPP(new Point(1, 1), new Point(2, 2)) // a short line inside of ls0
  expect(Parallelogram.intersect(ls0.pNodeOverICurve().parallelogram, ls1.pNodeOverICurve().parallelogram)).toBe(true)
  const ls2 = LineSegment.mkPP(new Point(1, 2), new Point(2, 3)) // a short line outside of ls0
  expect(Parallelogram.intersect(ls0.pNodeOverICurve().parallelogram, ls2.pNodeOverICurve().parallelogram)).toBe(false)
  const boxPar = Parallelogram.parallelogramByCornerSideSide(new Point(0, 0), new Point(100, 0), new Point(0, 100))
  expect(Parallelogram.intersect(boxPar, ls2.pNodeOverICurve().parallelogram)).toBe(true)
  const boxPar0 = Parallelogram.parallelogramByCornerSideSide(new Point(0, 0), new Point(0, 100), new Point(100, 0))
  expect(Parallelogram.intersect(boxPar0, ls2.pNodeOverICurve().parallelogram)).toBe(true)
  const boxPar1 = Parallelogram.parallelogramByCornerSideSide(new Point(200, 0), new Point(0, 100), new Point(100, 0))
  const boxOfTwo = Parallelogram.parallelogramOfTwo(boxPar0, boxPar1)
  expect(Parallelogram.intersect(boxOfTwo, ls2.pNodeOverICurve().parallelogram)).toBe(true)
  const boxPar2 = Parallelogram.parallelogramByCornerSideSide(new Point(200, 0), new Point(0, 100), new Point(100, 0))
  const boxOfTwo1 = Parallelogram.parallelogramOfTwo(boxPar0, boxPar2)
  expect(Parallelogram.intersect(boxOfTwo1, ls2.pNodeOverICurve().parallelogram)).toBe(true)
})
