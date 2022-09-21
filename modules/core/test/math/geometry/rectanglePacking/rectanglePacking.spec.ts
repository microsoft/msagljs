import {Rectangle, Point} from '../../../../src'
import {DebugCurve} from '../../../../src/math/geometry/debugCurve'
import {OptimalRectanglePacking} from '../../../../src/math/geometry/rectanglePacking/OptimalRectanglePacking'
import {PackingConstants} from '../../../../src/math/geometry/rectanglePacking/PackingConstants'
import {GreedyRectanglePacking} from '../../../../src/math/geometry/rectanglePacking/RectanglePacking'
import {random} from '../../../../src/utils/random'
import {SvgDebugWriter} from '../../../utils/svgDebugWriter'

test('RectanglePackingTwoSquares', () => {
  const rectangles = []
  for (let i = 0; i < 2; i++) {
    rectangles[i] = Rectangle.mkPP(new Point(0, 0), new Point(1, 1))
  }

  const rectanglePacking = new OptimalRectanglePacking(rectangles, PackingConstants.GoldenRatio)
  rectanglePacking.run()
  expect(rectanglePacking.PackedWidth).toBe(2)
  expect(1).toBe(rectanglePacking.PackedHeight)
  expect(AreOverlapping(rectangles)).toBe(false)
  ShowDebugView(rectangles, './tmp/RectanglePackingTwoSquares.svg')
})

test('RectanglePackingNineSquares', () => {
  const rectangles = []
  for (let i = 0; i < 9; i++) {
    rectangles[i] = Rectangle.mkPP(new Point(0, 0), new Point(1, 1))
  }

  const rectanglePacking = new GreedyRectanglePacking(rectangles, 3)
  rectanglePacking.run()
  expect(3).toBe(rectanglePacking.PackedWidth)
  expect(3).toBe(rectanglePacking.PackedHeight)
  expect(AreOverlapping(rectangles)).toBe(false)
  ShowDebugView(rectangles, './tmp/RectanglePackingNineSquares.svg')
})

// Rect: 1x2 + two unit squares, should pack to 2x2"
test('RectanglePackingTallRectAndTwoSquares', () => {
  const rectangles = []
  rectangles[0] = Rectangle.mkPP(new Point(0, 0), new Point(1, 2))
  rectangles[1] = Rectangle.mkPP(new Point(0, 0), new Point(1, 1))
  rectangles[2] = Rectangle.mkPP(new Point(0, 0), new Point(1, 1))
  const rectanglePacking = new GreedyRectanglePacking(rectangles, 2)
  rectanglePacking.run()
  expect(2).toBe(rectanglePacking.PackedWidth)
  expect(2).toBe(rectanglePacking.PackedHeight)
  expect(AreOverlapping(rectangles)).toBe(false)
  ShowDebugView(rectangles, './tmp/RectanglePackingTallRectAndTwoSquares.svg')
})

function ShowDebugView(rectangles: Rectangle[], fn: string) {
  SvgDebugWriter.dumpDebugCurves(
    fn,

    rectangles.map((r) => DebugCurve.mkDebugCurveWCI(r.width / 10, 'black', r.perimeter())),
  )
}

// "Five rectangles of different heights that should fit into 3x3 bounding box"
test('SimpleRectanglesDifferentHeights', () => {
  let rectangles = []
  rectangles.push(Rectangle.mkPP(new Point(0, 0), new Point(1, 1)))
  rectangles.push(Rectangle.mkPP(new Point(0, 0), new Point(1, 2)))
  rectangles.push(Rectangle.mkPP(new Point(0, 0), new Point(1, 1)))
  rectangles.push(Rectangle.mkPP(new Point(0, 0), new Point(1, 3)))
  rectangles.push(Rectangle.mkPP(new Point(0, 0), new Point(1, 2)))
  const scale = 100

  rectangles = rectangles.map((r: Rectangle) => Rectangle.mkPP(new Point(0, 0), new Point(r.width * scale, r.height * scale)))

  const rectanglePacking = new GreedyRectanglePacking(rectangles, 3 * scale)
  rectanglePacking.run()
  expect(3 * scale).toBe(rectanglePacking.PackedWidth)
  expect(3 * scale).toBe(rectanglePacking.PackedHeight)
  expect(AreOverlapping(rectangles)).toBe(false)
  ShowDebugView(rectangles, './tmp/SimpleRectanglesDifferentHeights')
})

test('RandomRectangles', () => {
  const N = 100
  const desiredAspectRatio = 1
  const rectangles = []
  let area = 0
  const scale = 100
  for (let i = 0; i < N; i++) {
    const width: number = scale * random()
    const height: number = scale * random()
    area += +(width * height)
    rectangles.push(Rectangle.mkPP(new Point(0, 0), new Point(width, height)))
  }

  const maxWidth = Math.sqrt(area)
  const rectanglePacking: GreedyRectanglePacking = new GreedyRectanglePacking(rectangles, maxWidth)
  rectanglePacking.run()
  const appoxAspectRatio: number = rectanglePacking.PackedWidth / rectanglePacking.PackedHeight
  expect(rectanglePacking.PackedWidth < maxWidth).toBe(true)
  expect(AreOverlapping(rectangles)).toBe(false)
  const optimalRectanglePacking: OptimalRectanglePacking = new OptimalRectanglePacking(rectangles, desiredAspectRatio)
  optimalRectanglePacking.run()
  const optimalAspectRatio: number = optimalRectanglePacking.PackedWidth / optimalRectanglePacking.PackedHeight
  expect(Math.abs(appoxAspectRatio - desiredAspectRatio) > Math.abs(optimalAspectRatio - desiredAspectRatio)).toBe(true)
  expect(AreOverlapping(rectangles)).toBe(false)
  ShowDebugView(rectangles, './tmp/RandomRectangles.svg')
})

test('PowerLawRandomRectangles', () => {
  const n = 100
  const desiredAspectRatio = 1
  const rectangles = []
  let area = 0
  const scale = 100
  for (let i = 0; i < n; i++) {
    const s: number = scale * Math.pow(2, i / 10)
    const width: number = s * random()
    const height: number = s * random()
    area += width * height
    rectangles.push(Rectangle.mkPP(new Point(0, 0), new Point(width, height)))
  }

  const maxWidth: number = Math.sqrt(area)
  const rectanglePacking: GreedyRectanglePacking = new GreedyRectanglePacking(rectangles, maxWidth)
  rectanglePacking.run()
  ShowDebugView(rectangles, './tmp/PowerLawRandomRectangles_1.svg')
  const appoxAspectRatio: number = rectanglePacking.PackedWidth / rectanglePacking.PackedHeight
  expect(rectanglePacking.PackedWidth < maxWidth).toBe(true)
  expect(AreOverlapping(rectangles)).toBe(false)
  const optimalRectanglePacking: OptimalRectanglePacking = new OptimalRectanglePacking(rectangles, desiredAspectRatio)
  optimalRectanglePacking.run()
  const optimalAspectRatio: number = optimalRectanglePacking.PackedWidth / optimalRectanglePacking.PackedHeight
  ShowDebugView(rectangles, './tmp/PowerLawRandomRectangles_2.svg')
  expect(Math.abs(appoxAspectRatio - desiredAspectRatio) > Math.abs(optimalAspectRatio - desiredAspectRatio)).toBe(true)
  expect(AreOverlapping(rectangles)).toBe(false)
})

//Description("test golden section algorithm with f(x) = x^2")
test('GoldenSectionTest', () => {
  const Precision = 0.001
  const xopt: number = OptimalRectanglePacking.GoldenSectionSearch((x) => x * x, -1, -0.2, 1, Precision)
  expect(Math.abs(xopt) < Precision).toBe(true)
})

// fool-proof overlap test
function AreOverlapping(rects: Rectangle[]): boolean {
  const rs = rects.map((r) => r.clone())
  for (let i = 0; i < rs.length; i++) {
    rs[i].pad(-0.01)
  }

  for (let i = 0; i < rs.length - 1; i++) {
    for (let j: number = i + 1; j < rs.length; j++) {
      if (rs[i].intersects(rs[j])) {
        return true
      }
    }
  }

  return false
}
