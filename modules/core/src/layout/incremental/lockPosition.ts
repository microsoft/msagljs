//  Fix the position of a node.
//  Create locks using FastIncrementalLayoutSettings.CreateLock method.

import {LinkedListNode} from '@esfx/collections'
import {Rectangle} from '../../math/geometry'
import {RectangularClusterBoundary} from '../../math/geometry/overlapRemoval/rectangularClusterBoundary'
import {Assert} from '../../utils/assert'
import {GeomGraph, GeomNode} from '../core'
import {IGeomGraph} from '../initialLayout/iGeomGraph'
import {getFiNode} from './fiNode'
import {IConstraint} from './iConstraint'

export class LockPosition implements IConstraint {
  private weight = 1e6

  node: GeomNode

  listNode: LinkedListNode<LockPosition>
  rectangularBoundary: (g: IGeomGraph) => RectangularClusterBoundary

  /**   Makes a constraint preserve the nodes' bounding box with a very large weight*/
  constructor(node: GeomNode, bounds: Rectangle, rectBoundary: (g: IGeomGraph) => RectangularClusterBoundary) {
    this.node = node
    this.Bounds = bounds
    this.rectangularBoundary = rectBoundary
  }

  //  Makes a constraint to preserve the nodes' position with the specified weight

  static constructorNRN(node: GeomNode, bounds: Rectangle, weight: number, rectBoundary: (g: IGeomGraph) => RectangularClusterBoundary) {
    const l = new LockPosition(node, bounds, rectBoundary)
    l.Weight = weight
    return l
  }

  //  Set the weight for this lock constraint, i.e. if this constraint conflicts with some other constraint,
  //  projection of that constraint be biased by the weights of the nodes involved

  public get Weight(): number {
    return this.weight
  }
  public set Weight(value: number) {
    if (value > 1e20) {
      throw new Error('value = ' + value.toString() + ' must be < 1e10 or we run out of precision')
    }

    if (value < 0.001) {
      throw new Error('value = ' + value.toString() + 'must be > 1e-3 or we run out of precision')
    }

    this.weight = value
  }

  //  This assigns the new bounds and needs to be called after Solve() because
  //  multiple locked nodes may cause each other to move.

  public Bounds: Rectangle

  //  By default locks are not sticky and their ideal Position gets updated when they are pushed by another node.
  //  Making them Sticky causes the locked node to spring back to its ideal Position when whatever was pushing it
  //  slides past.

  public Sticky: boolean

  //  Move node (or cluster + children) to lock position
  //  I use stay weight in "project" of any constraints involving the locked node

  public Project(): number {
    const delta = this.Bounds.leftBottom.sub(this.node.boundingBox.leftBottom)
    const deltaLength: number = delta.length
    let displacement: number = deltaLength
    const isCluster = this.node instanceof GeomGraph
    if (isCluster) {
      const gg = this.node as GeomGraph
      for (const c of gg.subgraphsDepthFirst) {
        for (const v of c.shallowNodes) {
          v.translate(delta)
          displacement += deltaLength
        }
        Assert.assert((c as unknown as GeomNode) != gg)
        const r = c.boundingBox
        c.boundingBox = Rectangle.mkPP(r.leftBottom.add(delta), r.rightTop.add(delta))
      }
      gg.boundingBox = this.Bounds
    } else {
      this.node.boundingBox = this.Bounds
    }

    return displacement
  }

  //  LockPosition is always applied (level 0)

  //  <returns>0</returns>
  public get Level(): number {
    return 0
  }

  //  Sets the weight of the node (the FINode actually) to the weight required by this lock.
  //  If the node is a IGeomGraph then:
  //   - its boundaries are locked
  //   - all of its descendant nodes have their lock weight set
  //   - all of its descendant clusters are set to generate fixed constraints (so they don't get squashed)
  //  Then, the node (or clusters) parents (all the way to the root) have their borders set to generate unfixed constraints
  //  (so that this node can move freely inside its ancestors

  SetLockNodeWeight() {
    const isCluster = this.node.hasOwnProperty('shallowNodes')
    if (isCluster) {
      const cluster = this.node as unknown as IGeomGraph
      const cb: RectangularClusterBoundary = this.rectangularBoundary(cluster)
      cb.Lock(this.Bounds.left, this.Bounds.right, this.Bounds.top, this.Bounds.bottom)
      for (const c of cluster.subgraphsDepthFirst) {
        this.rectangularBoundary(c).GenerateFixedConstraints = true
        for (const child of c.shallowNodes) {
          LockPosition.SetFINodeWeight(child, this.weight)
        }
      }
    } else {
      LockPosition.SetFINodeWeight(this.node, this.weight)
    }

    for (const ancestor of this.node.getAncestors()) {
      const rb = this.rectangularBoundary(ancestor)
      if (rb != null) {
        rb.GenerateFixedConstraints = false
        rb.RestoreDefaultMargin()
      }
    }
  }

  //  Reverses the changes made by SetLockNodeWeight

  RestoreNodeWeight() {
    const isCluster = this.node.hasOwnProperty('shallowNodes')
    if (isCluster) {
      const cluster = this.node as unknown as IGeomGraph
      this.rectangularBoundary(cluster).Unlock()
      for (const c of cluster.subgraphsDepthFirst) {
        const rb = this.rectangularBoundary(c)
        rb.GenerateFixedConstraints = rb.GenerateFixedConstraintsDefault
        for (const child of c.shallowNodes) {
          LockPosition.SetFINodeWeight(child, 1)
        }
      }
    } else {
      LockPosition.SetFINodeWeight(this.node, 1)
    }

    let parent = this.node.parent as GeomGraph
    while (parent != null) {
      const rb = this.rectangularBoundary(parent)
      if (rb != null) {
        rb.GenerateFixedConstraints = rb.GenerateFixedConstraintsDefault
      }

      parent = parent.parent as GeomGraph
    }
  }

  private static SetFINodeWeight(child: GeomNode, weight: number) {
    const v = getFiNode(child)
    if (v != null) {
      v.stayWeight = weight
    }
  }

  //  Get the list of nodes involved in the constraint

  public get Nodes(): Iterable<GeomNode> {
    const nodes = new Array<GeomNode>()
    const isCluster = this.node.hasOwnProperty('shallowNodes')
    if (isCluster) {
      const cluster = this.node as GeomGraph
      for (const n of cluster.shallowNodes) nodes.push(n)
    } else {
      nodes.push(this.node)
    }

    return nodes
  }
}
