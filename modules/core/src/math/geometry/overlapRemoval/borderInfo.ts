import {OverlapRemovalGlobalConfiguration} from './overlapRemovalGlobalConfiguration'
import {String} from 'typescript-string-operations'
export class BorderInfo {
  ///  <summary>
  ///  Space between the border and any nodes or clusters within it, in addition
  ///  to any internode padding specified for the ConstraintGenerator.  This effectively
  ///  sets the outer border margin to the outermost node's outer border plus this
  ///  InnerMargin (unless fixed, in which case the FixedPosition is the outer border
  ///  and it is assumed to include space for InnerMargin).
  ///  Does not apply to nodes or clusters outside the cluster.
  ///  </summary>
  InnerMargin: number
  ///  <summary>
  ///  A fixed border position calculated by the application; nodes and clusters
  ///  inside or outside the border will move in relation to it but the border
  ///  remains stationary.  This is the axis coordinate of the outer border edge
  ///  of the cluster on this side.  This value is NoFixedPosition if not set, and
  ///  may be set to NoFixedPosition to clear it.  In order for the position to
  ///  remain "fixed", set Weight to some large value, such as DefaultFixedWeight.
  ///  </summary>
  FixedPosition: number

  ///  <summary>
  ///  Border weight; set high to enforce FixedPosition.  By default it is low
  ///  to allow the border to move freely, sizing the cluster according to the
  ///  movement of its contained nodes and clusters.
  ///  </summary>
  public get Weight(): number {
    return this.borderWeight
  }
  public set Weight(value: number) {
    if (value <= 0) {
      throw new Error('value')
    }

    this.borderWeight = value
  }

  borderWeight: number

  ///  <summary>
  ///  Returns whether FixedPosition has been set.
  ///  </summary>
  public get IsFixedPosition(): boolean {
    return !Number.isNaN(this.FixedPosition) && this.Weight > 0
  }

  ///  <summary>
  ///  Default weight for an unfixed border's Weight property; the property may be overridden
  ///  by the application.
  ///  </summary>
  public static get DefaultFreeWeight(): number {
    return OverlapRemovalGlobalConfiguration.ClusterDefaultFreeWeight
  }

  ///  <summary>
  ///  Default weight for a fixed border's Weight property; the property may be overridden
  ///  by the application.
  ///  </summary>
  public static get DefaultFixedWeight(): number {
    return OverlapRemovalGlobalConfiguration.ClusterDefaultFixedWeight
  }

  ///  <summary>
  ///  Value gotten from or set to FixedPosition indicating that it's not set.
  ///  </summary>
  public static get NoFixedPosition(): number {
    return NaN
  }

  ///  <summary>
  ///  Sets the border to fixed (resistant to movement).
  ///  </summary>
  ///  <param name="position">desired position</param>
  ///  <param name="weight">coefficient of allowed movement relative to other terms; higher
  ///          weight is more resistant to movement.  High-weight borders can still move each other
  ///          due to constraint satisfaction of intervening clusters/variables.</param>
  public SetFixed(position: number, weight: number) {
    this.FixedPosition = position
    this.Weight = weight
  }

  ///  <summary>
  ///  Sets the border to unfixed (freely moving).
  ///  </summary>
  public SetUnfixed() {
    this.FixedPosition = BorderInfo.NoFixedPosition
    this.Weight = BorderInfo.DefaultFreeWeight
  }

  ///  <summary>
  ///  Constructor taking only a margin-width value.
  ///  </summary>
  /// <param name="innerMargin"></param>
  public static constructorN(innerMargin: number): BorderInfo {
    return new BorderInfo(innerMargin, BorderInfo.NoFixedPosition, BorderInfo.DefaultFreeWeight)
  }

  ///  <summary>
  ///  Constructor taking values for margin, fixed position, and weight.
  ///  </summary>
  ///  <param name="innerMargin"></param>
  ///  <param name="fixedPosition"></param>
  ///  <param name="weight"></param>
  public constructor(innerMargin: number, fixedPosition: number, weight: number) {
    this.InnerMargin = innerMargin
    this.FixedPosition = fixedPosition
    this.Weight = weight
  }

  EnsureWeight() {
    //  Weight must be > 0.0 (we'll divide by this later); use DefaultFreeWeight or DefaultFixedWeight,
    //  or call one of the parameterized ctors or SetFixed/SetUnfixed.  Assert this for TEST_MSAGL builds
    //  but handle the default case for release.
    //  Debug.Assert(this.Weight > 0, 'BorderInfo.Weight must be > 0.0; use DefaultFreeWeight or DefaultFixedWeight or a parameterized ctor')
    if (this.Weight == 0) {
      //  This is probably the default ctor that we can't override in a struct so default to unfixed.
      this.Weight = BorderInfo.DefaultFreeWeight
      if (this.FixedPosition == 0) {
        this.FixedPosition = BorderInfo.NoFixedPosition
      }
    }
  }

  ///  <summary>
  ///  Generate a string representation of the BorderInfo.
  ///  </summary>
  ///  <returns>A string representation of the BorderInfo.</returns>
  ToString(): string {
    return String.Format('m {0:F5} p {1:F5} w {2:F5}', this.InnerMargin, this.FixedPosition, this.Weight)
  }

  //  Omitting any of the following violates rule: OverrideEqualsAndOperatorEqualsOnValueTypes
  ///  <summary>
  ///  Compare objects based upon data members.
  ///  </summary>
  ///  <param name="obj">Object to be compared to the current object.</param>
  ///  <returns></returns>
  Equals(obj: any): boolean {
    if (!(obj instanceof BorderInfo)) {
      return false
    }

    return obj.FixedPosition == this.FixedPosition && obj.Weight == this.Weight && obj.InnerMargin == this.InnerMargin
  }

  ///  <summary>
  ///  Compare two BorderInfo objects for ordering based upon data members.
  ///  </summary>
  ///  <returns></returns>
  public static less(left: BorderInfo, right: BorderInfo): boolean {
    if (left.FixedPosition < right.FixedPosition) {
      return true
    }

    if (left.FixedPosition > right.FixedPosition) {
      return false
    }

    if (left.Weight < right.Weight) {
      return true
    }

    if (left.Weight > right.Weight) {
      return false
    }

    return left.InnerMargin < right.InnerMargin
  }

  ///  Compare two BorderInfo objects for ordering based upon data members.

  public static greater(left: BorderInfo, right: BorderInfo): boolean {
    return BorderInfo.less(right, left)
  }
}