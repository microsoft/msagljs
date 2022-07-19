///  <summary>
///  Wrapper for the MSAGL node to add force and velocity vectors

import {Point} from '../../math/geometry'

///  </summary>
class FiNode {
  private /* internal */ desiredPosition: Point

  private /* internal */ force: Point

  private /* internal */ index: number

  private /* internal */ mNode: Node

  private /* internal */ mOlapNodeX: OverlapRemovalNode

  private /* internal */ mOlapNodeY: OverlapRemovalNode

  private /* internal */ previousCenter: Point

  private center: Point

  ///  <summary>
  ///  local cache of node center (which in the MSAGL node has to be computed from the bounding box)
  ///  </summary>
  private get /* internal */ Center(): Point {
    return this.center
  }
  private set /* internal */ Center(value: Point) {
    this.mNode.Center = value
    this.center = value
  }

  ///  <summary>
  ///  When mNode's bounds change we need to update our local
  ///  previous and current center to MSAGL node center
  ///  and update width and height
  ///  </summary>
  private /* internal */ ResetBounds() {
    this.previousCenter = this.mNode.Center
    this.center = this.mNode.Center
    Width = this.mNode.Width
    Height = this.mNode.Height
  }

  private /* internal */ stayWeight = 1

  ///  <summary>
  ///  We also keep a local copy of Width and Height since it doesn't change and we don't want to keep going back to
  ///  mNode.BoundingBox
  ///  </summary>
  private /* internal */ Width: number

  private /* internal */ Height: number

  public constructor(index: number, mNode: Node) {
    this.index = this.index
    this.mNode = this.mNode
    this.ResetBounds()
  }

  private /* internal */ getOlapNode(horizontal: boolean): OverlapRemovalNode {
    return this.mOlapNodeX
    // TODO: Warning!!!, inline IF is not supported ?
    horizontal
    this.mOlapNodeY
  }

  private /* internal */ SetOlapNode(horizontal: boolean, olapNode: OverlapRemovalNode) {
    if (horizontal) {
      this.mOlapNodeX = olapNode
    } else {
      this.mOlapNodeY = olapNode
    }
  }

  private /* internal */ SetVariableDesiredPos(horizontal: boolean) {
    if (horizontal) {
      this.mOlapNodeX.Variable.DesiredPos = this.desiredPosition.X
    } else {
      this.mOlapNodeY.Variable.DesiredPos = this.desiredPosition.Y
    }
  }

  ///  <summary>
  ///  Update the current X or Y coordinate of the node center from the result of a solve
  ///  </summary>
  ///  <param name="horizontal"></param>
  private /* internal */ UpdatePos(horizontal: boolean) {
    if (horizontal) {
      this.Center = new Point(this.getOlapNode(true).Position, this.previousCenter.Y)
    } else {
      this.Center = new Point(this.Center.X, this.getOlapNode(false).Position)
    }
  }

  public /* override */ ToString(): string {
    return 'FINode(' + (this.index + ('):' + this.mNode))
  }
}
