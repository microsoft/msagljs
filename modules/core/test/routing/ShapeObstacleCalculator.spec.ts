import {CurveFactory, Point} from '../../src'
import {Shape} from '../../src/routing/shape'
import {ShapeObstacleCalculator} from '../../src/routing/ShapeObstacleCalculator'
import {TightLooseCouple} from '../../src/routing/TightLooseCouple'
import {randomInt} from '../../src/utils/random'
import {SvgDebugWriter} from '../utils/svgDebugWriter'

test('initialTightPolyline', () => {
  const shape = new Shape(CurveFactory.mkRectangleWithRoundedCorners(20, 20, 5, 5))
  const shObstCalc = new ShapeObstacleCalculator(shape, 2, 4, new Map<Shape, TightLooseCouple>())
  const tightPolyline = shObstCalc.InitialTightPolyline(shape)
  expect(Array.from(tightPolyline).length).toBe(4)
  SvgDebugWriter.dumpICurves('/tmp/initialTight.svg', [shape.BoundaryCurve, tightPolyline])
})

test('calculate', () => {
  const shape = new Shape(CurveFactory.mkRectangleWithRoundedCorners(20, 20, 5, 5))
  const shObstCalc = new ShapeObstacleCalculator(shape, 2, 4, new Map<Shape, TightLooseCouple>())
  shObstCalc.Calculate()
  expect(!shObstCalc.tightHierarchy).toBe(true)
})

test('calculate with two children', () => {
  const root = new Shape(CurveFactory.mkRectangleWithRoundedCorners(20, 20, 5, 5))
  root.UserData = 'root'
  const ch0 = new Shape(CurveFactory.mkRectangleWithRoundedCorners(5, 5, 1, 1, new Point(-10, -10)))
  ch0.UserData = 'ch0'
  const ch1 = new Shape(CurveFactory.mkRectangleWithRoundedCorners(5, 5, 1, 1, new Point(10, 10)))
  ch0.UserData = 'ch1'
  root.AddChild(ch0)
  root.AddChild(ch1)
  const shObstCalc = new ShapeObstacleCalculator(root, 2, 4, new Map<Shape, TightLooseCouple>())
  shObstCalc.Calculate()
  const tightPolylines = Array.from(shObstCalc.tightHierarchy.GetAllLeaves())
  expect(tightPolylines.length == 2).toBe(true)
})

test('overlap: two children', () => {
  const root = new Shape(CurveFactory.mkRectangleWithRoundedCorners(20, 20, 5, 5))
  root.UserData = 'root'
  const ch0 = new Shape(CurveFactory.mkRectangleWithRoundedCorners(20, 20, 1, 1, new Point(-10, -10)))
  ch0.UserData = 'ch0'
  const ch1 = new Shape(CurveFactory.mkRectangleWithRoundedCorners(20, 20, 1, 1, new Point(10, 10)))
  ch0.UserData = 'ch1'
  root.AddChild(ch0)
  root.AddChild(ch1)
  const shObstCalc = new ShapeObstacleCalculator(root, 2, 4, new Map<Shape, TightLooseCouple>())
  shObstCalc.Calculate()
  const tightPolylines = Array.from(shObstCalc.tightHierarchy.GetAllLeaves())
  expect(tightPolylines.length == 1).toBe(true)
  // const dc = []
  // for (const p of shObstCalc.coupleHierarchy.GetAllLeaves()) {
  //  dc.push(DebugCurve.mkDebugCurveCI('Red', p.TightPolyline))
  //  dc.push(DebugCurve.mkDebugCurveCI('Blue', p.LooseShape.BoundaryCurve))
  // }

  // SvgDebugWriter.dumpDebugCurves('/tmp/overlapSO.svg', dc)
})

test('overlap: random', () => {
  const root = new Shape(CurveFactory.mkRectangleWithRoundedCorners(20, 20, 5, 5))
  root.UserData = 'root'
  for (let i = 0; i < 10; i++) {
    const ch0 = new Shape(CurveFactory.mkRectangleWithRoundedCorners(2.5, 3, 1, 1, new Point(randomInt(30), randomInt(30))))
    ch0.UserData = i.toString()
    root.AddChild(ch0)
  }
  const shObstCalc = new ShapeObstacleCalculator(root, 2, 4, new Map<Shape, TightLooseCouple>())
  shObstCalc.Calculate()
  //const dc = []
  //for (const p of shObstCalc.coupleHierarchy.GetAllLeaves()) {
  // dc.push(DebugCurve.mkDebugCurveWCI(0.1, 'Red', p.TightPolyline))
  // dc.push(DebugCurve.mkDebugCurveWCI(0.1, 'Blue', p.LooseShape.BoundaryCurve))
  // }

  // SvgDebugWriter.dumpDebugCurves('/tmp/overlapRandom.svg', dc)
})
