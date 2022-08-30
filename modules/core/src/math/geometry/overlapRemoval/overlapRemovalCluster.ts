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

import {Constraint} from '../../projectionSolver/Constraint'
import {Solver} from '../../projectionSolver/Solver'
import {Rectangle} from '../rectangle'
import {BorderInfo} from './borderInfo'
import {OverlapRemovalGlobalConfiguration} from './overlapRemovalGlobalConfiguration'
import {OverlapRemovalNode} from './overlapRemovalNode'
import {OverlapRemovalParameters} from './overlapRemovalParameters'
import {String} from 'typescript-string-operations'
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

///  A cluster is a structure that acts as a Node for Nodes and Clusters at a sibling level,
///  and can also contain other Clusters and/or Nodes.
///  </summary>
export class OverlapRemovalCluster extends OverlapRemovalNode {
  //  Our internal Node list - some of which may be Clusters.
  nodeList: Array<OverlapRemovalNode> = new Array<OverlapRemovalNode>()

  ///  Empty clusters are ignored on positioning.

  public get IsEmpty(): boolean {
    return this.nodeList.length == 0
  }

  ///  If the following is true then constraints will be generated the prevent children coming
  ///  any closer to the cluster boundaries.  In effect, this means that the cluster and all
  ///  it's children will be translated together rather than being "compressed" if there are
  ///  overlaps with external nodes.

  //  AKA: "Bump Mode"
  TranslateChildren: boolean

  //  Our internal "fake nodes" as above; these are separate from the size calculations
  //  for the overall Cluster.

  ///  The internal Node containing the Variable to which left-border constraints are made.

  LeftBorderNode: OverlapRemovalNode

  ///  The internal Node containing the Variable to which right-border constraints are made.

  RightBorderNode: OverlapRemovalNode

  //  Indicates if the cluster's GenerateWorker placed anything into the solver.
  IsInSolver: boolean

  ///  Opening margin of this cluster (additional space inside the cluster border)
  ///  along the primary axis; on Left if horizontal, else on Top.

  OpenBorderInfo: BorderInfo

  ///  Closing margin of this cluster (additional space inside the cluster border)
  ///  along the primary axis; on Right if horizontal, else on Bottom.

  CloseBorderInfo: BorderInfo

  ///  Opening margin of this cluster (additional space inside the cluster border)
  ///  along the secondary (Perpendicular) axis; on Top if horizontal, else on Left.

  OpenBorderInfoP: BorderInfo

  ///  Closing margin of this cluster (additional space inside the cluster border)
  ///  along the secondary (Perpendicular) axis; on Bottom if horizontal, else on Right.

  CloseBorderInfoP: BorderInfo

  ///  Minimum size along the primary axis.

  MinimumSize: number

  ///  Minimum size along the perpendicular axis.

  MinimumSizeP: number

  ///  Padding of nodes within the cluster in the parallel direction.

  NodePadding: number

  ///  Padding of nodes within the cluster in the perpendicular direction.

  NodePaddingP: number

  ///  Padding outside the cluster in the parallel direction.

  ClusterPadding: number

  ///  Padding outside the cluster in the perpendicular direction.

  ClusterPaddingP: number

  get Name(): string {
    return this.UserData
  }

  //  VERBOSE
  //  The number of node IDs used by a Cluster - for the cluster itself and its fake nodes.
  static get NumInternalNodes(): number {
    return 3
  }

  //  The width (height) of the node along the primary axis, which should be fairly thin
  //  (along the secondary (perpendicular) axis, it is the full size of the cluster).
  static get DefaultBorderWidth(): number {
    return OverlapRemovalGlobalConfiguration.ClusterDefaultBorderWidth
  }

  //  Zero cluster margins. This ctor is currently used only by the generator's DefaultClusterHierarchy,
  //  which by default is created with non-fixed borders and no margins.
  static constructorNOANN(id: number, userData: any, padding: number, paddingP: number): OverlapRemovalCluster {
    return new OverlapRemovalCluster(
      id,
      userData,
      0,
      0,
      padding,
      paddingP,
      0,
      0,
      BorderInfo.constructorN(0),
      BorderInfo.constructorN(0),
      BorderInfo.constructorN(0),
      BorderInfo.constructorN(0),
    )
  }

  constructor(
    id: number,
    userData: any,
    minSize: number,
    minSizeP: number,
    nodePadding: number,
    nodePaddingP: number,
    clusterPadding: number,
    clusterPaddingP: number,
    openBorderInfo: BorderInfo,
    closeBorderInfo: BorderInfo,
    openBorderInfoP: BorderInfo,
    closeBorderInfoP: BorderInfo,
  ) {
    super(id, userData, 0, 0, 0, 0, BorderInfo.DefaultFreeWeight)
    this.MinimumSize = minSize
    this.MinimumSizeP = minSizeP
    this.NodePadding = nodePadding
    this.NodePaddingP = nodePaddingP
    this.ClusterPadding = clusterPadding
    this.ClusterPaddingP = clusterPaddingP
    this.OpenBorderInfo = openBorderInfo
    this.OpenBorderInfo.EnsureWeight()
    this.CloseBorderInfo = closeBorderInfo
    this.CloseBorderInfo.EnsureWeight()
    this.OpenBorderInfoP = openBorderInfoP
    this.OpenBorderInfoP.EnsureWeight()
    this.CloseBorderInfoP = closeBorderInfoP
    this.CloseBorderInfoP.EnsureWeight()
  }

  ///  Generate a string representation of the Cluster.

  ///  <returns>A string representation of the Cluster.</returns>
  toString(): string {
    //  Currently this is just the same as the base Node; all zero if we haven't
    //  yet called Solve(), else the values at the last time we called Solve().
    return String.Format(
      "Cluster '{0}': id {1} p {2:F5} s {3:F5} pP {4:F5} sP {5:F5}",
      this.UserDataString,
      this.Id,
      this.Position,
      this.Size,
      this.PositionP,
      this.SizeP,
    )
  }

  //  newNode may be a cluster in which case we add it to the cluster list.  We never call this to
  //  add the fake border nodes to nodeList; the caller never sees them.
  AddNode(newNode: OverlapRemovalNode) {
    this.nodeList.push(newNode)
  }

  //  Adds an open/close event pair for the node. paddingP is either cluster or node padding.
  AddEvents(node: OverlapRemovalNode, events: Array<Event>) {
    //  Add/subtract only half the padding so they meet in the middle of the padding.
    events.push(new Event(true, node, node.OpenP - this.NodePaddingP / 2))
    events.push(new Event(false, node, node.CloseP + this.NodePaddingP / 2))
  }

  //  This is internal rather than  so Test_OverlapRemoval can see it.
  static CalcBorderWidth(margin: number): number {
    //  Margin applies only to the inside edge.
    if (margin > 0) {
      return margin
    }

    return OverlapRemovalCluster.DefaultBorderWidth
  }

  Generate(solver: Solver, parameters: OverlapRemovalParameters, isHorizontal: boolean) {
    this.IsInSolver = this.GenerateWorker(solver, parameters, isHorizontal)
  }

  //  Returns false if the cluster is empty; this handles nested clusters of empty clusters.
  //  TODOunit: several of the test files cover this but add a specific test for it.
  GenerateWorker(solver: Solver, parameters: OverlapRemovalParameters, isHorizontal: boolean): boolean {
    if (this.IsEmpty) {
      //  Nothing to generate.
      return false
    }

    //  @@DCR "Precalculate Cluster Sizes": if we are solving per-cluster to calculate best sizes before
    //  generating constraints, then solver would be passed in as null and we'd create one here.
    //  Variables to calculate our boundaries.  Top and Bottom refer to the perpendicular direction;
    //  for vertical, read Top <-> Left and Bottom <-> Right.

    const boundaryRect = new Rectangle({left: Number.MAX_VALUE, right: Number.MIN_VALUE, bottom: Number.MAX_VALUE, top: Number.MIN_VALUE})

    //  The list of open/close events, which will be sorted on the perpendicular coordinate of the event
    //  (OverlapRemovalNode.g. for horizontal constraint generation, order on vertical position).
    const events = this.CreateEvents(solver, /* ref */ boundaryRect)
    //  If we added no events, we're either Fixed (so continue) or empty (so return).
    if (events.length == 0 && !this.TranslateChildren) {
      return false
    }

    //  Top/Bottom are considered the secondary (Perpendicular) axis here.
    const t = {leftBorderWidth: OverlapRemovalCluster.DefaultBorderWidth, rightBorderWidth: OverlapRemovalCluster.DefaultBorderWidth}

    this.GenerateFromEvents(solver, parameters, events, isHorizontal)

    return true
  }

  CreateEvents(solver: Solver, /* ref */ boundaryRect: Rectangle): Array<Event> {
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

  CalculateBorderWidths(
    solver: Solver,
    events: Array<Event>,
    boundaryRect: Rectangle,
    t: {leftBorderWidth: number; rightBorderWidth: number},
  ) {
    //  Cluster-level padding (the space around the borders) complicates this.  Margin
    //  is added only at the inside edge of the cluster; for example, as space for a
    //  title of the cluster to be printed.  We just use the margin as the boundary node
    //  sizes.  Margin is separate from padding; padding is always added.
    t.leftBorderWidth = OverlapRemovalCluster.CalcBorderWidth(this.OpenBorderInfo.InnerMargin)
    t.rightBorderWidth = OverlapRemovalCluster.CalcBorderWidth(this.CloseBorderInfo.InnerMargin)
    //  @@DCR "Precalculate Cluster Sizes": at this point we could solve them to get the "real" cluster
    //  size (as above, this may be requested by solver being null on input so we create our own above).
    //  Now calculate our position (as midpoints) and size.  This will be used in the parentCluster's
    //  Generate() operation.  We want to get to the outside border of the border, so subtract the
    //  border width.  We've added pre-border padding above.  Note: This is done before checking
    //  for fixed positions, because we want the constraint generation to see them in the correct
    //  relative positions - border midpoints are always outside the outermost node midpoints, so that
    //  constraints will be generated in the correct direction (it would be bad if, for example, a Left
    //  border was the rhs of a constraint with a node inside the cluster; it should always be an lhs
    //  to any node in the cluster, and having it as an rhs will probably generate a cycle).  We adjust
    //  to fixed positions below after GenerateFromEvents.
    this.Size = boundaryRect.width
    this.Position = boundaryRect.center.x
    //  The final perpendicular positions may be modified below, after GenerateFromEvents; they
    //  will be used by a parent cluster's Generate after we return if this is a recursive call.
    //  We don't do it here because we are doing the variables internal to this cluster, based
    //  upon their current positions, so this would get confused if we moved the P coordinates here.
    this.SizeP = boundaryRect.height
    this.PositionP = boundaryRect.center.y
    //  Now create the two "fake nodes" for the borders and add them to the event list line and solver.
    //  This constraint will never be deferred, since there is no overlap in the secondary axis but is
    //  in the primary axis.  In the perpendicular direction, we want them to be the size of the
    //  outer borders of the outer nodes, regardless of whether the perpendicular borders are
    //  fixed-position; this ensures that the scan line will correctly see their open and close.
    //  Left/Open...
    this.LeftBorderNode.Position = boundaryRect.left + t.leftBorderWidth / 2
    this.LeftBorderNode.Size = t.leftBorderWidth
    this.LeftBorderNode.Weight = this.OpenBorderInfo.Weight
    this.LeftBorderNode.PositionP = this.PositionP
    this.LeftBorderNode.SizeP = this.SizeP
    this.LeftBorderNode.CreateVariable(solver)
    this.AddEvents(this.LeftBorderNode, events)
    //  Note:  The Left/Right, Open/Close terminology here is inconsistent with GenerateFromEvents
    //   since here Open is in the primary axis and in GenerateFromEvents it's in the secondary/P axis.
    //  Right/Close...
    this.RightBorderNode.Position = boundaryRect.right - t.rightBorderWidth / 2
    this.RightBorderNode.Size = t.rightBorderWidth
    this.RightBorderNode.Weight = this.CloseBorderInfo.Weight
    this.RightBorderNode.PositionP = this.PositionP
    this.RightBorderNode.SizeP = this.SizeP
    this.RightBorderNode.CreateVariable(solver)
    this.AddEvents(this.RightBorderNode, events)
  }

  AdjustFixedBorderPositions(solver: Solver, leftBorderWidth: number, rightBorderWidth: number, isHorizontal: boolean) {
    //  Note:  Open == Left, Close == Right.
    if (this.OpenBorderInfo.IsFixedPosition && this.CloseBorderInfo.IsFixedPosition) {
      //  Both are fixed, so just move them to their specified positions.  For FixedPosition
      //  the API is that it's the outer border edge, so add or subtract half the (left|right)BorderWidth
      //  to set the position to the midpoint.  Since both borders are fixed, this provides a
      //  limit to the size of the overall node.
      this.LeftBorderNode.UpdateDesiredPosition(this.OpenBorderInfo.FixedPosition + leftBorderWidth / 2)
      this.RightBorderNode.UpdateDesiredPosition(this.CloseBorderInfo.FixedPosition - rightBorderWidth / 2)
      this.Size = this.CloseBorderInfo.FixedPosition - this.OpenBorderInfo.FixedPosition
      this.Position = this.OpenBorderInfo.FixedPosition + this.Size / 2
    } else if (this.OpenBorderInfo.IsFixedPosition || this.CloseBorderInfo.IsFixedPosition) {
      //  One border is fixed and the other isn't.  We'll keep the same cluster size,
      //  move the fixed border to its specified position, adjust our midpoint to reflect that,
      //  and then move the unfixed border to be immediately adjacent to the fixed border; the
      //  solver will cause it to be moved to the minimal position satisfying the constraints.
      if (this.OpenBorderInfo.IsFixedPosition) {
        //  FixedPosition is the outer border edge so add BorderWidth/2 to set it to the Left midpoint.
        this.LeftBorderNode.UpdateDesiredPosition(this.OpenBorderInfo.FixedPosition + leftBorderWidth / 2)
        this.Position = this.OpenBorderInfo.FixedPosition + this.Size / 2
      } else {
        //  FixedPosition is the outer border edge so subtract BorderWidth/2 to set it to the Right midpoint.
        this.RightBorderNode.UpdateDesiredPosition(this.CloseBorderInfo.FixedPosition - rightBorderWidth / 2)
        this.Position = this.CloseBorderInfo.FixedPosition - this.Size / 2
      }
    }

    //  If we have a minimum size, generate constraints for it.  Although this may change the size
    //  considerably, so may the movement of variables in the cluster, so we need no precalculation
    //  of sizes or positions; but after the Horizontal pass, the caller must pass in the resultant
    //  positions in the Horizontal (perpendicular) BorderInfos parameter to Vertical generation;
    //  otherwise, because the Horizontal cluster span may be larger than is calculated simply from
    //  variable positions, some variables may not have appropriate constraints generated.
    if (this.MinimumSize > 0) {
      solver.AddConstraint(
        this.LeftBorderNode.Variable,
        this.RightBorderNode.Variable,
        this.MinimumSize - (leftBorderWidth / 2 - rightBorderWidth / 2),
      )
      //   Debug.Assert(cst != null, 'Minimum Cluster size: unexpected null cst')
      //   this.#if(VERBOSE)
      //   System.Diagnostics.Debug.WriteLine(' {0} MinClusterSizeCst {1} -> {2} g {3:F5}', 'H', cst.Left.Name, cst.Right.Name, cst.Gap)
      //   // TODO: Warning!!!, inline IF is not supported ?
      //   isHorizontal
      //   ;('V')
      //   this.#endif
      //   //  VERBOSE
    }

    //  Now recalculate our perpendicular PositionP/SizeP if either perpendicular border is fixed,
    //  since we know we're going to move things there.  We don't actually create variables for the
    //  perpendicular axis on this pass, but we set the primary axis border nodes' perpendicular size
    //  and position, thus creating "virtual" perpendicular borders used by the parent cluster's
    //  Generate() and for its events in its GenerateFromEvents().  This must be done on both H and V
    //  passes, because multiple heavyweight Fixed borders can push each other around on the horizontal
    //  pass and leave excessive space between the fixed border and the outer nodes.  In that case the
    //  Vertical pass can't get the true X border positions by evaluating our nodes' X positions; the
    //  caller must pass this updated position in (the same thing it must do for nodes' X coordinates).
    if (this.OpenBorderInfoP.IsFixedPosition || this.CloseBorderInfoP.IsFixedPosition) {
      //  If both are fixed, we'll set to those positions and recalculate size.
      //  Remember that FixedPosition API is the outer border edge so we don't need to adjust for border width.
      if (this.OpenBorderInfoP.IsFixedPosition && this.CloseBorderInfoP.IsFixedPosition) {
        this.SizeP = this.CloseBorderInfoP.FixedPosition - this.OpenBorderInfoP.FixedPosition
        this.PositionP = this.OpenBorderInfoP.FixedPosition + this.SizeP / 2
        if (this.SizeP < 0) {
          //  Open border is to the right of close border; they'll move later, but we have to
          //  make the size non-negative.  TODOunit: create a specific test for this (fixed LRTB)
          this.SizeP = this.SizeP * -1
        }
      } else {
        //  Only one is fixed, so we'll adjust in the appropriate direction as needed.
        //  - If we're on the horizontal pass we'll preserve the above calculation of this.SizeP
        //    and only shift things around to preserve the relative vertical starting positions;
        //    running the Solver will change these positions.
        //  - If we're on the vertical pass, we know the horizontal nodes are in their final positions,
        //    so we need to accommodate the case described above, where the Solver opened up space
        //    between the fixed border and the outermost nodes (it will never *reduce* this distance
        //    of course).  This means we adjust both border position and our overall node size.
        const curTopOuterBorder = this.PositionP - this.SizeP / 2
        const curBottomOuterBorder = this.PositionP + this.SizeP / 2
        if (this.OpenBorderInfoP.IsFixedPosition) {
          if (isHorizontal) {
            //  Don't change SizeP.
            this.PositionP = this.PositionP + (this.OpenBorderInfoP.FixedPosition - curTopOuterBorder)
          } else {
            this.SizeP = curBottomOuterBorder - this.OpenBorderInfoP.FixedPosition
            this.PositionP = this.OpenBorderInfoP.FixedPosition + this.SizeP / 2
          }
        } else if (isHorizontal) {
          //  Don't change SizeP.
          this.PositionP = this.PositionP + (this.CloseBorderInfoP.FixedPosition - curBottomOuterBorder)
        } else {
          this.SizeP = this.CloseBorderInfoP.FixedPosition - curTopOuterBorder
          this.PositionP = curTopOuterBorder + this.SizeP / 2
        }
      }

      //  endifelse both borders fixed or only one border is
      //  Now update our fake border nodes' PositionP/SizeP to be consistent.
      this.LeftBorderNode.PositionP = this.PositionP
      this.LeftBorderNode.SizeP = this.SizeP
      this.RightBorderNode.PositionP = this.PositionP
      this.RightBorderNode.SizeP = this.SizeP
    }
  }

  //  end Generate()
  //  Get the Node to use in generating constraints:
  //  - If the Node is not a Cluster, then use the Node.
  //  - Else if it is being operated on as the left neighbour, use its right border as the
  //    variable FROM which we create the constraint.
  //  - Else it is being operated on as the right neighbour, so use its left border as the
  //    variable TO which we create the constraint.
  static GetLeftConstraintNode(node: OverlapRemovalNode): OverlapRemovalNode {
    return node instanceof OverlapRemovalCluster ? node.RightBorderNode : node
  }

  static GetRightConstraintNode(node: OverlapRemovalNode): OverlapRemovalNode {
    return node instanceof OverlapRemovalCluster ? node.LeftBorderNode : node
  }

  GenerateFromEvents(solver: Solver, parameters: OverlapRemovalParameters, events: Array<Event>, isHorizontal: boolean) {
    //  First, sort the events on the perpendicular coordinate of the event
    //  (OverlapRemovalNode.g. for horizontal constraint generation, order on vertical position).
    events.sort((a, b) => OverlapRemovalCluster.compareEvents(a, b))
    // this.#if(VERBOSE)
    // System.Diagnostics.Debug.WriteLine('Events:')
    // for (const evt: Event in events) {
    //   System.Diagnostics.Debug.WriteLine('    {0}', evt)
    // }

    // this.#endif
    // //  VERBOSE
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

        const currentLeftNode: OverlapRemovalNode = OverlapRemovalCluster.GetLeftConstraintNode(currentNode)
        const currentRightNode: OverlapRemovalNode = OverlapRemovalCluster.GetRightConstraintNode(currentNode)
        const cLeftNeighbours = currentNode.LeftNeighbors.length
        for (let i = 0; i < cLeftNeighbours; i++) {
          const origLeftNeighborNode: OverlapRemovalNode = currentNode.LeftNeighbors[i]
          removeFromArray(origLeftNeighborNode.RightNeighbors, currentNode)
          const leftNeighborNode: OverlapRemovalNode = OverlapRemovalCluster.GetLeftConstraintNode(origLeftNeighborNode)
          const p =
            leftNeighborNode == this.LeftBorderNode || currentRightNode == this.RightBorderNode ? this.ClusterPadding : this.NodePadding
          let separation = (leftNeighborNode.Size + currentRightNode.Size) / 2 + p
          if (this.TranslateChildren) {
            separation = Math.max(separation, currentRightNode.Position - leftNeighborNode.Position)
          }

          solver.AddConstraint(leftNeighborNode.Variable, currentRightNode.Variable, separation)
        }

        const cRightNeighbours = currentNode.RightNeighbors.length
        for (let i = 0; i < cRightNeighbours; i++) {
          //  Keep original node, which may be a cluster; see comments in LeftNeighbors above.
          const origRightNeighborNode: OverlapRemovalNode = currentNode.RightNeighbors[i]
          removeFromArray(origRightNeighborNode.LeftNeighbors, currentNode)
          const rightNeighborNode: OverlapRemovalNode = OverlapRemovalCluster.GetRightConstraintNode(origRightNeighborNode)
          //  This assert verifies we match the Solver.ViolationTolerance check in AddNeighbor.
          //  Allow a little rounding error.
          // Debug.Assert(
          //   isHorizontal ||
          //     currentNode.CloseP + (this.NodePaddingP - rightNeighborNode.OpenP) > parameters.SolverParameters.GapTolerance - 1e-6,
          //   'RightNeighbors: unexpected close/open overlap',
          // )
          const p =
            currentLeftNode == this.LeftBorderNode || rightNeighborNode == this.RightBorderNode ? this.ClusterPadding : this.NodePadding
          let separation = (currentLeftNode.Size + rightNeighborNode.Size) / 2 + p
          if (this.TranslateChildren) {
            separation = Math.max(separation, rightNeighborNode.Position - currentLeftNode.Position)
          }

          const cst: Constraint = solver.AddConstraint(currentLeftNode.Variable, rightNeighborNode.Variable, separation)
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

    //  endfor NextLeft
    return lstNeighbours
  }

  //  end GetLeftNeighbours
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

    //  endfor NextLeft
    return lstNeighbours
  }

  //  end GetRightNeighbours
  AddNeighbour(
    parameters: OverlapRemovalParameters,
    currentNode: OverlapRemovalNode,
    nextNode: OverlapRemovalNode,
    neighbors: Array<OverlapRemovalNode>,
    isLeftNeighbor: boolean,
    isHorizontal: boolean,
  ): boolean {
    //  Sanity check to be sure that the borders are past all other nodes.
    const overlap = OverlapRemovalCluster.Overlap(currentNode, nextNode, this.NodePadding)
    if (overlap <= 0) {
      //  This is the first node encountered on this neighbour-traversal that did not
      //  overlap within the required padding. Add it to the list and we're done with
      //  this traversal, unless this is a vertical pass and it is not an overlap on
      //  the horizontal axis; in that case, pretend we never saw it and return true
      //  so the next non-overlapping node will be found.  (See below for more information
      //  on why this is necessary).
      if (
        !isHorizontal &&
        OverlapRemovalCluster.Overlap(currentNode, nextNode, this.NodePaddingP) <= parameters.SolverParameters.GapTolerance
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
        const overlapP = OverlapRemovalCluster.OverlapP(currentNode, nextNode, this.NodePaddingP)
        const isOverlapping: boolean = parameters.ConsiderProportionalOverlap
          ? overlap / (currentNode.Size + nextNode.Size) > overlapP / (currentNode.SizeP + nextNode.SizeP)
          : overlap > overlapP
        if (isOverlapping) {
          //  Don't skip if either of these is a border node.
          if (
            currentNode != this.LeftBorderNode &&
            currentNode != this.RightBorderNode &&
            nextNode != this.LeftBorderNode &&
            nextNode != this.RightBorderNode
          ) {
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

        //  endif Overlap is greater than OverlapP
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
      if (OverlapRemovalCluster.Overlap(currentNode, nextNode, this.NodePaddingP) <= parameters.SolverParameters.GapTolerance) {
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
