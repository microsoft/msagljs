import {Point} from '../../src'
import {SingleSourceMultipleTargetsShortestPathOnVisibilityGraph} from '../../src/routing/SingleSourceMultipleTargetsShortestPathOnVisibilityGraph'
import {VisibilityEdge} from '../../src/routing/visibility/VisibilityEdge'
import {VisibilityGraph} from '../../src/routing/visibility/VisibilityGraph'

test('ssmtsp', () => {
  const vg = new VisibilityGraph()

  const upperVVs = []
  for (let i = 0; i < 9; i++) {
    upperVVs.push(vg.AddVertexP(new Point(i, 1)))
  }
  const topVertex = vg.AddVertexP(upperVVs[upperVVs.length - 1].point.add(new Point(0, 1)))

  VisibilityGraph.AddEdge(new VisibilityEdge(topVertex, upperVVs[upperVVs.length - 2]))
  const origin = vg.AddVertexP(new Point(0, 0))
  // add upper edges
  for (let i = 0; i < upperVVs.length - 1; i++) {
    VisibilityGraph.AddEdge(new VisibilityEdge(upperVVs[i], upperVVs[i + 1]))
    VisibilityGraph.AddEdge(new VisibilityEdge(origin, upperVVs[i]))
  }
  const middleVertex = vg.AddVertexP(new Point(0.5, 0.5))
  // adding some longer detour to the vertex before last on upperVVs
  VisibilityGraph.AddEdge(new VisibilityEdge(middleVertex, origin))
  VisibilityGraph.AddEdge(new VisibilityEdge(middleVertex, upperVVs[upperVVs.length - 2]))

  const sp = new SingleSourceMultipleTargetsShortestPathOnVisibilityGraph(origin, [upperVVs[upperVVs.length - 1], topVertex], vg)
  const path = sp.GetPath()
  expect(path.length).toBe(3)
  expect(path[0]).toBe(origin)
  expect(path[1]).toBe(upperVVs[upperVVs.length - 2])
  expect(path[2]).toBe(upperVVs[upperVVs.length - 1])
})
