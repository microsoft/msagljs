import {BundlingSettings} from './BundlingSettings'
import {EdgeRoutingMode} from './EdgeRoutingMode'

export class EdgeRoutingSettings {
  constructor() {
    this.EdgeRoutingMode = EdgeRoutingMode.Spline
  }
  private edgeRoutingMode: EdgeRoutingMode // = EdgeRoutingMode.SugiyamaSplines

  // defines the way edges are routed
  public get EdgeRoutingMode(): EdgeRoutingMode {
    return this.edgeRoutingMode
  }
  public set EdgeRoutingMode(value: EdgeRoutingMode) {
    if (value === EdgeRoutingMode.SplineBundling && this.BundlingSettings == null) {
      if (this.BundlingSettings == null) {
        this.BundlingSettings = new BundlingSettings()
      }
    }
    this.edgeRoutingMode = value
  }

  coneAngle = 30 * (Math.PI / 180)

  // the angle in degrees of the cones in the routing with the spanner
  public get ConeAngle(): number {
    return this.coneAngle
  }
  public set ConeAngle(value: number) {
    this.coneAngle = value
  }

  // Amount of space to leave around nodes
  padding = 3

  // Amount of space to leave around nodes
  public get Padding(): number {
    return this.padding
  }
  public set Padding(value: number) {
    this.padding = value
  }

  polylinePadding = 1.5

  // Additional amount of padding to leave around nodes when routing with polylines
  public get PolylinePadding(): number {
    return this.polylinePadding
  }
  public set PolylinePadding(value: number) {
    this.polylinePadding = value
  }

  // the settings for general edge bundling
  BundlingSettings: BundlingSettings

  routingToParentConeAngle: number = Math.PI / 6

  // this is a cone angle to find a relatively close point on the parent boundary
  public get RoutingToParentConeAngle(): number {
    return this.routingToParentConeAngle
  }
  public set RoutingToParentConeAngle(value: number) {
    this.routingToParentConeAngle = value
  }

  simpleSelfLoopsForParentEdgesThreshold = 200

  // if the number of the nodes participating in the routing of the parent edges is less than the threshold
  // then the parent edges are routed avoiding the nodes
  public get SimpleSelfLoopsForParentEdgesThreshold(): number {
    return this.simpleSelfLoopsForParentEdgesThreshold
  }
  public set SimpleSelfLoopsForParentEdgesThreshold(value: number) {
    this.simpleSelfLoopsForParentEdgesThreshold = value
  }

  incrementalRoutingThreshold = 5000000

  // debugging
  routeMultiEdgesAsBundles = true

  // defines the size of the changed graph that could be routed fast with the standard spline routing when dragging
  public get IncrementalRoutingThreshold(): number {
    return this.incrementalRoutingThreshold
  }
  public set IncrementalRoutingThreshold(value: number) {
    this.incrementalRoutingThreshold = value
  }

  // if set to true the original spline is kept under the corresponding GeomEdge
  KeepOriginalSpline = false

  // if set to true routes multi edges as ordered bundles, when routing in a spline mode
  // <exception cref="NotImplementedException"></exception>
  public get RouteMultiEdgesAsBundles(): boolean {
    return this.routeMultiEdgesAsBundles
  }
  public set RouteMultiEdgesAsBundles(value: boolean) {
    this.routeMultiEdgesAsBundles = value
  }
}
