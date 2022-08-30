//  Solver for structural separation constraints or non-overlap constraints of a single axis.
//  Wrapper round all the ProjectionSolver stuff.

import {Point, Rectangle} from '../../math/geometry'
import {BorderInfo} from '../../math/geometry/overlapRemoval/borderInfo'
import {ConstraintGenerator} from '../../math/geometry/overlapRemoval/constraintGenerator'
import {OverlapRemovalCluster} from '../../math/geometry/overlapRemoval/overlapRemovalCluster'
import {OverlapRemovalParameters} from '../../math/geometry/overlapRemoval/overlapRemovalParameters'
import {RectangularClusterBoundary} from '../../math/geometry/overlapRemoval/rectangularClusterBoundary'
import {Solution} from '../../math/projectionSolver/Solution'
import {Solver} from '../../math/projectionSolver/Solver'
import {Assert} from '../../utils/assert'
import {IGeomGraph} from '../initialLayout/iGeomGraph'
import {FiNode, getFiNode} from './fiNode'
import {HorizontalSeparationConstraint} from './horizontalSeparationConstraints'
import {IConstraint} from './iConstraint'
import {VerticalSeparationConstraint} from './verticalSeparationConstraint'

export class AxisSolver {
  structuralConstraints: Array<IConstraint> = new Array<IConstraint>()

  ConstraintLevel: number

  //  true means this AxisSolver works horizontally

  IsHorizontal: boolean

  OverlapRemovalParameters: OverlapRemovalParameters

  private avoidOverlaps: boolean

  private nodes: Iterable<FiNode>

  rectBoundary: (
    //  Wrapper round all the ProjectionSolver stuff.
    gg: IGeomGraph,
  ) => RectangularClusterBoundary

  //  Do we even need to do a solve?

  get NeedSolve(): boolean {
    return (this.avoidOverlaps && this.ConstraintLevel >= 2) || (this.structuralConstraints.length > 0 && this.ConstraintLevel >= 1)
  }

  //  Have to reinstantiate if any of these parameters change

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
    this.avoidOverlaps = avoidOverlaps
    this.ConstraintLevel = constraintLevel
    this.rectBoundary = rectBoundary
  }

  //  Add the constraint to this axis

  AddStructuralConstraint(c: IConstraint) {
    this.structuralConstraints.push(c)
  }

  solver: Solver

  cg: ConstraintGenerator

  //  Create variables, generate non-overlap constraints.

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

  //  Do it!

  //  <returns></returns>
  Solve(): Solution {
    //  This updates the mOlapNode and clears the mOlapNode.Variable property.
    //  We do just one solve over all the cluster constraints for the whole hierarchy.
    //  It returns a list of lists of unsatisfiable constraints, or NULL.
    const solution: Solution = this.cg.Solve(this.solver, null, false)
    for (const v of this.nodes) {
      //  Set the position from the constraint solution on this axis.
      v.UpdatePos(this.IsHorizontal)
    }

    return solution
  }

  //  Must be called before Solve if the caller has updated Variable Initial Positions

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

  private AddOlapNode(
    generator: ConstraintGenerator,
    olapParentCluster: OverlapRemovalCluster,
    filNode: FiNode,
    nodeCenter: (a: FiNode) => Point,
  ) {
    //  If the node already has an mOlapNode, it's already of a cluster:  we just add it to the new cluster.
    if (filNode.getOlapNode(this.IsHorizontal)) {
      olapParentCluster.AddNode(filNode.getOlapNode(this.IsHorizontal))
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
}
