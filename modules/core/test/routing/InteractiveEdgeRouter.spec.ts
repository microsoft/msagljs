import {Point} from '../../src'
import {Polyline} from '../../src/math/geometry'
import {InteractiveEdgeRouter} from '../../src/routing/InteractiveEdgeRouter'

test('RemoveCollinearVertices from polyline', () => {
  const a = new Point(0, 0)
  const b = new Point(1, 0)
  const c = new Point(1, 1)
  const d = new Point(0, 1)
  const e = Point.middle(b, c)
  const poly = Polyline.mkFromPoints([a, b, e, c, d])
  InteractiveEdgeRouter.RemoveCollinearVertices(poly)
  expect(poly.count).toBe(4)
})
