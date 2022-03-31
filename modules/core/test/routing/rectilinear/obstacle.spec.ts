import {Point} from '../../../src'
import {Polyline} from '../../../src/math/geometry'
import {Obstacle} from '../../../src/routing/rectilinear/obstacle'

test('RemoveCloseAndCollinearVerticesInPlace', () => {
  const a = new Point(0, 0)
  const b = new Point(1, 0)
  const c = new Point(1, 1)
  const d = new Point(0, 1)
  const e = Point.middle(b, c)
  let poly = Polyline.mkFromPoints([a, b, e, c, d])
  Obstacle.RemoveCloseAndCollinearVerticesInPlace(poly)
  expect(poly.count).toBe(4)
  poly = Polyline.mkFromPoints([a, Point.middle(a, b), b])
  Obstacle.RemoveCloseAndCollinearVerticesInPlace(poly)
  expect(poly.count).toBe(2)
})

test('RoundVertices', () => {
  const a = new Point(0, 0)
  const b = new Point(1, 0)
  const c = new Point(1, 1)
  const d = new Point(0, 1)
  const e = Point.middle(b, c)
  let poly = Polyline.mkFromPoints([a, b, e, c, d])
  poly.closed = true
  poly = <Polyline>poly.reverse()
  Obstacle.RoundVerticesAndSimplify(poly)
  expect(poly.count).toBe(4)
})
