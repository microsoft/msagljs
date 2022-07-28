import {RBTree} from '../../../structs/RBTree/rbTree'
import {OverlapRemovalNode} from './overlapRemovalNode'
export class ScanLine {
  //  This is the data structure that allows fast insert/remove of nodes as well as
  //  scanning next/prev in the perpendicular direction to the scan line movement
  //  (i.e. if this the scan line is moving vertically (top to bottom), then we are
  //  on the horizontal separation constraint pass and this.nodeTree orders nodes in the
  //  horizontal direction).
  //  Note that this is ordered on the midpoint (aka Variable.DesiredPos).  Once
  //  again, transitivity saves us; we don't have to worry about combinations of
  //  midpoint and sizes that mean that a node with a further midpoint has a closer
  //  border than a node with a nearer midpoint, because in that case, the node with
  //  the nearer midpoint would have a constraint generated on the node with the
  //  further midpoint (though in that case we probably generate a duplicative constraint
  //  between the current node and the node with the further midpoint).
  nodeTree: RBTree<OverlapRemovalNode> = new RBTree<OverlapRemovalNode>((a, b) => a.compareTo(b))

  Insert(node: OverlapRemovalNode) {
    //  Debug.Assert(null == this.nodeTree.Find(node), "node already exists in the rbtree");
    //  RBTree's internal operations on insert/remove etc. mean the node can't cache the
    //  RBNode returned by insert(); instead we must do find() on each call.
    this.nodeTree.insert(node)
  }

  Remove(node: OverlapRemovalNode) {
    this.nodeTree.remove(node)
  }

  NextLeft(node: OverlapRemovalNode): OverlapRemovalNode {
    const pred = this.nodeTree.previous(this.nodeTree.find(node))
    return pred != null ? pred.item : null
  }

  NextRight(node: OverlapRemovalNode): OverlapRemovalNode {
    const succ = this.nodeTree.next(this.nodeTree.find(node))
    return succ != null ? succ.item : null
  }
}
