import {GeomGraph, GeomNode, GeomObject, Point, SugiyamaLayoutSettings} from '@msagl/core'
import {parseJSONFile} from '../../utils/testUtils'
import {IncrementalDragger} from '@msagl/drawing'
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
    const shouldBeDelta = gNode.center.sub(gNodeCenter)
    gNodeCenter = gNode.center
    expect(Point.closeDistEps(shouldBeDelta, delta)).toBe(true)
    expect(edgesAreAttachedToNode(gNode)).toBe(true)
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
    const p = ge.targetArrowhead && ge.targetArrowhead.tipPosition ? ge.targetArrowhead.tipPosition : ge.curve.end

    const close = pointCloseToNodeBoundary(p, gNode)
    if (close === false) {
      return false
    }
  }
  for (const ge of gNode.selfEdges()) {
    {
      const p = ge.sourceArrowhead && ge.sourceArrowhead.tipPosition ? ge.sourceArrowhead.tipPosition : ge.curve.start
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
