//  ConstraintGenerator is the driving class for overlap removal.  The caller
//  adds variables (so it is similar to ProjectionSolver in that way, and in
//  fact the variables added here are passed to the ProjectionSolver to solve
//  the generated constraints).

import {Solution} from '../../projectionSolver/Solution'
import {Solver} from '../../projectionSolver/Solver'
import {OverlapRemovalCluster} from './overlapRemovalCluster'
import {OverlapRemovalNode} from './overlapRemovalNode'
import {OverlapRemovalParameters} from './overlapRemovalParameters'

export class ConstraintGenerator {
  //  A ClusterHierarchy is simply a Cluster (there is no ClusterHierarchy class).
  //  This contains always at least one hierarchy, the DefaultClusterHierarchy, which is
  //  created in the ConstraintGenerator constructor.  All nodes live in a ClusterHierarchy;
  //  AddNode and AddCluster pass the appropriate cluster (DefaultClusterHierarchy,
  //  a ClusterHierarchy created by AddCluster with a null parent Cluster, or a child cluster
  //  of one of these clusters).  Thus there is no concept of a single "Root Cluster"; rather,
  //  each cluster in clusterHierarchies is the root of a separate hierarchy.
  //
  //  We only generate constraints between objects in the same ClusterHierarchy.  Because we
  //  enumerate all ClusterHierarchies and recurse into each one, each Hierarchy is completely
  //  unaware of the others.  Hierarchies added via AddCluster can be sparse.

  //  Read-only enumeration of the ClusterHierarchies; new cluster hierarchies are created
  //  by calling AddCluster

  clusterHierarchies: OverlapRemovalCluster

  //  The initial, default ClusterHierarchy; a "flat" graph (with no user-defined clusters)
  //  lives entirely in this cluster.

  public get DefaultClusterHierarchy(): OverlapRemovalCluster {
    return this.clusterHierarchies
  }

  //  This is the padding in the relevant direction, and the perpendicular padding that is
  //  used if we are doing horizontal constraints (for the "amount of movement" comparisons).
  //  It also includes fixed-border specifications.

  //  Padding in the direction of the primary axis.

  Padding: number

  //  Padding in the secondary (Perpendicular) axis.

  PaddingP: number

  //  Padding outside clusters in the parallel direction.

  ClusterPadding: number

  //  Padding outside clusters in the perpendicular direction.

  ClusterPaddingP: number

  //  Default padding value that is used (in both axes) if no padding is specified when
  //  calling the ConstraintGenerator constructor.

  public static get DefaultPadding(): number {
    return
  }

  //  An identifier to avoid duplicates in the ScanLine tree (otherwise the first
  //  one encountered gets all the neighbours).  This sequence is shared with Clusters,
  //  which are derived from Node; each Cluster consumes 3 IDs, one for the cluster
  //  itself and one for each of its fake border nodes.
  nextNodeId = 0

  //  As passed to ctor; if this is true, we are doing horizontal (x) constraint generation,
  //  and must therefore consider whether a smaller vertical movement would remove the overlap.

  IsHorizontal: boolean

  //  This form of the constructor uses default values for the padding parameters.

  static constructorB(isHorizontal: boolean) {
    return ConstraintGenerator.constructorBNN(isHorizontal, ConstraintGenerator.DefaultPadding, ConstraintGenerator.DefaultPadding)
  }

  //  This form of the constructor uses specifies the padding parameters.

  public constructor(isHorizontal: boolean, padding: number, paddingP: number, clusterPadding: number, clusterPaddingP: number) {
    this.IsHorizontal = isHorizontal
    this.Padding = padding
    this.PaddingP = paddingP
    this.ClusterPadding = clusterPadding
    this.ClusterPaddingP = clusterPaddingP
    //  Create the DefaultClusterHierarchy.
    this.clusterHierarchies = OverlapRemovalCluster.constructorNOANN(0, this.Padding, this.PaddingP)
  }

  //  Alternate form of the constructor to allow overriding the default padding.

  //  <param name="paddingP">Minimal space between node or cluster rectangles in the secondary (Perpendicular) axis;
  //                          used only when isHorizontal is true, to optimize the direction of movement.</param>
  static constructorBNN(isHorizontal: boolean, padding: number, paddingP: number) {
    return new ConstraintGenerator(isHorizontal, padding, paddingP, padding, paddingP)
  }

  //  Add a new variable to the ConstraintGenerator.

  //  <param name="initialCluster">The cluster this node is to be a member of.  It may not be null; pass
  //                      DefaultClusterHierarchy to create a node at the lowest level.  Subsequently a node
  //                      may be added to additional clusters, but only to one cluster per hierarchy.</param>

  //  <param name="position">Position of the node in the primary axis; if isHorizontal, it contains horizontal
  //                      position and size, else it contains vertical position and size.</param>

  //  <returns>The created node.</returns>
  public AddNode(
    initialCluster: OverlapRemovalCluster,
    userData: any,
    position: number,
    positionP: number,
    size: number,
    sizeP: number,
    weight: number,
  ): OverlapRemovalNode {
    //  @@PERF: Currently every node will have at least one constraint generated if there are any
    //  other nodes along its line, regardless of whether the perpendicular coordinates result in overlap.
    //  It might be worthwhile to add a check to avoid constraint generation in the case that there cannot
    //  be such an overlap on a line, or if the nodes are separated by some amount of distance.
    //Debug.Assert((null != initialCluster), "initialCluster must not be null");
    const newNode = new OverlapRemovalNode(this.nextNodeId++, userData, position, positionP, size, sizeP, weight)
    initialCluster.AddNode(newNode)
    return newNode
  }

  //  Generate the necessary constraints to ensure there is no overlap (unless we're doing
  //  a horizontal pass and deferring some movement, which would be smaller, to the vertical pass).

  public Generate(solver: Solver, parameters: OverlapRemovalParameters) {
    if (parameters == null) {
      parameters = OverlapRemovalParameters.constructorEmpty()
    }

    this.clusterHierarchies.Generate(solver, parameters, this.IsHorizontal)
  }

  //  Generates and solves the constraints.

  //  <param name="solver">The solver to generate into and solve.  May be null, in which case one
  //                      is created by the method.</param>

  //  <param name="doGenerate">Generate constraints before solving; if false, solver is assumed to
  //                      have already been populated by this.Generate().</param>
  //  <returns>The set of OverlapRemoval.Constraints that were unsatisfiable, or NULL.</returns>
  public Solve(solver: Solver, parameters: OverlapRemovalParameters, doGenerate: boolean): Solution {
    if (solver == null) {
      solver = new Solver()
    }

    if (parameters == null) {
      parameters = OverlapRemovalParameters.constructorEmpty()
    }

    if (doGenerate) {
      this.Generate(solver, parameters)
    }

    const solverSolution: Solution = solver.SolvePar(parameters.SolverParameters)
    this.clusterHierarchies.UpdateFromVariable()

    return solverSolution
  }
}
