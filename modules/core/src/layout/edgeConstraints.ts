// Settings controlling how ideal edge lengths will be calculated for layouts that consider it.

import {Direction} from '../math/geometry/direction'

export class EdgeConstraints {
  direction = Direction.None
  constrainedEdgeSeparation = 0
  // If not equal to Direction.None, then direction separation constraints will be applied to all edges on InitializeLayout
  public get Direction(): Direction {
    return this.direction
  }
  public set Direction(value: Direction) {
    this.direction = value
  }

  // Controls the separation used in Edge Constraints
  public get Separation(): number {
    return this.constrainedEdgeSeparation
  }
  public set Separation(value: number) {
    this.constrainedEdgeSeparation = value
  }
}
