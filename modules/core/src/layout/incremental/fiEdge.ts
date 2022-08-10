import {Point} from '../../math/geometry'
import {FiNode} from './fiNode'
import {IEdge} from '../../structs/iedge'
import {GeomEdge} from '../core'
import {AlgorithmData} from '../core/algorithmData'
///  </summary>

export class FiEdge implements IEdge {
  mEdge: GeomEdge

  public sourceFiNode: FiNode

  public targetFiNode: FiNode

  public constructor(mEdge: GeomEdge) {
    this.mEdge = mEdge
    this.sourceFiNode = <FiNode>(<unknown>AlgorithmData.getAlgData(this.mEdge.source.node).data)
    this.targetFiNode = <FiNode>(<unknown>AlgorithmData.getAlgData(this.mEdge.target.node).data)
  }

  public get source(): number {
    return this.sourceFiNode.index
  }

  public get target(): number {
    return this.targetFiNode.index
  }
  private _length = 1
  public get length() {
    return this._length
  }
  public set length(value) {
    this._length = value
  }

  vector(): Point {
    return this.sourceFiNode.mNode.center.sub(this.targetFiNode.mNode.center)
  }
}
