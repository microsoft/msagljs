import {MinimumEnclosingDisc} from '../../../../src/layout/incremental/multipole/minimumEnclosingDisc'
import {CurveFactory, Point} from '../../../../src/math/geometry'
import {SvgDebugWriter} from '../../../utils/svgDebugWriter'

test('disc', () => {
  const ps = [new Point(0, 0), new Point(0, 100)]
  let d = MinimumEnclosingDisc.SlowComputation(ps)
  //   SvgDebugWriter.dumpICurves(
  //     '/tmp/disc.svg',
  //     [CurveFactory.mkCircle(d.Radius, d.Center)].concat(ps.map((a) => CurveFactory.mkCircle(d.Radius / 12, a))),
  //   )
  ps.push(new Point(200, 200))
  d = MinimumEnclosingDisc.SlowComputation(ps)
  expect(Math.abs(d.Radius * 2 - ps[0].sub(ps[1]).length) < 0.01).toBe(true)
  //   SvgDebugWriter.dumpICurves(
  //     '/tmp/disc1.svg',
  //     [CurveFactory.mkCircle(d.Radius, d.Center)].concat(ps.map((a) => CurveFactory.mkCircle(d.Radius / 12, a))),
  //   )
})
