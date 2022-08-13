///  <summary>
///  Fix the position of a node.
///  Create locks using FastIncrementalLayoutSettings.CreateLock method.

import {LinkedListNode} from '@esfx/collections'
import {Rectangle} from '../../math/geometry'
import {RectangularClusterBoundary} from '../../math/geometry/overlapRemoval/rectangularClusterBoundary'
import {Graph} from '../../structs/graph'
import {Assert} from '../../utils/assert'
import {GeomGraph, GeomNode} from '../core'
import {IGeomGraph} from '../initialLayout/iGeomGraph'
import {FiNode, getFiNode} from './fiNode'
import {IConstraint} from './iConstraint'

///  </summary>
export class LockPosition implements IConstraint {
  private weight = 1e6

  node: GeomNode

  listNode: LinkedListNode<LockPosition>

  ///  <summary>
  ///  Makes a constraint preserve the nodes' bounding box with a very large weight
  ///  </summary>
  ///  <param name="node"></param>
  ///  <param name="bounds"></param>
  constructor(node: GeomNode, bounds: Rectangle) {
    this.node = node
    this.Bounds = bounds
  }

  ///  <summary>
  ///  Makes a constraint to preserve the nodes' position with the specified weight
  ///  </summary>
  ///  <param name="node"></param>
  ///  <param name="bounds"></param>
  ///  <param name="weight"></param>
  static constructorNRN(node: GeomNode, bounds: Rectangle, weight: number) {
    const l = new LockPosition(node, bounds)
    l.Weight = weight
    return l
  }

  ///  <summary>
  ///  Set the weight for this lock constraint, i.e. if this constraint conflicts with some other constraint,
  ///  projection of that constraint be biased by the weights of the nodes involved
  ///  </summary>
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

  ///  <summary>
  ///  This assigns the new bounds and needs to be called after Solve() because
  ///  multiple locked nodes may cause each other to move.
  ///  </summary>
  public Bounds: Rectangle

  ///  <summary>
  ///  By default locks are not sticky and their ideal Position gets updated when they are pushed by another node.
  ///  Making them Sticky causes the locked node to spring back to its ideal Position when whatever was pushing it
  ///  slides past.
  ///  </summary>
  public Sticky: boolean
  ///  <summary>
  ///  Move node (or cluster + children) to lock position
  ///  I use stay weight in "project" of any constraints involving the locked node
  ///  </summary>
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

  ///  <summary>
  ///  LockPosition is always applied (level 0)
  ///  </summary>
  ///  <returns>0</returns>
  public get Level(): number {
    return 0
  }

  ///  <summary>
  ///  Sets the weight of the node (the FINode actually) to the weight required by this lock.
  ///  If the node is a IGeomGraph then:
  ///   - its boundaries are locked
  ///   - all of its descendant nodes have their lock weight set
  ///   - all of its descendant clusters are set to generate fixed constraints (so they don't get squashed)
  ///  Then, the node (or clusters) parents (all the way to the root) have their borders set to generate unfixed constraints
  ///  (so that this node can move freely inside its ancestors
  ///  </summary>
  SetLockNodeWeight() {
    const isCluster = this.node.hasOwnProperty('shallowNodes')
    if (isCluster) {
      const cluster = this.node as unknown as IGeomGraph
      const cb: RectangularClusterBoundary = cluster.RectangularBoundary
      cb.Lock(this.Bounds.left, this.Bounds.right, this.Bounds.top, this.Bounds.bottom)
      for (const c of cluster.subgraphsDepthFirst) {
        c.RectangularBoundary.GenerateFixedConstraints = true
        for (const child of c.shallowNodes) {
          LockPosition.SetFINodeWeight(child, this.weight)
        }
      }
    } else {
      LockPosition.SetFINodeWeight(this.node, this.weight)
    }

    for (const ancestor of this.node.getAncestors()) {
      if (ancestor.RectangularBoundary != null) {
        ancestor.RectangularBoundary.GenerateFixedConstraints = false
        ancestor.RectangularBoundary.RestoreDefaultMargin()
      }
    }
  }

  ///  <summary>
  ///  Reverses the changes made by SetLockNodeWeight
  ///  </summary>
  RestoreNodeWeight() {
    const isCluster = this.node.hasOwnProperty('shallowNodes')
    if (isCluster) {
      const cluster = this.node as unknown as IGeomGraph
      cluster.RectangularBoundary.Unlock()
      for (const c of cluster.subgraphsDepthFirst) {
        c.RectangularBoundary.GenerateFixedConstraints = c.RectangularBoundary.GenerateFixedConstraintsDefault
        for (const child of c.shallowNodes) {
          LockPosition.SetFINodeWeight(child, 1)
        }
      }
    } else {
      LockPosition.SetFINodeWeight(this.node, 1)
    }

    let parent = this.node.parent as GeomGraph
    while (parent != null) {
      if (parent.RectangularBoundary != null) {
        parent.RectangularBoundary.GenerateFixedConstraints = parent.RectangularBoundary.GenerateFixedConstraintsDefault
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

  ///  <summary>
  ///  Get the list of nodes involved in the constraint
  ///  </summary>
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
