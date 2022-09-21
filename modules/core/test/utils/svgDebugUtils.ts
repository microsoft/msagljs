import {SvgDebugWriter} from './svgDebugWriter'
import {allVerticesOfParall} from '../../src/math/geometry/parallelogram'
import {DebugCurve} from '../../src/math/geometry/debugCurve'
import {PN} from '../../src/math/geometry/parallelogramNode'
import {Polyline} from '../../src/math/geometry/polyline'

export function writeLeavesToSvg(nl0: PN, nl1: PN): void {
  const w = new SvgDebugWriter('./tmp/goDeeper.svg')
  const poly0 = new Polyline()
  for (const p of allVerticesOfParall(nl0.parallelogram)) {
    poly0.addPoint(p)
  }
  poly0.closed = true

  const poly1 = new Polyline()
  for (const p of allVerticesOfParall(nl1.parallelogram)) {
    poly1.addPoint(p)
  }
  poly1.closed = true

  const dc = [
    DebugCurve.mkDebugCurveTWCI(100, 0.1, 'Black', nl0.seg),
    DebugCurve.mkDebugCurveTWCI(100, 0.1, 'Black', poly0),
    DebugCurve.mkDebugCurveTWCI(100, 0.1, 'Red', nl1.seg),
    DebugCurve.mkDebugCurveTWCI(100, 0.1, 'Red', poly1),
  ]
  w.writeDebugCurves(dc)
  throw new Error('killed')
}
