//  implementation of the "MoveToFront" method for computing the minimum enclosing disc of a collection of points.
//  Runs in time linear in the number of points.  After Welzl'1991.
// The code has been borrowed from https://github.com/rowanwins/smallest-enclosing-circle/blob/90b932b310c3113fff7808c5611cbdb26fca2016/src/main.js#L1

import {Point} from '../../../math/geometry'
import {Assert} from '../../../utils/assert'
import {randomInt} from '../../../utils/random'
import {Disc} from './disc'

// Iterative version of Welzl's algorithm to avoid stack overflow on large inputs.
function wetzls(points: Point[]): {x: number; y: number; r: number} {
  const pts = points.slice()
  shuffle(pts)
  const n = pts.length

  if (n === 0) return {x: 0, y: 0, r: 0}
  if (n === 1) return {x: pts[0].x, y: pts[0].y, r: 0}

  let circle = calcCircle2(pts[0], pts[1])

  for (let i = 2; i < n; i++) {
    if (!isInCircle(pts[i], circle)) {
      // pts[i] must be on the boundary
      circle = calcCircle2(pts[0], pts[i])
      for (let j = 1; j < i; j++) {
        if (!isInCircle(pts[j], circle)) {
          // pts[j] must also be on the boundary
          circle = calcCircle2(pts[i], pts[j])
          for (let k = 0; k < j; k++) {
            if (!isInCircle(pts[k], circle)) {
              circle = calcCircle3(pts[i], pts[j], pts[k])
            }
          }
        }
      }
    }
  }

  return circle
}

function shuffle(a: Point[]): Point[] {
  let j, x, i
  for (i = a.length - 1; i > 0; i--) {
    j = randomInt(i + 1)
    x = a[i]
    a[i] = a[j]
    a[j] = x
  }
  return a
}

function calcCircle3(p1: Point, p2: Point, p3: Point) {
  const p1x = p1.x,
    p1y = p1.y,
    p2x = p2.x,
    p2y = p2.y,
    p3x = p3.x,
    p3y = p3.y,
    a = p2x - p1x,
    b = p2y - p1y,
    c = p3x - p1x,
    d = p3y - p1y,
    e = a * (p2x + p1x) * 0.5 + b * (p2y + p1y) * 0.5,
    f = c * (p3x + p1x) * 0.5 + d * (p3y + p1y) * 0.5,
    det = a * d - b * c,
    cx = (d * e - b * f) / det,
    cy = (-c * e + a * f) / det

  return {x: cx, y: cy, r: Math.sqrt((p1x - cx) * (p1x - cx) + (p1y - cy) * (p1y - cy))}
}

function calcCircle2(p1: Point, p2: Point) {
  const p1x = p1.x,
    p1y = p1.y,
    p2x = p2.x,
    p2y = p2.y,
    cx = 0.5 * (p1x + p2x),
    cy = 0.5 * (p1y + p2y)

  return {x: cx, y: cy, r: Math.sqrt((p1x - cx) * (p1x - cx) + (p1y - cy) * (p1y - cy))}
}

function isInCircle(p: Point, c: {x: any; y: any; r: any}) {
  return (c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y) <= c.r * c.r
}

/** static methods for obtaining a minimum enclosing disc of a collection of points */

export class MinimumEnclosingDisc {
  /**  linear-time computation using the move-to-front heuristic by Welzl */

  public static LinearComputation(points: Point[]): Disc {
    const circle = wetzls(points)
    const d = new Disc()
    d.Center = new Point(circle.x, circle.y)
    d.Radius = circle.r
    return d
  }

  //  Computing the minimum enclosing disc the naive way for testing purposes.
  public static SlowComputation(points: Point[]): Disc {
    const n: number = points.length
    let mc: Disc = null
    let b: number[] = null
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i != j) {
          const c: Disc = Disc.constructorPP(points[i], points[j])
          if (c.ContainsPN(points, [i, j])) {
            if (mc == null || mc.Radius > c.Radius) {
              mc = c
              b = [i, j]
            }
          }
        }

        for (let k = 0; k < n; k++) {
          if (k != i && k != j && !Disc.Collinear(points[i], points[j], points[k])) {
            const c3: Disc = Disc.constructorPPP(points[i], points[j], points[k])
            if (c3.ContainsPN(points, [i, j, k])) {
              if (mc == null || mc.Radius > c3.Radius) {
                mc = c3
                b = [i, j, k]
              }
            }
          }
        }
      }
    }

    Assert.assert(b != null)
    return mc
  }
}
