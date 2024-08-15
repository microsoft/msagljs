// The class calculates obstacles under the shape.
// We assume that the boundaries are not set for the shape children yet

import {Point} from '..'
import {Curve, PointLocation} from '../math/geometry'
import {ConvexHull} from '../math/geometry/convexHull'
import {Polyline} from '../math/geometry/polyline'
import {CreateRectNodeOnArrayOfRectNodes, mkRectangleNode, RectangleNode} from '../math/geometry/RTree/rectangleNode'
import {CrossRectangleNodes} from '../math/geometry/RTree/rectangleNodeUtils'
import {initRandom} from '../utils/random'
import {flattenArray} from '../utils/setOperations'
import {InteractiveObstacleCalculator} from './interactiveObstacleCalculator'
import {Shape} from './shape'
import {TightLooseCouple} from './TightLooseCouple'
import {Node} from '../structs/node'

export class ShapeObstacleCalculator {
  tightHierarchy: RectangleNode<Polyline, Point>

  coupleHierarchy: RectangleNode<TightLooseCouple, Point>
  loosePolylinesToNodes = new Map<Polyline, Set<Node>>()
  RootOfLooseHierarchy: RectangleNode<Shape, Point>

  constructor(shape: Shape, tightPadding: number, loosePadding: number, shapesToTightLooseCouples: Map<Shape, TightLooseCouple>) {
    this.MainShape = shape
    this.TightPadding = tightPadding
    this.LoosePadding = loosePadding
    this.ShapesToTightLooseCouples = shapesToTightLooseCouples
  }

  ShapesToTightLooseCouples: Map<Shape, TightLooseCouple>
  tightToShapes: Map<Polyline, Array<Shape>> // polyline forms a tight bound for each shape from this.tightToShape.get(polyline)
  TightPadding: number

  LoosePadding: number
  MainShape: Shape
  OverlapsDetected: boolean

  Calculate(randomizationShift: number) {
    initRandom(3) // keep it the same all the time, otherwise the path optimizer migth not work
    if (this.MainShape.Children.length === 0) {
      return
    }

    this.CreateTightObstacles()
    this.CreateTigthLooseCouples(randomizationShift)
    if (this.OverlapsDetected) {
      this.FillTheMapOfShapeToTightLooseCouples()
    }
  }
  FillTheMapOfShapeToTightLooseCouples() {
    const childrenShapeHierarchy = CreateRectNodeOnArrayOfRectNodes(this.MainShape.Children.map((s) => mkRectangleNode(s, s.BoundingBox)))
    CrossRectangleNodes(childrenShapeHierarchy, this.coupleHierarchy, this.TryMapShapeToTightLooseCouple.bind(this))
  }

  TryMapShapeToTightLooseCouple(shape: Shape, tightLooseCouple: TightLooseCouple) {
    if (ShapeObstacleCalculator.ShapeIsInsideOfPoly(shape, tightLooseCouple.TightPolyline)) {
      this.ShapesToTightLooseCouples.set(shape, tightLooseCouple)
    }
  }

  // this test is valid in our situation where the tight polylines are disjoint and the shape can cross only one of them
  static ShapeIsInsideOfPoly(shape: Shape, tightPolyline: Polyline): boolean {
    return Curve.PointRelativeToCurveLocation(shape.BoundaryCurve.start, tightPolyline) === PointLocation.Inside
  }

  CreateTigthLooseCouples(randomizationShift: number) {
    const couples = new Array<TightLooseCouple>()
    for (const tightPolyline of this.tightHierarchy.GetAllLeaves()) {
      const distance = InteractiveObstacleCalculator.FindMaxPaddingForTightPolyline(this.tightHierarchy, tightPolyline, this.LoosePadding)
      const loosePoly = InteractiveObstacleCalculator.LoosePolylineWithFewCorners(tightPolyline, distance, randomizationShift)
      const looseShape = new Shape(loosePoly)
      const cpl = TightLooseCouple.mk(tightPolyline, looseShape, distance)
      const shapes = this.tightToShapes.get(tightPolyline)
      for (const shape of shapes)
        this.ShapesToTightLooseCouples.set(shape, cpl)

      couples.push(cpl)
    }

    this.coupleHierarchy = CreateRectNodeOnArrayOfRectNodes(
      couples.map((c) => mkRectangleNode<TightLooseCouple, Point>(c, c.TightPolyline.boundingBox)),
    )
  }

  CreateTightObstacles() {
    this.tightToShapes = new Map<Polyline, Array<Shape>>()
    const tightObstacles = new Set<Polyline>(this.MainShape.Children.map(this.InitialTightPolyline.bind(this)))
    const initialNumberOfTightObstacles: number = tightObstacles.size
    this.tightHierarchy = InteractiveObstacleCalculator.
      RemovePossibleOverlapsInTightPolylinesAndCalculateHierarchy(tightObstacles, this.tightToShapes)
    this.OverlapsDetected = initialNumberOfTightObstacles > tightObstacles.size
  }

  InitialTightPolyline(shape: Shape): Polyline {
    let poly = InteractiveObstacleCalculator.PaddedPolylineBoundaryOfNode(shape.BoundaryCurve, this.TightPadding)
    const stickingPointsArray = flattenArray(this.LoosePolylinesUnderShape(shape), (p) => p).filter(
      (p) => Curve.PointRelativeToCurveLocation(p, poly) === PointLocation.Outside,
    )

    if (stickingPointsArray.length == 0) {
      if (this.tightToShapes)
        this.tightToShapes.set(poly, [shape]) 
        
      return poly
    }
    const pts = Array.from(poly).concat(stickingPointsArray)
    poly = Polyline.mkClosedFromPoints(ConvexHull.CalculateConvexHull(pts))
    if (this.tightToShapes)
      this.tightToShapes.set(poly, [shape])
     
    return poly
  }

  LoosePolylinesUnderShape(shape: Shape): Array<Polyline> {
    return shape.Children.map((child) => <Polyline>this.ShapesToTightLooseCouples.get(child).LooseShape.BoundaryCurve)
  }
}
