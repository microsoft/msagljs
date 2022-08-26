import {Direction} from '../../math/geometry'
import {OverlapRemovalParameters} from '../../math/geometry/overlapRemoval/overlapRemovalParameters'
import {RectangularClusterBoundary} from '../../math/geometry/overlapRemoval/rectangularClusterBoundary'
import {GeomGraph} from '../core'
import {IGeomGraph} from '../initialLayout/iGeomGraph'
import {AxisSolver} from './axisSolver'
import {FastIncrementalLayoutSettings} from './fastIncrementalLayoutSettings'
import {FiNode} from './fiNode'
import {IConstraint} from './iConstraint'

export class Feasibility {
  ///  <summary>
  ///  Very small extra padding used for VPad to ensure feasibility
  ///  </summary>
  static Pad = 0.0001

  ///  <summary>
  ///  Obtain a starting configuration that is feasible with respect to the structural
  ///  constraints.  This is necessary to avoid e.g. cycles of the constraint graph;
  ///  for example, dragging the root of a downward-pointing tree downward below other
  ///  nodes of the tree can result of auto-generation of constraints generating some
  ///  constraints with the root on the right-hand side, and the structural constraints
  ///  have it on the left-hand side.
  ///
  ///  When AvoidOverlaps==true and we reach ConstraintLevel>=2 then we also need to remove
  ///  overlaps... prior to this we need to force horizontal resolving of overlaps
  ///  between *all* nodes involved of vertical equality constraints (i.e. no skipping),
  ///  and then vertical overlap resolution of all nodes involved of horizontal equality
  ///  constraints
  ///  </summary>
  static Enforce(
    settings: FastIncrementalLayoutSettings,
    currentConstraintLevel: number,
    nodes: Iterable<FiNode>,
    horizontalConstraints: Array<IConstraint>,
    verticalConstraints: Array<IConstraint>,
    clusterHierarchies: Iterable<IGeomGraph>,
    clusterSettings: (g: IGeomGraph) => any,
    rectBoundary: (g: IGeomGraph) => RectangularClusterBoundary,
  ) {
    for (const l of settings.locks) {
      l.Project()
    }

    Feasibility.ResetPositions(nodes)
    const dblVpad = settings.NodeSeparation + Feasibility.Pad
    const dblHpad = settings.NodeSeparation
    const dblCVpad = settings.clusterMargin + Feasibility.Pad
    const dblCHpad = settings.clusterMargin
    for (let level = settings.MinConstraintLevel; level <= currentConstraintLevel; level++) {
      //  to obtain a feasible solution when equality constraints are present we need to be extra careful
      //  but the solution below is a little bit crummy, is not currently optimized when there are no
      //  equality constraints and we do not really have any scenarios involving equality constraints at
      //  the moment, and also the fact that it turns off DeferToVertical causes it to resolve too
      //  many overlaps horizontally, so let's skip it for now.
      const hsSolver = new AxisSolver(
        true,
        nodes,
        clusterHierarchies,
        level >= 2 && settings.AvoidOverlaps,
        level,
        clusterSettings,
        rectBoundary,
      )
      hsSolver.structuralConstraints = horizontalConstraints
      hsSolver.OverlapRemovalParameters = OverlapRemovalParameters.constructorEmpty()
      hsSolver.OverlapRemovalParameters.AllowDeferToVertical = true
      hsSolver.OverlapRemovalParameters.ConsiderProportionalOverlap = settings.edgeConstrains.Direction != Direction.None
      hsSolver.Initialize(dblHpad, dblVpad, dblCHpad, dblCVpad, (v) => v.Center)
      hsSolver.SetDesiredPositions()
      hsSolver.Solve()
      Feasibility.ResetPositions(nodes)
      const vsSolver = new AxisSolver(
        false,
        nodes,
        clusterHierarchies,
        level >= 2 && settings.AvoidOverlaps,
        level,
        clusterSettings,
        rectBoundary,
      )
      vsSolver.structuralConstraints = verticalConstraints
      vsSolver.Initialize(dblHpad, dblVpad, dblCHpad, dblCVpad, (v) => v.Center)
      vsSolver.SetDesiredPositions()
      vsSolver.Solve()
      Feasibility.ResetPositions(nodes)
    }
  }

  /// // <summary>
  /// // When AvoidOverlaps==true and we reach ConstraintLevel>=2 then we also need to remove
  /// // overlaps... prior to this we need to force horizontal resolving of overlaps
  /// // between *all* nodes involved of vertical equality constraints (i.e. no skipping),
  /// // and then vertical overlap resolution of all nodes involved of horizontal equality
  /// // constraints
  /// // </summary>
  /// // <param name="dblVpad"></param>
  /// // <param name="dblHpad"></param>
  /// // <param name="horizontalConstraints"></param>
  /// // <param name="verticalConstraints"></param>
  // [System.Diagnostics.CodeAnalysis.SuppressMessage("Microsoft.Maintainability", "CA1502:AvoidExcessiveComplexity")]
  // static private void RemoveOverlapsOnEqualityConstraints(double dblVpad, double dblHpad, Array<IConstraint> horizontalConstraints, Array<IConstraint> verticalConstraints)
  // {
  //     var verticalEqualityConstraints = from c of verticalConstraints
  //                                       let sc = c as VerticalSeparationConstraint
  //                                       where sc != null && sc.IsEquality
  //                                       select new { sc.BottomNode, sc.TopNode };
  //     var vvs = (from c of verticalEqualityConstraints
  //                select (FiNode)c.BottomNode.AlgorithmData).Union(
  //                from c of verticalEqualityConstraints
  //                select (FiNode)c.TopNode.AlgorithmData).AsEnumerable();
  //     var hSolver = new AxisSolver(true, vvs, null, true, 2);
  //     hSolver.OverlapRemovalParameters = new Core.Geometry.OverlapRemovalParameters
  //     {
  //         AllowDeferToVertical = false
  //     };
  //     hSolver.Initialize(dblHpad + Pad, dblVpad + Pad, 0, v=>v.Center);
  //     hSolver.SetDesiredPositions();
  //     hSolver.Solve();
  //     var horizontalEqualityConstraints = from c of horizontalConstraints
  //                                         let sc = c as HorizontalSeparationConstraint
  //                                         where sc != null && sc.IsEquality
  //                                         select new { sc.LeftNode, sc.RightNode };
  //     var hvs = (from c of horizontalEqualityConstraints
  //                select (FiNode)c.LeftNode.AlgorithmData).Union(
  //                from c of horizontalEqualityConstraints
  //                select (FiNode)c.RightNode.AlgorithmData).AsEnumerable();
  //     var vSolver = new AxisSolver(false, hvs, null, true, 2);
  //     vSolver.Initialize(dblHpad + Pad, dblVpad + Pad, 0, v=>v.Center);
  //     vSolver.SetDesiredPositions();
  //     vSolver.Solve();
  // }
  private static ResetPositions(nodes: Iterable<FiNode>) {
    for (const v of nodes) {
      v.desiredPosition = v.mNode.center
      v.previousCenter = v.mNode.center
    }
  }
}
