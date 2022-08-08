// Settings controlling how ideal edge lengths will be calculated for layouts that consider it.

import {Direction} from '../math/geometry/direction'
export type EdgeConstraintsJSON = {
  direction?: Direction
  separation?: number
}
export class EdgeConstraints {
  static fromJSON(s: EdgeConstraintsJSON): EdgeConstraints {
    const r = new EdgeConstraints()
    if (s.direction) r.direction = s.direction
    if (s.separation) r.Separation = s.separation
    return r
  }
  toJSON(): EdgeConstraintsJSON {
    const ret: EdgeConstraintsJSON = {}
    if (this.direction != Direction.None) {
      ret.direction = this.direction
    }
    if (this.Separation) {
      ret.separation = this.Separation
    }
    return ret
  }
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
