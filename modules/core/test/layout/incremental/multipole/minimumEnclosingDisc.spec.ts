import {Disc} from '../../../../src/layout/incremental/multipole/disc'
import {MinimumEnclosingDisc} from '../../../../src/layout/incremental/multipole/minimumEnclosingDisc'
import {Point} from '../../../../src/math/geometry'

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

  ps.push(new Point(1, 1))
  dSlow = MinimumEnclosingDisc.SlowComputation(ps)
  dFast = MinimumEnclosingDisc.LinearComputation(ps)
  expect(discsAreClose(dSlow, dFast)).toBe(true)

  //   SvgDebugWriter.dumpICurves(
  //     './tmp/disc1.svg',
  //     [CurveFactory.mkCircle(dSlow.Radius, dSlow.Center)].concat(ps.map((a) => CurveFactory.mkCircle(dSlow.Radius / 12, a))),
  //   )
})
describe('MinimumEnclosingDisc Tests', () => {
  it('should compute the minimum enclosing disc correctly', () => {
    const ps: Point[] = [
      new Point(0, 0),
      new Point(10, 10),
      new Point(20, 5),
      new Point(30, 15),
      new Point(40, 10),
      new Point(50, 20),
      new Point(60, 25),
      new Point(70, 30),
      new Point(80, 35),
      new Point(90, 40),
    ]

    let dSlow = MinimumEnclosingDisc.SlowComputation(ps)
    let dFast = MinimumEnclosingDisc.LinearComputation(ps)
    expect(discsAreClose(dSlow, dFast)).toBe(true)

    ps.push(new Point(200, 201))
    dSlow = MinimumEnclosingDisc.SlowComputation(ps)
    dFast = MinimumEnclosingDisc.LinearComputation(ps)

    expect(discsAreClose(dSlow, dFast)).toBe(true)

    ps.push(new Point(50, -120))
    dSlow = MinimumEnclosingDisc.SlowComputation(ps)
    dFast = MinimumEnclosingDisc.LinearComputation(ps)
    expect(discsAreClose(dSlow, dFast)).toBe(true)

    ps.push(new Point(1, 1))
    dSlow = MinimumEnclosingDisc.SlowComputation(ps)
    dFast = MinimumEnclosingDisc.LinearComputation(ps)
    expect(discsAreClose(dSlow, dFast)).toBe(true)

    // SvgDebugWriter.dumpICurves(
    //   './tmp/disc1.svg',
    //   [CurveFactory.mkCircle(dSlow.Radius, dSlow.Center)].concat(ps.map((a) => CurveFactory.mkCircle(dSlow.Radius / 12, a))),
    // );
  })
})
function discsAreClose(a: Disc, b: Disc): boolean {
  if (a.Center.sub(b.Center).length > 0.01) return false
  if (Math.abs(a.Radius - b.Radius) > 0.01) return false
  return true
}
