import {ICurve, Point, Polyline} from '../math/geometry'
import {RelativeFloatingPort} from '../layout/core/relativeFloatingPort'

export class ClusterBoundaryPort extends RelativeFloatingPort {
  loosePolyline: Polyline

  get LoosePolyline(): Polyline {
    return this.loosePolyline
  }
  set LoosePolyline(value: Polyline) {
    this.loosePolyline = value
  }

  /// constructor

  /// <param name="curveDelegate"></param>
  /// <param name="centerDelegate"></param>
  /// <param name="locationOffset"></param>
  public constructor(curveDelegate: () => ICurve, centerDelegate: () => Point, locationOffset: Point = new Point(0, 0)) {
    super(curveDelegate, centerDelegate, locationOffset)
  }

  /// constructor

  /// <param name="curveDelegate"></param>
  /// <param name="centerDelegate"></param>
  public static mk(curveDelegate: () => ICurve, centerDelegate: () => Point) {
    return new ClusterBoundaryPort(curveDelegate, centerDelegate)
  }
}
