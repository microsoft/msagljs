import {Point} from '../../../src'
import {Polyline} from '../../../src/math/geometry'
import {SmoothedPolyline} from '../../../src/math/geometry/smoothedPolyline'
//import {SvgDebugWriter} from '../../utils/svgDebugWriter'

test('smooth test', () => {
  const ps = [new Point(0, 100), new Point(100, 100), new Point(200, 10), new Point(300, 0)]

  let sp = SmoothedPolyline.mkFromPoints(ps)
  let poly = Polyline.mkFromPoints(ps)
  expect(poly.count).toBe(ps.length)
  //SvgDebugWriter.dumpICurves('./tmp/sp.svg', [poly, sp.createCurve()])

  ps[0] = new Point(0, 0)
  sp = SmoothedPolyline.mkFromPoints(ps)
  poly = Polyline.mkFromPoints(ps)
  //SvgDebugWriter.dumpICurves('./tmp/sp1.svg', [poly, sp.createCurve()])
})
