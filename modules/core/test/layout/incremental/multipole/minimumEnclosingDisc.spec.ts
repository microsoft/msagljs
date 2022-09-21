import {Disc} from '../../../../src/layout/incremental/multipole/disc'
import {MinimumEnclosingDisc} from '../../../../src/layout/incremental/multipole/minimumEnclosingDisc'
import {CurveFactory, Point} from '../../../../src/math/geometry'
import {SvgDebugWriter} from '../../../utils/svgDebugWriter'

test('disc', () => {
  const ps = [new Point(0, 0), new Point(0, 100)]
  let dSlow = MinimumEnclosingDisc.SlowComputation(ps)
  let dFast = MinimumEnclosingDisc.LinearComputation(ps)
  expect(discsAreClose(dSlow, dFast)).toBe(true)

  ps.push(new Point(200, 200))
  dSlow = MinimumEnclosingDisc.SlowComputation(ps)
  dFast = MinimumEnclosingDisc.LinearComputation(ps)
  expect(discsAreClose(dSlow, dFast)).toBe(true)

  ps.push(new Point(50, -120))
  dSlow = MinimumEnclosingDisc.SlowComputation(ps)
  dFast = MinimumEnclosingDisc.LinearComputation(ps)
  expect(discsAreClose(dSlow, dFast)).toBe(true)

  //   SvgDebugWriter.dumpICurves(
  //     './tmp/disc1.svg',
  //     [CurveFactory.mkCircle(dSlow.Radius, dSlow.Center)].concat(ps.map((a) => CurveFactory.mkCircle(dSlow.Radius / 12, a))),
  //   )
})
function discsAreClose(a: Disc, b: Disc): boolean {
  if (a.Center.sub(b.Center).length > 0.01) return false
  if (Math.abs(a.Radius - b.Radius) > 0.01) return false
  return true
}
