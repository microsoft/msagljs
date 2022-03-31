import {Point} from '../../../src'
import {CompassVector, Direction} from '../../../src/math/geometry'

test('rotate', () => {
  const north = new CompassVector(Direction.North)
  const rrNorth = north.Right
  expect(rrNorth.Dir).toBe(Direction.East)
  expect(CompassVector.RotateLeft(Direction.East)).toBe(Direction.North)
})

test('VectorDirection', () => {
  const p = new Point(-1, 1)
  const dir = CompassVector.VectorDirection(p)
  expect(dir).toBe(Direction.West | Direction.North)
  const dirpp = CompassVector.VectorDirectionPP(new Point(0, 0), p)
  expect(dirpp).toBe(dir)
  const dd = Direction.East | Direction.South
  const ddVec = CompassVector.toPoint(dd)
  expect(ddVec.x).toBe(1)
  expect(ddVec.y).toBe(-1)
})
