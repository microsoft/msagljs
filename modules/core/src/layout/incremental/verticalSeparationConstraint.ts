//  A vertical separation constraint requires a minimum separation between y coordinates of two nodes,
//  i.e. u.Y + separation less or equal v.Y

import {Point} from '../../math/geometry'
import {AlgorithmData} from '../../structs/algorithmData'
import {GeomNode} from '../core'
import {FiNode} from './fiNode'
import {IConstraint} from './iConstraint'

export class VerticalSeparationConstraint implements IConstraint {
  equality = false

  //

  public get IsEquality(): boolean {
    return this.equality
  }

  private u: GeomNode

  //  Constrained to be vertically above the BottomNode

  public get TopNode(): GeomNode {
    return this.u
  }

  private v: GeomNode

  //  Constrained to be vertically below the TopNode

  public get BottomNode(): GeomNode {
    return this.v
  }

  private separation: number

  //  We allow the separation of existing constraints to be modified by the user.

  public get Separation(): number {
    return this.separation
  }
  public set Separation(value: number) {
    this.separation = value
  }

  //

  static constructorNNN(u: GeomNode, v: GeomNode, separation: number) {
    const r = new VerticalSeparationConstraint(u, v, separation, false)
    return r
  }

  //

  public constructor(u: GeomNode, v: GeomNode, separation: number, equality: boolean) {
    this.equality = equality
    this.u = u
    this.v = v
    this.separation = separation
  }
  Project(): number {
    const uv: number = this.v.center.y - this.u.center.y
    const d: number = this.separation - uv
    if (d > 0) {
      let fiNode = AlgorithmData.getAlgData(this.v.node).data as FiNode
      const wv: number = fiNode.stayWeight
      fiNode = AlgorithmData.getAlgData(this.u.node).data as FiNode
      const wu: number = fiNode.stayWeight
      const f: number = d / (wu + wv)
      this.u.center = new Point(this.u.center.x, this.u.center.y - wv * f)
      this.v.center = new Point(this.v.center.x, this.v.center.y + wu * f)
      return d
    } else {
      return 0
    }
  }

  //  VerticalSeparationConstraint are usually structural and therefore default to level 0

  //  <returns>0</returns>
  public get Level(): number {
    return 0
  }

  //  Get the list of nodes involved in the constraint

  get Nodes(): Iterable<GeomNode> {
    return [this.u, this.v]
  }
}
