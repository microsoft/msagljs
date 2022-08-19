///  <summary>
///  Solver for structural separation constraints or non-overlap constraints of a single axis.
///  Wrapper round all the ProjectionSolver stuff.

import {Point, Rectangle} from '../../math/geometry'
import {BorderInfo} from '../../math/geometry/overlapRemoval/borderInfo'
import {ConstraintGenerator} from '../../math/geometry/overlapRemoval/constraintGenerator'
import {OverlapRemovalCluster} from '../../math/geometry/overlapRemoval/overlapRemovalCluster'
import {OverlapRemovalParameters} from '../../math/geometry/overlapRemoval/overlapRemovalParameters'
import {RectangularClusterBoundary} from '../../math/geometry/overlapRemoval/rectangularClusterBoundary'
import {Solution} from '../../math/projectionSolver/Solution'
import {Solver} from '../../math/projectionSolver/Solver'
import {AlgorithmData} from '../../structs/algorithmData'
import {Assert} from '../../utils/assert'
import {GeomNode} from '../core'
import {IGeomGraph} from '../initialLayout/iGeomGraph'
import {FiNode, getFiNode} from './fiNode'
import {HorizontalSeparationConstraint} from './horizontalSeparationConstraints'
import {IConstraint} from './iConstraint'
import {VerticalSeparationConstraint} from './verticalSeparationConstraint'

///  </summary>
export class AxisSolver {
  structuralConstraints: Array<IConstraint> = new Array<IConstraint>()

  ConstraintLevel: number

  ///  <summary>
  ///  true means this AxisSolver works horizontally
  ///  </summary>
  IsHorizontal: boolean

  OverlapRemovalParameters: OverlapRemovalParameters

  private avoidOverlaps: boolean

  private nodes: Iterable<FiNode>

  private clusterHierarchies: Iterable<IGeomGraph>

  private clusterSettings: (gg: IGeomGraph) => any
  rectBoundary: (
    ///  Wrapper round all the ProjectionSolver stuff.
    gg: IGeomGraph,
  ) => RectangularClusterBoundary

  ///  <summary>
  ///  Do we even need to do a solve?
  ///  </summary>
  get NeedSolve(): boolean {
    return (this.avoidOverlaps && this.ConstraintLevel >= 2) || (this.structuralConstraints.length > 0 && this.ConstraintLevel >= 1)
  }

  ///  <summary>
  ///  Have to reinstantiate if any of these parameters change
  ///  </summary>
  ///  <param name="isHorizontal"></param>
  ///  <param name="nodes"></param>
  ///  <param name="clusterHierarchies"></param>
  ///  <param name="avoidOverlaps"></param>
  ///  <param name="constraintLevel"></param>
  ///  <param name="clusterSettings"></param>
  constructor(
    isHorizontal: boolean,
    nodes: Iterable<FiNode>,
    clusterHierarchies: Iterable<IGeomGraph>,
    avoidOverlaps: boolean,
    constraintLevel: number,
    clusterSettings: (gg: IGeomGraph) => any,
    rectBoundary: (gg: IGeomGraph) => RectangularClusterBoundary,
  ) {
    this.IsHorizontal = isHorizontal
    this.nodes = nodes
    this.clusterHierarchies = clusterHierarchies
    this.avoidOverlaps = avoidOverlaps
    this.ConstraintLevel = constraintLevel
    this.clusterSettings = clusterSettings
    this.rectBoundary = rectBoundary
  }

  ///  <summary>
  ///  Add the constraint to this axis
  ///  </summary>
  ///  <param name="c"></param>
  AddStructuralConstraint(c: IConstraint) {
    this.structuralConstraints.push(c)
  }

  solver: Solver

  cg: ConstraintGenerator

  ///  <summary>
  ///  Create variables, generate non-overlap constraints.
  ///  </summary>
  ///  <param name="hPad">horizontal node padding</param>
  ///  <param name="vPad">vertical node padding</param>
  ///  <param name="cHPad">horizontal cluster padding</param>
  ///  <param name="cVPad">vertical cluster padding</param>
  ///  <param name="nodeCenter"></param>
  Initialize(hPad: number, vPad: number, cHPad: number, cVPad: number, nodeCenter: (fi: FiNode) => Point) {
    //  For the Vertical ConstraintGenerator, Padding is vPad and PadddingP(erpendicular) is hPad.
    this.cg = new ConstraintGenerator(
      this.IsHorizontal,
      this.IsHorizontal ? hPad : vPad,
      this.IsHorizontal ? vPad : hPad,
      this.IsHorizontal ? cHPad : cVPad,
      this.IsHorizontal ? cVPad : cHPad,
    )
    this.solver = new Solver()
    for (const filNode of this.nodes) {
      filNode.SetOlapNode(this.IsHorizontal, null)
    }

    //  Calculate horizontal non-Overlap constraints.
    if (this.avoidOverlaps && this.clusterHierarchies != null) {
      for (const c of this.clusterHierarchies) {
        this.AddOlapClusters(this.cg, null, c, nodeCenter)
      }
    }

    for (const filNode of this.nodes) {
      if (filNode.getOlapNode(this.IsHorizontal) == null) {
        this.AddOlapNode(this.cg, this.cg.DefaultClusterHierarchy, filNode, nodeCenter)
      }

      filNode.getOlapNode(this.IsHorizontal).CreateVariable(this.solver)
    }

    if (this.avoidOverlaps && this.ConstraintLevel >= 2) {
      this.cg.Generate(this.solver, this.OverlapRemovalParameters)
    }

    this.AddStructuralConstraints()
  }

  ///  <summary>
  ///  Do it!
  ///  </summary>
  ///  <returns></returns>
  Solve(): Solution {
    //  This updates the mOlapNode and clears the mOlapNode.Variable property.
    //  We do just one solve over all the cluster constraints for the whole hierarchy.
    //  It returns a list of lists of unsatisfiable constraints, or NULL.
    const solution: Solution = this.cg.Solve(this.solver, null, false)
    //  Update the positions.
    if (this.avoidOverlaps && this.clusterHierarchies != null) {
      for (const c of this.clusterHierarchies) {
        //  Don't update the root cluster of the hierarachy as it doesn't have borders.
        this.UpdateOlapClusters(c.Clusters)
      }
    }

    for (const v of this.nodes) {
      //  Set the position from the constraint solution on this axis.
      v.UpdatePos(this.IsHorizontal)
    }

    this.DebugVerifyClusterHierarchy(solution)
    return solution
  }

  ///  <summary>
  ///  Must be called before Solve if the caller has updated Variable Initial Positions
  ///  </summary>
  SetDesiredPositions() {
    for (const v of this.nodes) {
      v.SetVariableDesiredPos(this.IsHorizontal)
    }

    this.solver.UpdateVariables()
  }

  private AddStructuralConstraints() {
    //  Add the vertical structural constraints to the auto-generated ones.
    for (const c of this.structuralConstraints) {
      if (this.ConstraintLevel >= c.Level) {
        if (c instanceof HorizontalSeparationConstraint && this.IsHorizontal) {
          let u: FiNode
          let v: FiNode
          this.solver.AddConstraintVVNB(
            u.getOlapNode(this.IsHorizontal).Variable,
            v.getOlapNode(this.IsHorizontal).Variable,
            c.Separation,
            c.IsEquality,
          )
        }

        if (c instanceof VerticalSeparationConstraint && !this.IsHorizontal) {
          let u: FiNode
          let v: FiNode
          this.solver.AddConstraintVVNB(
            u.getOlapNode(this.IsHorizontal).Variable,
            v.getOlapNode(this.IsHorizontal).Variable,
            c.Separation,
            c.IsEquality,
          )
        }
      }
    }
  }

  private AddOlapClusters(
    generator: ConstraintGenerator,
    olapParentCluster: OverlapRemovalCluster,
    incClus: IGeomGraph,
    nodeCenter: (fi: FiNode) => Point,
  ) {
    const settings: any = this.clusterSettings(incClus)
    const nodeSeparationH: number = settings.NodeSeparation
    const nodeSeparationV: number = settings.NodeSeparation + 0.0001
    const innerPaddingH: number = settings.ClusterMargin
    const innerPaddingV: number = settings.ClusterMargin + 0.0001
    //  Creates the OverlapRemoval (Olap) IGeomGraph/Node objects for our FastIncrementalLayout (FIL) objects.
    //  If !isHorizontal this overwrites the Olap members of the Incremental.Clusters and Msagl.Nodes.
    //  First create the olapCluster for the current incCluster.  If olapParentCluster is null, then
    //  incCluster is the root of a new hierarchy.
    const rb: RectangularClusterBoundary = this.rectBoundary(incClus)
    if (this.IsHorizontal) {
      rb.olapCluster = generator.AddCluster(
        olapParentCluster,
        incClus,
        rb.MinWidth,
        rb.MinHeight,
        rb.LeftBorderInfo,
        rb.RightBorderInfo,
        rb.BottomBorderInfo,
        rb.TopBorderInfo,
      )
      rb.olapCluster.NodePadding = nodeSeparationH
      rb.olapCluster.NodePaddingP = nodeSeparationV
      rb.olapCluster.ClusterPadding = innerPaddingH
      rb.olapCluster.ClusterPaddingP = innerPaddingV
    } else {
      const postXLeftBorderInfo = new BorderInfo(rb.LeftBorderInfo.InnerMargin, rb.Rect.left, rb.LeftBorderInfo.Weight)
      const postXRightBorderInfo = new BorderInfo(rb.RightBorderInfo.InnerMargin, rb.Rect.right, rb.RightBorderInfo.Weight)
      rb.olapCluster = generator.AddCluster(
        olapParentCluster,
        incClus,
        rb.MinHeight,
        rb.MinWidth,
        rb.BottomBorderInfo,
        rb.TopBorderInfo,
        postXLeftBorderInfo,
        postXRightBorderInfo,
      )
      rb.olapCluster.NodePadding = nodeSeparationV
      rb.olapCluster.NodePaddingP = nodeSeparationH
      rb.olapCluster.ClusterPadding = innerPaddingV
      rb.olapCluster.ClusterPaddingP = innerPaddingH
    }

    rb.olapCluster.TranslateChildren = rb.GenerateFixedConstraints
    //  Note: Incremental.IGeomGraph always creates child Array<IGeomGraph|Node> so we don't have to check for null here.
    //  Add our child nodes.
    for (const filNode of incClus.shallowNodes) {
      this.AddOlapNode(generator, rb.olapCluster, getFiNode(filNode), nodeCenter)
    }

    //  Now recurse through all child clusters.
    for (const incChildClus of incClus.Clusters) {
      this.AddOlapClusters(generator, rb.olapCluster, incChildClus, nodeCenter)
    }
  }

  private AddOlapNode(
    generator: ConstraintGenerator,
    olapParentCluster: OverlapRemovalCluster,
    filNode: FiNode,
    nodeCenter: (a: FiNode) => Point,
  ) {
    //  If the node already has an mOlapNode, it's already of a cluster (in a different
    //  hierarchy); we just add it to the new cluster.
    if (null != filNode.getOlapNode(this.IsHorizontal)) {
      generator.AddNodeToCluster(olapParentCluster, filNode.getOlapNode(this.IsHorizontal))
      return
    }

    const center = nodeCenter(filNode)
    //  We need to create a new Node of the Generator.
    if (this.IsHorizontal) {
      //  Add the Generator node with the X-axis coords primary, Y-axis secondary.
      filNode.mOlapNodeX = generator.AddNode(
        olapParentCluster,
        filNode,
        center.x,
        center.y,
        filNode.Width,
        filNode.Height,
        filNode.stayWeight,
      )
    } else {
      //  Add the Generator node with the Y-axis coords primary, X-axis secondary.
      filNode.mOlapNodeY = generator.AddNode(
        olapParentCluster,
        filNode,
        center.y,
        center.x,
        filNode.Height,
        filNode.Width,
        filNode.stayWeight,
      )
    }
  }

  private UpdateOlapClusters(incClusters: Iterable<IGeomGraph>) {
    for (const incClus of incClusters) {
      const rb: RectangularClusterBoundary = this.rectBoundary(incClus)
      //  Because two heavily-weighted nodes can force each other to move, we have to update
      //  any BorderInfos that are IsFixedPosition to reflect this possible movement; for example,
      //  a fixed border and a node being dragged will both have heavy weights.
      if (this.IsHorizontal) {
        rb.rectangle.left = rb.olapCluster.Position - rb.olapCluster.Size / 2
        rb.rectangle.right = rb.olapCluster.Position + rb.olapCluster.Size / 2
        if (rb.LeftBorderInfo.IsFixedPosition) {
          rb.LeftBorderInfo = new BorderInfo(rb.LeftBorderInfo.InnerMargin, rb.rectangle.left, rb.LeftBorderInfo.Weight)
        }

        if (rb.RightBorderInfo.IsFixedPosition) {
          rb.RightBorderInfo = new BorderInfo(rb.RightBorderInfo.InnerMargin, rb.rectangle.right, rb.RightBorderInfo.Weight)
        }
      } else {
        rb.rectangle.bottom = rb.olapCluster.Position - rb.olapCluster.Size / 2
        rb.rectangle.top = rb.olapCluster.Position + rb.olapCluster.Size / 2
        if (rb.TopBorderInfo.IsFixedPosition) {
          rb.TopBorderInfo = new BorderInfo(rb.TopBorderInfo.InnerMargin, rb.rectangle.top, rb.TopBorderInfo.Weight)
        }

        if (rb.BottomBorderInfo.IsFixedPosition) {
          rb.BottomBorderInfo = new BorderInfo(rb.BottomBorderInfo.InnerMargin, rb.rectangle.bottom, rb.BottomBorderInfo.Weight)
        }
      }

      //  We don't use this anymore now that we've transferred the position and size
      //  so clean it up as the Gen/Solver will be going out of scope.
      rb.olapCluster = null
      //  Recurse.
      this.UpdateOlapClusters(incClus.Clusters)
    }
  }

  private DebugVerifyClusterHierarchy(solution: Solution) {
    if (this.avoidOverlaps && null != this.clusterHierarchies && 0 != solution.NumberOfUnsatisfiableConstraints) {
      for (const c of this.clusterHierarchies) {
        this.DebugVerifyClusters(this.cg, c, c)
      }
    }
  }

  //  This is initially called with Clusters that live at the root level; verify their nodes
  //  are within their boundaries, then recurse.
  private DebugVerifyClusters(generator: ConstraintGenerator, incCluster: IGeomGraph, root: IGeomGraph) {
    const dblEpsilon = 0.0001
    //  First verify that all nodes are within the cluster.
    const clusRect: Rectangle = this.rectBoundary(incCluster).rectangle
    for (const v of incCluster.shallowNodes) {
      const iiFilNode: FiNode = getFiNode(v)
      const iiNodeRect: Rectangle = iiFilNode.mNode.boundaryCurve.boundingBox
      if (this.IsHorizontal) {
        //  Don't check containment for the root ClusterHierarchy as there is no border for it.
        if (incCluster != root) {
          //  This is horizontal so we've not yet calculated the Y-axis stuff.  The only thing we
          //  can do is verify we're within cluster X bounds.  If *Space is negative, there's overlap.
          //  Generator primary axis is horizontal so use its Padding.
          const dblLboundSpace: number = iiNodeRect.left - (clusRect.left - generator.Padding)
          const dblRboundSpace: number = clusRect.right - (iiNodeRect.right - generator.Padding)
          Assert.assert(dblLboundSpace >= dblEpsilon * -1 && dblRboundSpace >= dblEpsilon * -1, 'Node is not within parent IGeomGraph')
        }
      } else {
        //  Don't check containment for the root ClusterHierarchy as there is no border for it.
        if (incCluster != root) {
          //  This is vertical so we've calculated the Y-axis stuff and horizontal is Perpendicular.
          AxisSolver.DebugVerifyRectContains(clusRect, iiNodeRect, generator.PaddingP, generator.Padding, dblEpsilon)
        }

        //  Make sure the node doesn't intersect any following nodes, or any clusters.
        for (const u of incCluster.shallowNodes) {
          if (u == v) {
            continue
          }

          const jjFilNode: FiNode = getFiNode(u)
          const jjNodeRect: Rectangle = jjFilNode.mNode.boundaryCurve.boundingBox
          //  We've already added the padding for the node so don't add it for the jjNode/IGeomGraph.
          AxisSolver.DebugVerifyRectsDisjoint(iiNodeRect, jjNodeRect, generator.PaddingP, generator.Padding, dblEpsilon)
        }

        for (const incClusComp of incCluster.Clusters) {
          AxisSolver.DebugVerifyRectsDisjoint(
            iiNodeRect,
            this.rectBoundary(incClusComp).rectangle,
            generator.PaddingP,
            generator.Padding,
            dblEpsilon,
          )
        }
      }

      //  endif isHorizontal
    }

    //  endfor iiNode
    //  Now verify the clusters are contained and don't overlap.
    for (const iiIncClus of incCluster.Clusters) {
      const iiClusRect: Rectangle = this.rectBoundary(iiIncClus).rectangle
      if (this.IsHorizontal) {
        //  Don't check containment for the root ClusterHierarchy as there is no border for it.
        if (incCluster != root) {
          //  This is horizontal so we've not yet calculated the Y-axis stuff.  The only thing we
          //  can do is verify we're within cluster X bounds.  If *Space is negative, there's overlap.
          //  Generator primary axis is horizontal so use its Padding.
          const dblLboundSpace: number = iiClusRect.left - (clusRect.left - generator.Padding)
          const dblRboundSpace: number = clusRect.right - (iiClusRect.right - generator.Padding)
          Assert.assert(
            dblLboundSpace >= dblEpsilon * -1 && dblRboundSpace >= dblEpsilon * -1,
            'IGeomGraph is not within parent IGeomGraph',
          )
        }
      } else {
        //  Don't check containment for the root ClusterHierarchy as there is no border for it.
        if (incCluster != root) {
          //  This is vertical so we've calculated the Y-axis stuff and horizontal is Perpendicular.
          AxisSolver.DebugVerifyRectContains(clusRect, iiClusRect, generator.PaddingP, generator.Padding, dblEpsilon)
        }

        //  Make sure the cluster doesn't intersect any following clusters.
        for (const jjIncClus of incCluster.Clusters) {
          if (jjIncClus == iiIncClus) {
            // TODO: Warning!!! continue If
          }

          const jjClusRect: Rectangle = this.rectBoundary(jjIncClus).rectangle
          AxisSolver.DebugVerifyRectsDisjoint(iiClusRect, jjClusRect, generator.PaddingP, generator.Padding, dblEpsilon)
        }
      }

      //  endif isHorizontal
      //  Now recurse.
      this.DebugVerifyClusters(generator, iiIncClus, root)
    }

    //  endfor iiCluster
  }

  static DebugVerifyRectContains(rectOuter: Rectangle, rectInner: Rectangle, dblPaddingX: number, dblPaddingY: number, dblEpsilon: number) {
    rectInner.padWidth(dblPaddingX / 2 - dblEpsilon)
    rectInner.padHeight(dblPaddingY / 2 - dblEpsilon)
    Assert.assert(rectOuter.containsRect(rectInner), 'Inner Node/IGeomGraph rectangle is not contained within outer IGeomGraph')
  }

  static DebugVerifyRectsDisjoint(rect1: Rectangle, rect2: Rectangle, dblPaddingX: number, dblPaddingY: number, dblEpsilon: number) {
    rect1.padWidth(dblPaddingX / 2 - dblEpsilon)
    rect1.padHeight(dblPaddingY / 2 - dblEpsilon)
    rect2.padWidth(dblPaddingX / 2 - dblEpsilon)
    rect2.padHeight(dblPaddingY / 2 - dblEpsilon)
    Assert.assert(!rect1.intersects(rect2))
  }
}
