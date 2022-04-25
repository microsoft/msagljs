import {GeomEdge} from '../layout/core'

export class BundlingSettings {
  // the default value of CapacityOverflowCoefficient
  public static DefaultCapacityOverflowCoefficientMultiplier = 1000

  capacityOverflowCoefficient: number = BundlingSettings.DefaultCapacityOverflowCoefficientMultiplier
  RotateBundles = false

  // this number is muliplied by the overflow penalty cost and by the sum of the LengthImportanceCoefficient
  // and InkImportanceCoefficient, and added to the routing price

  public get CapacityOverflowCoefficient(): number {
    return this.capacityOverflowCoefficient
  }
  public set CapacityOverflowCoefficient(value: number) {
    this.capacityOverflowCoefficient = value
  }

  //  the upper bound of the virtual node radius
  MaxHubRadius = 50

  //  the lower bound of the virtual node radius
  MinHubRadius = 0.1

  CreateUnderlyingPolyline = false

  // the default path lenght importance coefficient
  public static DefaultPathLengthImportance = 500

  pathLengthImportance: number = BundlingSettings.DefaultPathLengthImportance

  //  the importance of path lengths coefficient
  public get PathLengthImportance(): number {
    return this.pathLengthImportance
  }
  public set PathLengthImportance(value: number) {
    this.pathLengthImportance = value
  }

  // the default ink importance
  public static DefaultInkImportance = 0.01

  inkImportance: number = BundlingSettings.DefaultInkImportance

  public get InkImportance(): number {
    return this.inkImportance
  }
  public set InkImportance(value: number) {
    this.inkImportance = value
  }

  edgeSeparation: number = BundlingSettings.DefaultEdgeSeparation

  /** default edge separation */
  public static DefaultEdgeSeparation = 0.5

  /** Separation between the neighbor edges within a bundle */
  public get EdgeSeparation(): number {
    return this.edgeSeparation
  }

  public set EdgeSeparation(value: number) {
    this.edgeSeparation = value
  }

  /** this could be different from bundlingSetting.EdgeSeparation
   *    and could be a negative number
   */
  private _edgeWidthShrinkCoeff = 1
  public get edgeWidthShrinkCoeff() {
    return this._edgeWidthShrinkCoeff
  }
  public set edgeWidthShrinkCoeff(value) {
    this._edgeWidthShrinkCoeff = value
  }
  public ActualEdgeWidth(e: GeomEdge, coeff = this.edgeWidthShrinkCoeff): number {
    return coeff * (this.edgeSeparation + e.lineWidth)
  }

  useCubicBezierSegmentsInsideOfHubs: boolean

  // if is set to true will be using Cubic Bezie Segments inside of hubs, otherwise will be using Biarcs
  public get UseCubicBezierSegmentsInsideOfHubs(): boolean {
    return this.useCubicBezierSegmentsInsideOfHubs
  }
  public set UseCubicBezierSegmentsInsideOfHubs(value: boolean) {
    this.useCubicBezierSegmentsInsideOfHubs = value
  }

  angleThreshold: number = (Math.PI / 180) * 45

  // 45 degrees;
  // min angle for gluing edges
  public get AngleThreshold(): number {
    return this.angleThreshold
  }
  public set AngleThreshold(value: number) {
    this.angleThreshold = value
  }

  hubRepulsionImportance = 100

  //  the importance of hub repulsion coefficient
  public get HubRepulsionImportance(): number {
    return this.hubRepulsionImportance
  }
  public set HubRepulsionImportance(value: number) {
    this.hubRepulsionImportance = value
  }

  bundleRepulsionImportance = 100

  //  the importance of bundle repulsion coefficient
  public get BundleRepulsionImportance(): number {
    return this.bundleRepulsionImportance
  }
  public set BundleRepulsionImportance(value: number) {
    this.bundleRepulsionImportance = value
  }

  minimalRatioOfGoodCdtEdges = 0.9

  //  minimal ration of cdt edges with satisfied capacity needed to perform bundling
  //  (otherwise bundling will not be executed)
  public get MinimalRatioOfGoodCdtEdges(): number {
    return this.minimalRatioOfGoodCdtEdges
  }
  public set MinimalRatioOfGoodCdtEdges(value: number) {
    this.minimalRatioOfGoodCdtEdges = value
  }

  highestQuality = true

  //  speed vs quality of the drawing
  public get HighestQuality(): boolean {
    return this.highestQuality
  }
  public set HighestQuality(value: boolean) {
    this.highestQuality = value
  }

  //  if is set to true the original spline before the trimming should be kept under the corresponding GeomEdge
  KeepOriginalSpline = false

  //  if set to true then the edges will be routed one on top of each other with no gap inside of a bundle
  KeepOverlaps = false

  //  calculates the routes that just follow the visibility graph
  StopAfterShortestPaths = false
}
