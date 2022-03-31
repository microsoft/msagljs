import {PivotDistances} from '../../../src/layout/mds/PivotDistances'
import {layoutGraphWithMds} from '../../../src/layout/mds/PivotMDS'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'
import {nodeBoundaryFunc, labelRectFunc, parseDotGraph, createGeometry} from '../../utils/testUtils'

test('pivot distances', () => {
  const dg = parseDotGraph('graphvis/abstract.gv')
  const gg = createGeometry(dg.graph, nodeBoundaryFunc, labelRectFunc)
  const pivotArray = new Array<number>(7)
  const pivotDistances = new PivotDistances(gg, pivotArray, () => 1)
  pivotDistances.run()
  expect(pivotArray[0]).toBe(0)
  expect(pivotArray[1] != pivotArray[0]).toBe(true)
  expect(pivotDistances.Result.length).toBe(7)
  const min = new Array(gg.graph.shallowNodeCount).fill(Number.POSITIVE_INFINITY)
  for (let i = 0; i < pivotArray.length - 1; i++) {
    for (let j = 0; j < gg.graph.shallowNodeCount; j++) {
      min[j] = Math.min(pivotDistances.Result[i][j], min[j])
    }

    const p = pivotArray[i + 1]
    const mm = min[p]
    // make sure that it
    for (const t of min) {
      expect(mm >= t).toBe(true)
    }
  }
})
test('MDSGraphLayout - lay out a flat graph, no subgraphs', () => {
  const dg = parseDotGraph('graphvis/abstract.gv')
  const gg = createGeometry(dg.graph, nodeBoundaryFunc, labelRectFunc)
  layoutGraphWithMds(gg, null)
  new SvgDebugWriter('/tmp/abstractMDS.svg').writeGeomGraph(gg)
})
