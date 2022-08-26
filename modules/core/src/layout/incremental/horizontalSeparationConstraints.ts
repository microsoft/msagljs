///  <summary>
///  A horizontal separation constraint requires a minimum separation between x coordinates of two nodes,
///  i.e. u.X + separation less or equal v.X

import {Point} from '../../math/geometry'
import {AlgorithmData} from '../../structs/algorithmData'
import {GeomNode} from '../core'
import {FiNode} from './fiNode'
import {IConstraint} from './iConstraint'

///  </summary>
export class HorizontalSeparationConstraint implements IConstraint {
  equality: boolean

  ///  <summary>
  ///
  ///  </summary>
  public get IsEquality(): boolean {
    return this.equality
  }

  private u: GeomNode

  ///  <summary>
  ///  Constrained to be vertically above the BottomNode
  ///  </summary>
  public get LeftNode(): GeomNode {
    return this.u
  }

  private v: GeomNode

  ///  <summary>
  ///  Constrained to be vertically below the TopNode
  ///  </summary>
  public get RightNode(): GeomNode {
    return this.v
  }

  private separation: number

  ///  <summary>
  ///  We allow the separation of existing constraints to be modified by the user.
  ///  </summary>
  public get Separation(): number {
    return this.separation
  }
  public set Separation(value: number) {
    this.separation = value
  }

  ///  <summary>
  ///
  ///  </summary>
  ///  <param name="u"></param>
  ///  <param name="v"></param>
  ///  <param name="separation"></param>
  static constructorNNN(u: GeomNode, v: GeomNode, separation: number) {
    return new HorizontalSeparationConstraint(u, v, separation, false)
  }

  ///  <summary>
  ///
  ///  </summary>
  ///  <param name="u"></param>
  ///  <param name="v"></param>
  ///  <param name="separation"></param>
  ///  <param name="equality"></param>
  public constructor(u: GeomNode, v: GeomNode, separation: number, equality: boolean) {
    this.equality = equality
    this.u = u
    this.v = v
    this.separation = separation
  }

  ///  <summary>
  ///
  ///  </summary>
  public /* virtual */ Project(): number {
    const uv: number = this.v.center.x - this.u.center.x
    const d: number = this.separation - uv
    if (d > 0) {
      const wv: number = (<FiNode>AlgorithmData.getAlgData(this.v.node).data).stayWeight
      const wu: number = (<FiNode>AlgorithmData.getAlgData(this.u.node).data).stayWeight
      const f: number = d / (wu + wv)
      this.u.center = new Point(this.u.center.x - wv * f, this.u.center.y)
      this.v.center = new Point(this.v.center.x + wu * f, this.v.center.y)
      return d
    } else {
      return 0
    }
  }

  ///  <summary>
  ///  HorizontalSeparationConstraint are usually structural and therefore default to level 0
  ///  </summary>
  ///  <returns>0</returns>
  public get Level(): number {
    return 0
  }

  ///  <summary>
  ///  Get the list of nodes involved in the constraint
  ///  </summary>
  public get Nodes(): Iterable<GeomNode> {
    return [this.u, this.v]
  }
}
