///  <summary>
///  Wrapper for GeomNode node to add force and velocity vectors

import {Point} from '../../math/geometry'
import {OverlapRemovalNode} from '../../math/geometry/overlapRemoval/overlapRemovalNode'
import {AlgorithmData} from '../../structs/algorithmData'
import {GeomNode} from '../core'

export function getFiNode(filNode: GeomNode): FiNode | null {
  const algData = AlgorithmData.getAlgData(filNode.node)
  if (algData == null) return null
  return <FiNode>AlgorithmData.getAlgData(filNode.node).data
}
///  </summary>
export class FiNode {
  desiredPosition: Point

  force = new Point(0, 0)

  index: number

  mNode: GeomNode

  mOlapNodeX: OverlapRemovalNode

  mOlapNodeY: OverlapRemovalNode

  previousCenter: Point

  private center: Point

  ///  <summary>
  ///  local cache of node center (which in the MSAGL node has to be computed from the bounding box)
  ///  </summary>
  get Center(): Point {
    return this.center
  }
  set Center(value: Point) {
    this.mNode.center = value
    this.center = value
  }

  ///  <summary>
  ///  When mNode's bounds change we need to update our local
  ///  previous and current center to MSAGL node center
  ///  and update width and height
  ///  </summary>
  ResetBounds() {
    this.previousCenter = this.mNode.center
    this.center = this.mNode.center
    this.Width = this.mNode.width
    this.Height = this.mNode.height
  }

  stayWeight = 1

  ///  <summary>
  ///  We also keep a local copy of Width and Height since it doesn't change and we don't want to keep going back to
  ///  mNode.BoundingBox
  ///  </summary>
  Width: number

  Height: number

  public constructor(index: number, mNode: GeomNode) {
    this.index = index
    this.mNode = mNode
    this.ResetBounds()
  }

  getOlapNode(horizontal: boolean): OverlapRemovalNode {
    return horizontal ? this.mOlapNodeX : this.mOlapNodeY
  }

  SetOlapNode(horizontal: boolean, olapNode: OverlapRemovalNode) {
    if (horizontal) {
      this.mOlapNodeX = olapNode
    } else {
      this.mOlapNodeY = olapNode
    }
  }

  SetVariableDesiredPos(horizontal: boolean) {
    if (horizontal) {
      this.mOlapNodeX.Variable.DesiredPos = this.desiredPosition.x
    } else {
      this.mOlapNodeY.Variable.DesiredPos = this.desiredPosition.y
    }
  }

  ///  <summary>
  ///  Update the current X or Y coordinate of the node center from the result of a solve
  ///  </summary>
  ///  <param name="horizontal"></param>
  UpdatePos(horizontal: boolean) {
    if (horizontal) {
      this.Center = new Point(this.getOlapNode(true).Position, this.previousCenter.y)
    } else {
      this.Center = new Point(this.Center.x, this.getOlapNode(false).Position)
    }
  }

  public ToString(): string {
    return 'FINode(' + (this.index + ('):' + this.mNode))
  }
}
