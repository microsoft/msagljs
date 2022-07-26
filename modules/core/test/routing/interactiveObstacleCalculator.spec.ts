import {Rectangle} from '../../src'
import {Point, Polyline} from '../../src/math/geometry'
import {InteractiveObstacleCalculator} from '../../src/routing/interactiveObstacleCalculator'
import {SvgDebugWriter} from '../utils/svgDebugWriter'

test('padded rectangle', () => {
  const rect = Rectangle.mkPP(new Point(0, 0), new Point(100, 50))
  const poly = rect.perimeter()
  expect(poly instanceof Polyline).toBe(true)
  const paddedPoly = InteractiveObstacleCalculator.CreatePaddedPolyline(poly, 10)
  SvgDebugWriter.dumpICurves('/tmp/paddedRect.svg', [poly, paddedPoly])
})

test('padded triangle', () => {
  const poly = Polyline.mkClosedFromPoints([new Point(0, 0), new Point(10, 100), new Point(20, 0)])

  expect(poly instanceof Polyline).toBe(true)
  const paddedPoly = InteractiveObstacleCalculator.CreatePaddedPolyline(poly, 10)
  SvgDebugWriter.dumpICurves('/tmp/paddedTri.svg', [poly, paddedPoly])
})
