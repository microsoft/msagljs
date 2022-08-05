import {graphToJSON} from '../../../../parser/src/dotparser'
import {GeomGraph, GeomNode} from '../../../src/layout/core'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {SugiyamaLayoutSettings} from '../../../src/layout/layered/sugiyamaLayoutSettings'
import {IncrementalDragger} from '../../../src/layout/layoutEditing/incrementalDragger'
import {Point} from '../../../src/math/geometry'
import {parseJSONFile} from '../../utils/testUtils'
import * as fs from 'fs'

test('incremental drag', () => {
  const g = parseJSONFile('JSONfiles/ldbxtried.gv.JSON')

  const gg = GeomGraph.getGeom(g)
  const node = g.findNodeRecursive('n464')
  const gNode = GeomObject.getGeom(node) as GeomNode
  expect(edgesAreAttachedToNode(gNode)).toBe(true)

  const ls = new SugiyamaLayoutSettings()
  const pushingNodes = []
  pushingNodes.push(gNode)
  const dragger = new IncrementalDragger(pushingNodes, gg, ls)
  let gNodeCenter = gNode.center
  const delta = new Point(20, 20)
  for (let i = 0; i < 5; i++) {
    dragger.Drag(delta)
    const jsonfOfG = graphToJSON(g)
    const ws = fs.openSync('/tmp/drag' + i + '.JSON', 'w', 0o666)
    fs.writeFileSync(ws, JSON.stringify(jsonfOfG, null, 2))
    const shouldBeDelta = gNode.center.sub(gNodeCenter)
    gNodeCenter = gNode.center
    expect(Point.closeDistEps(shouldBeDelta, delta)).toBe(true)
    expect(edgesAreAttachedToNode(gNode)).toBe(true)
    //console.log(gNode.center)
    fs.close(ws)
  }
})
function edgesAreAttachedToNode(gNode: GeomNode): boolean {
  for (const ge of gNode.outEdges()) {
    const p = ge.sourceArrowhead ? ge.sourceArrowhead.tipPosition : ge.curve.start
    const close = pointCloseToNodeBoundary(p, gNode)
    if (close === false) {
      return false
    }
  }
  for (const ge of gNode.inEdges()) {
    const p = ge.targetArrowhead ? ge.targetArrowhead.tipPosition : ge.curve.end
    const close = pointCloseToNodeBoundary(p, gNode)
    if (close === false) {
      return false
    }
  }
  for (const ge of gNode.selfEdges()) {
    {
      const p = ge.sourceArrowhead ? ge.sourceArrowhead.tipPosition : ge.curve.start
      const close = pointCloseToNodeBoundary(p, gNode)
      if (close === false) {
        return false
      }
    }
    {
      const p = ge.targetArrowhead ? ge.targetArrowhead.tipPosition : ge.curve.end
      const close = pointCloseToNodeBoundary(p, gNode)
      if (close === false) {
        return false
      }
    }
  }
  return true
}
function pointCloseToNodeBoundary(p: Point, gNode: GeomNode): boolean {
  const t = gNode.boundaryCurve.closestParameter(p)
  const dist = p.sub(gNode.boundaryCurve.value(t)).length
  return dist < 0.1
}
