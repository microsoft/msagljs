//
//  How Clusters Work
//
//  As in the doc, we extend the existing constraint-generation mechanism by processing a
//  Cluster as a normal Node (which it inherits from), adding a pair of fake variables
//  (corresponding to its borders along the primary axis) to the Solver for it. This
//  allows us to generate Constraints between Nodes and Clusters at the same level
//  (i.OverlapRemovalNode. within the same Cluster).  Clusters may contain Nodes which are other Clusters;
//  these form a tree starting at the root of a ClusterHierarchy.  Multiple Cluster
//  Hierarchies may exist; each has its constraints evaluated separately from all other
//  ClusterHierarchies, thereby allowing intersecting clusters; a common example of this
//  is the "layer cake", where # are horizontal cluster borders and =+| are vertical:
//     +===+ +===+ +===+
//     | 0 | | 1 | | 2 |
//   ##|###|#|###|#|###|##
//   # | 3 | | 4 | | 5 | #
//   ##|###|#|###|#|###|##
//     |   | |   | |   |
//   ##|###|#|###|#|###|##
//   # | 6 | | 7 | | 8 | #
//   ##|###|#|###|#|###|##
//     | 9 | | 10| | 11|
//     +===+ +===+ +===+
//
//  In terms of flow, we process in a depth-first manner, going down through all Clusters
//  to the lowest level before calling the Solver.  Constraints can be generated in either
//  the top-down or bottom-up order; doing it bottom-up allows us to extend this to support
//  a mode that uses a Solver at the level of each cluster to solve within the cluster so
//  we know the location and size of the Cluster *after* its internal nodes have been moved
//  to their "solved" positions (@@DCR; see "Precalculate Cluster Sizes" in the design doc).
//
//  Within each Cluster, we add a "fake node" to the event list, one for each Left (Top) or
//  Right (Bottom) border, and then generate constraints using the scan-line algorithm in the doc.
//  Using the two "fake nodes" allows the within-border constraints to fall out automatically
//  from the algorithm.
//
//  After a Cluster's component Clusters have been solved in this way, then its Clusters are
//  processed as simple Nodes in its parent Cluster, including the horizontal/vertical decision
//  on least-movement direction.  However, when the Constraints are generated, they're generated
//  to the left or right border "fake nodes" rather than to the single node for the cluster.
//  We need two nodes here so the cluster can grow or shrink along the axis.
//
//  This proceeds until we back up to the root cluster of the ClusterHierarchy.
//

import {Solver} from '../../projectionSolver/Solver'
import {OverlapRemovalGlobalConfiguration} from './overlapRemovalGlobalConfiguration'
import {OverlapRemovalNode} from './overlapRemovalNode'
import {OverlapRemovalParameters} from './overlapRemovalParameters'
import {ScanLine} from './scanLine'
import {compareBooleans, compareNumbers} from '../../../utils/compare'

class Event {
  IsForOpen: boolean

  Position: number

  Node: OverlapRemovalNode

  constructor(isForOpen: boolean, node: OverlapRemovalNode, position: number) {
    this.IsForOpen = isForOpen
    this.Node = node
    this.Position = position
  }
}

//  A cluster is a structure that acts as a Node for Nodes and Clusters at a sibling level,
//  and can also contain other Clusters and/or Nodes.

export class OverlapRemovalCluster {
  //  Our internal Node list - some of which may be Clusters.
  private nodeList: Array<OverlapRemovalNode> = new Array<OverlapRemovalNode>()
  get length(): number {
    return this.nodeList.length
  }

  //  Padding of nodes within the cluster in the parallel direction.

  padding: number

  //  Padding of nodes within the cluster in the perpendicular direction.

  paddingPerp: number

  //  Zero cluster margins. This ctor is currently used only by the generator's DefaultClusterHierarchy,
  //  which by default is created with non-fixed borders and no margins.
  static constructorNN(padding: number, paddingP: number): OverlapRemovalCluster {
    return new OverlapRemovalCluster(padding, paddingP)
  }

  constructor(nodePadding: number, nodePaddingP: number) {
    this.padding = nodePadding
    this.paddingPerp = nodePaddingP
  }

  //  Generate a string representation of the Cluster.

  //  newNode may be a cluster in which case we add it to the cluster list.  We never call this to
  //  add the fake border nodes to nodeList; the caller never sees them.
  AddNode(newNode: OverlapRemovalNode) {
    this.nodeList.push(newNode)
  }

  //  Adds an open/close event pair for the node. paddingP is either cluster or node padding.
  AddEvents(node: OverlapRemovalNode, events: Array<Event>) {
    //  Add/subtract only half the padding so they meet in the middle of the padding.
    events.push(new Event(true, node, node.OpenP - this.paddingPerp / 2))
    events.push(new Event(false, node, node.CloseP + this.paddingPerp / 2))
  }

  Generate(solver: Solver, parameters: OverlapRemovalParameters, isHorizontal: boolean) {
    if (this.length == 0) {
      return
    }

    const events = this.CreateEvents(solver)
    //  If we added no events, we're either Fixed (so continue) or empty (so return).
    if (events.length == 0) {
      return
    }

    this.GenerateFromEvents(solver, parameters, events, isHorizontal)
  }

  CreateEvents(solver: Solver): Array<Event> {
    const events = new Array<Event>()
    const cNodes = this.nodeList.length
    for (let nodeIndex = 0; nodeIndex < cNodes; nodeIndex++) {
      const node: OverlapRemovalNode = this.nodeList[nodeIndex]

      //  Not a cluster; just have it add its variable to the solver.
      node.CreateVariable(solver)

      //  Now add the Node to the ScanLine event list.  Use paddingP because the scan line moves
      //  perpendicularly to the direction we're generating the constraints in.
      this.AddEvents(node, events)
      //  Update our boundaries if this node goes past any of them.
    }

    return events
  }

  GenerateFromEvents(solver: Solver, parameters: OverlapRemovalParameters, events: Array<Event>, isHorizontal: boolean) {
    //  First, sort the events on the perpendicular coordinate of the event
    //  (OverlapRemovalNode.g. for horizontal constraint generation, order on vertical position).
    events.sort((a, b) => OverlapRemovalCluster.compareEvents(a, b))
    const scanLine = new ScanLine()
    for (const evt of events) {
      const currentNode: OverlapRemovalNode = evt.Node
      if (evt.IsForOpen) {
        //  Insert the current node into the scan line.
        scanLine.Insert(currentNode)
        currentNode.LeftNeighbors = this.GetLeftNeighbours(parameters, scanLine, currentNode, isHorizontal)
        currentNode.RightNeighbors = this.GetRightNeighbours(parameters, scanLine, currentNode, isHorizontal)
        const numLeftNeighbors = currentNode.LeftNeighbors.length
        const numRightNeighbors = currentNode.RightNeighbors.length

        for (let i = 0; i < numLeftNeighbors; i++) {
          const leftNeighborNode = currentNode.LeftNeighbors[i]
          for (let j = 0; j < numRightNeighbors; j++) {
            //  TODOunit: test this
            const nodeToRemove = currentNode.RightNeighbors[j]
            removeFromArray(leftNeighborNode.RightNeighbors, nodeToRemove)
          }

          leftNeighborNode.RightNeighbors.push(currentNode)
        }

        for (let i = 0; i < numRightNeighbors; i++) {
          //  TODOunit: test this
          const rightNeighborNode: OverlapRemovalNode = currentNode.RightNeighbors[i]
          for (let j = 0; j < numLeftNeighbors; j++) {
            const nodeToRemove: OverlapRemovalNode = currentNode.LeftNeighbors[j]
            removeFromArray(rightNeighborNode.LeftNeighbors, nodeToRemove)
          }

          rightNeighborNode.LeftNeighbors.push(currentNode)
        }
      } else {
        if (currentNode.LeftNeighbors == null) {
          continue
        }

        const currentLeftNode: OverlapRemovalNode = currentNode
        const currentRightNode: OverlapRemovalNode = currentNode
        const cLeftNeighbours = currentNode.LeftNeighbors.length
        for (let i = 0; i < cLeftNeighbours; i++) {
          const origLeftNeighborNode: OverlapRemovalNode = currentNode.LeftNeighbors[i]
          removeFromArray(origLeftNeighborNode.RightNeighbors, currentNode)
          const leftNeighborNode: OverlapRemovalNode = origLeftNeighborNode
          const p = this.padding
          const separation = (leftNeighborNode.Size + currentRightNode.Size) / 2 + p
          solver.AddConstraint(leftNeighborNode.Variable, currentRightNode.Variable, separation)
        }

        const cRightNeighbours = currentNode.RightNeighbors.length
        for (let i = 0; i < cRightNeighbours; i++) {
          //  Keep original node, which may be a cluster; see comments in LeftNeighbors above.
          const origRightNeighborNode: OverlapRemovalNode = currentNode.RightNeighbors[i]
          removeFromArray(origRightNeighborNode.LeftNeighbors, currentNode)
          const rightNeighborNode: OverlapRemovalNode = origRightNeighborNode
          const p = this.padding
          const separation = (currentLeftNode.Size + rightNeighborNode.Size) / 2 + p

          solver.AddConstraint(currentLeftNode.Variable, rightNeighborNode.Variable, separation)
        }

        scanLine.Remove(currentNode)
      }
    }
  }
  static compareEvents(a: Event, b: Event): number {
    let cmp = 0
    // Use a range so that rounding inaccuracy will give consistent results.
    if (Math.abs(a.Position - b.Position) > OverlapRemovalGlobalConfiguration.EventComparisonEpsilon) {
      cmp = compareNumbers(a.Position, b.Position)
    }
    if (cmp === 0) {
      // Sub-order by IsRendered (false precedes true, which is what we want).
      cmp = compareBooleans(a.IsForOpen, b.IsForOpen)

      if (cmp === 0) {
        // Sub-order by node id
        cmp = compareNumbers(a.Node.Id, b.Node.Id)
      }
    }
    return cmp
  }

  GetLeftNeighbours(
    parameters: OverlapRemovalParameters,
    scanLine: ScanLine,
    currentNode: OverlapRemovalNode,
    isHorizontal: boolean,
  ): Array<OverlapRemovalNode> {
    const lstNeighbours = new Array<OverlapRemovalNode>()
    let nextNode: OverlapRemovalNode = scanLine.NextLeft(currentNode)
    for (; nextNode != null; nextNode = scanLine.NextLeft(nextNode)) {
      //  AddNeighbor returns false if we are done adding them.
      if (!this.AddNeighbour(parameters, currentNode, nextNode, lstNeighbours, true, isHorizontal)) {
        if (!nextNode.DeferredLeftNeighborToV) {
          break
        }
      }
    }
    return lstNeighbours
  }

  GetRightNeighbours(
    parameters: OverlapRemovalParameters,
    scanLine: ScanLine,
    currentNode: OverlapRemovalNode,
    isHorizontal: boolean,
  ): Array<OverlapRemovalNode> {
    const lstNeighbours = new Array<OverlapRemovalNode>()
    let nextNode: OverlapRemovalNode = scanLine.NextRight(currentNode)
    for (; nextNode != null; nextNode = scanLine.NextRight(nextNode)) {
      //  AddNeighbor returns false if we are done adding them.
      if (!this.AddNeighbour(parameters, currentNode, nextNode, lstNeighbours, false, isHorizontal)) {
        if (!nextNode.DeferredRightNeighborToV) {
          break
        }
      }
    }

    return lstNeighbours
  }

  AddNeighbour(
    parameters: OverlapRemovalParameters,
    currentNode: OverlapRemovalNode,
    nextNode: OverlapRemovalNode,
    neighbors: Array<OverlapRemovalNode>,
    isLeftNeighbor: boolean,
    isHorizontal: boolean,
  ): boolean {
    //  Sanity check to be sure that the borders are past all other nodes.
    const overlap = OverlapRemovalNode.Overlap(currentNode, nextNode, this.padding)
    if (overlap <= 0) {
      //  This is the first node encountered on this neighbour-traversal that did not
      //  overlap within the required padding. Add it to the list and we're done with
      //  this traversal, unless this is a vertical pass and it is not an overlap on
      //  the horizontal axis; in that case, pretend we never saw it and return true
      //  so the next non-overlapping node will be found.  (See below for more information
      //  on why this is necessary).
      if (
        !isHorizontal &&
        OverlapRemovalNode.Overlap(currentNode, nextNode, this.paddingPerp) <= parameters.SolverParameters.GapTolerance
      ) {
        return true
      }

      neighbors.push(nextNode)
      return false
    }

    if (isHorizontal) {
      if (parameters.AllowDeferToVertical) {
        //  We are doing horizontal constraints so examine the vertical overlap and see which
        //  is the smallest (normalized by total node size in that orientation) such that the
        //  least amount of movement required.  this.padding is currently the same in both
        //  directions; if this changes, we'll have to add different padding values here for
        //  each direction.  @@DCR: consider adding weights to the defer-to-vertical calculation;
        //  this would allow two nodes to pop up/down if they're being squeezed, rather than
        //  force apart the borders (which happens regardless of their weight).
        const overlapP = OverlapRemovalNode.OverlapP(currentNode, nextNode, this.paddingPerp)
        const isOverlapping: boolean = parameters.ConsiderProportionalOverlap
          ? overlap / (currentNode.Size + nextNode.Size) > overlapP / (currentNode.SizeP + nextNode.SizeP)
          : overlap > overlapP
        if (isOverlapping) {
          //  Don't skip if either of these is a border node.
          {
            //  Moving in the horizontal direction requires more movement than in the vertical
            //  direction to remove the overlap, so skip this node on horizontal constraint
            //  generation and we'll pick it up on vertical constraint generation.  Return true
            //  to keep looking for more overlapping nodes.
            //  Note: it is still possible that we'll pick up a constraint in both directions,
            //  due to either or both of this.padding and the "create a constraint to the first
            //  non-overlapping node" logic.  This is expected and the latter helps retain stability.
            //  We need to track whether we skipped these so that we don't have a broken transition chain.
            //  See Test_OverlapRemoval.cs, Test_DeferToV_Causing_Missing_Cst() for more information.
            if (isLeftNeighbor) {
              currentNode.DeferredLeftNeighborToV = true
              nextNode.DeferredRightNeighborToV = true
            } else {
              currentNode.DeferredRightNeighborToV = true
              nextNode.DeferredLeftNeighborToV = true
            }

            return true
          }
        }
      }

      //  endif AllowDeferToVertical
    } else {
      //  We're on the vertical pass so make sure we match up with the Solver's tolerance in the
      //  scanline direction, because it is possible that there was a horizontal constraint between
      //  these nodes that was within the Solver's tolerance and thus was not enforced.  In that
      //  case, we could spuriously add a vertical constraint here that would result in undesired
      //  and possibly huge vertical movement.  There is a corresponding Assert during constraint
      //  generation when the node is Closed. We have to do this here rather than at runtime because
      //  doing it then may skip a Neighbour that replaced other Neighbors by transitivity.
      if (OverlapRemovalNode.Overlap(currentNode, nextNode, this.paddingPerp) <= parameters.SolverParameters.GapTolerance) {
        return true
      }
    }

    //  Add this overlapping neighbour and return true to keep looking for more overlapping neighbours.
    neighbors.push(nextNode)
    return true
  }

  //  Overrides Node.UpdateFromVariable.
  UpdateFromVariable() {
    const cNodes = this.nodeList.length
    for (let nodeIndex = 0; nodeIndex < cNodes; nodeIndex++) {
      this.nodeList[nodeIndex].UpdateFromVariable()
    }
  }
}

function removeFromArray<T>(arr: T[], OverlapRemovalNode: T) {
  const i = arr.findIndex((a: T) => a == OverlapRemovalNode)
  if (i >= 0) {
    arr.splice(i, 1)
  }
}
