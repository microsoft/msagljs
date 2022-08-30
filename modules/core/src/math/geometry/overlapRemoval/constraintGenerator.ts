///  <summary>
///  ConstraintGenerator is the driving class for overlap removal.  The caller
///  adds variables (so it is similar to ProjectionSolver in that way, and in
///  fact the variables added here are passed to the ProjectionSolver to solve
///  the generated constraints).

import {Solution} from '../../projectionSolver/Solution'
import {Solver} from '../../projectionSolver/Solver'
import {BorderInfo} from './borderInfo'
import {OverlapRemovalCluster} from './overlapRemovalCluster'
import {OverlapRemovalNode} from './overlapRemovalNode'
import {OverlapRemovalParameters} from './overlapRemovalParameters'

///  </summary>
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
  ///  <summary>
  ///  Read-only enumeration of the ClusterHierarchies; new cluster hierarchies are created
  ///  by calling AddCluster
  ///  </summary>
  public get ClusterHierarchies(): Iterable<OverlapRemovalCluster> {
    return this.clusterHierarchies
  }

  clusterHierarchies: Array<OverlapRemovalCluster> = new Array<OverlapRemovalCluster>()

  ///  <summary>
  ///  The initial, default ClusterHierarchy; a "flat" graph (with no user-defined clusters)
  ///  lives entirely in this cluster.
  ///  </summary>
  public get DefaultClusterHierarchy(): OverlapRemovalCluster {
    return this.clusterHierarchies[0]
  }

  //  This is the padding in the relevant direction, and the perpendicular padding that is
  //  used if we are doing horizontal constraints (for the "amount of movement" comparisons).
  //  It also includes fixed-border specifications.
  ///  <summary>
  ///  Padding in the direction of the primary axis.
  ///  </summary>
  Padding: number
  ///  <summary>
  ///  Padding in the secondary (Perpendicular) axis.
  ///  </summary>
  PaddingP: number

  ///  <summary>
  ///  Padding outside clusters in the parallel direction.
  ///  </summary>
  ClusterPadding: number

  ///  <summary>
  ///  Padding outside clusters in the perpendicular direction.
  ///  </summary>
  ClusterPaddingP: number
  ///  <summary>
  ///  Default padding value that is used (in both axes) if no padding is specified when
  ///  calling the ConstraintGenerator constructor.
  ///  </summary>
  public static get DefaultPadding(): number {
    return 7
  }

  //  An identifier to avoid duplicates in the ScanLine tree (otherwise the first
  //  one encountered gets all the neighbours).  This sequence is shared with Clusters,
  //  which are derived from Node; each Cluster consumes 3 IDs, one for the cluster
  //  itself and one for each of its fake border nodes.
  nextNodeId = 0

  ///  <summary>
  ///  As passed to ctor; if this is true, we are doing horizontal (x) constraint generation,
  ///  and must therefore consider whether a smaller vertical movement would remove the overlap.
  ///  </summary>
  IsHorizontal: boolean

  ///  <summary>
  ///  This form of the constructor uses default values for the padding parameters.
  ///  <param name="isHorizontal">Whether to generate horizontal or vertical constraints</param>
  ///  </summary>
  static constructorB(isHorizontal: boolean) {
    return ConstraintGenerator.constructorBNN(isHorizontal, ConstraintGenerator.DefaultPadding, ConstraintGenerator.DefaultPadding)
  }

  ///  <summary>
  ///  This form of the constructor uses specifies the padding parameters.
  ///  <param name="isHorizontal">Whether to generate horizontal or vertical constraints</param>
  ///  <param name="padding">Padding outside nodes in the parallel direction</param>
  ///  <param name="paddingP">Padding outside nodes in the perpendicular direction</param>
  ///  <param name="clusterPadding">Padding outside clusters in the parallel direction</param>
  ///  <param name="clusterPaddingP">Padding outside clusters in the perpendicular direction</param>
  ///  </summary>
  public constructor(isHorizontal: boolean, padding: number, paddingP: number, clusterPadding: number, clusterPaddingP: number) {
    this.IsHorizontal = isHorizontal
    this.Padding = padding
    this.PaddingP = paddingP
    this.ClusterPadding = clusterPadding
    this.ClusterPaddingP = clusterPaddingP
    //  Create the DefaultClusterHierarchy.
    this.clusterHierarchies.push(OverlapRemovalCluster.constructorNOANN(0, null, 0, this.Padding, this.PaddingP))
    this.nextNodeId += OverlapRemovalCluster.NumInternalNodes
  }

  ///  <summary>
  ///  Alternate form of the constructor to allow overriding the default padding.
  ///  </summary>
  ///  <param name="isHorizontal">Whether to generate horizontal or vertical constraints</param>
  ///  <param name="padding">Minimal space between node or cluster rectangles in the primary axis.</param>
  ///  <param name="paddingP">Minimal space between node or cluster rectangles in the secondary (Perpendicular) axis;
  ///                          used only when isHorizontal is true, to optimize the direction of movement.</param>
  static constructorBNN(isHorizontal: boolean, padding: number, paddingP: number) {
    return new ConstraintGenerator(isHorizontal, padding, paddingP, padding, paddingP)
  }

  ///  <summary>
  ///  Add a new variable to the ConstraintGenerator.
  ///  </summary>
  ///  <param name="initialCluster">The cluster this node is to be a member of.  It may not be null; pass
  ///                      DefaultClusterHierarchy to create a node at the lowest level.  Subsequently a node
  ///                      may be added to additional clusters, but only to one cluster per hierarchy.</param>
  ///  <param name="userData">An object that is passed through.</param>
  ///  <param name="position">Position of the node in the primary axis; if isHorizontal, it contains horizontal
  ///                      position and size, else it contains vertical position and size.</param>
  ///  <param name="size">Size of the node in the primary axis.</param>
  ///  <param name="positionP">Position of the node in the secondary (Perpendicular) axis.</param>
  ///  <param name="sizeP">Size of the node in the secondary (Perpendicular) axis.</param>
  ///  <param name="weight">Weight of the node (indicates how freely it should move).</param>
  ///  <returns>The created node.</returns>
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
    const nodNew = new OverlapRemovalNode(this.nextNodeId++, userData, position, positionP, size, sizeP, weight)
    initialCluster.AddNode(nodNew)
    return nodNew
  }

  ///  <summary>
  ///  Creates a new cluster with no minimum size within the specified parent cluster.  Clusters allow creating a subset of
  ///  nodes that must be within a distinct rectangle.
  ///  </summary>
  ///  <param name="parentCluster">The cluster this cluster is to be a member of; if null, this is the root of a
  ///                              new hierarchy, otherwise must be non-NULL (perhaps DefaultClusterHierarchy).</param>
  ///  <param name="userData">An object that is passed through.</param>
  ///  <param name="openBorderInfo">Information about the Left (if isHorizontal, else Top) border.</param>
  ///  <param name="closeBorderInfo">Information about the Right (if isHorizontal, else Bottom) border.</param>
  ///  <param name="openBorderInfoP">Same as OpenBorder, but in the secondary (Perpendicular) axis.</param>
  ///  <param name="closeBorderInfoP">Same as CloseBorder, but in the secondary (Perpendicular) axis.</param>
  ///  <returns>The new Cluster.</returns>
  ///
  public AddClusterOOBBBB(
    parentCluster: OverlapRemovalCluster,
    userData: any,
    openBorderInfo: BorderInfo,
    closeBorderInfo: BorderInfo,
    openBorderInfoP: BorderInfo,
    closeBorderInfoP: BorderInfo,
  ): OverlapRemovalCluster {
    return this.AddCluster(parentCluster, userData, 0, 0, openBorderInfo, closeBorderInfo, openBorderInfoP, closeBorderInfoP)
  }

  ///  <summary>
  ///  Creates a new cluster with a minimum size within the specified parent cluster.  Clusters allow creating a subset of
  ///  nodes that must be within a distinct rectangle.
  ///  </summary>
  ///  <param name="parentCluster">The cluster this cluster is to be a member of; if null, this is the root of a
  ///                              new hierarchy, otherwise must be non-NULL (perhaps DefaultClusterHierarchy).</param>
  ///  <param name="userData">An object that is passed through.</param>
  ///  <param name="minimumSize">Minimum cluster size along the primary axis.</param>
  ///  <param name="minimumSizeP">Minimum cluster size along the perpendicular axis.</param>
  ///  <param name="openBorderInfo">Information about the Left (if isHorizontal, else Top) border.</param>
  ///  <param name="closeBorderInfo">Information about the Right (if isHorizontal, else Bottom) border.</param>
  ///  <param name="openBorderInfoP">Same as OpenBorder, but in the secondary (Perpendicular) axis.</param>
  ///  <param name="closeBorderInfoP">Same as CloseBorder, but in the secondary (Perpendicular) axis.</param>
  ///  <returns>The new Cluster.</returns>
  ///
  public AddCluster(
    parentCluster: OverlapRemovalCluster,
    userData: any,
    minimumSize: number,
    minimumSizeP: number,
    openBorderInfo: BorderInfo,
    closeBorderInfo: BorderInfo,
    openBorderInfoP: BorderInfo,
    closeBorderInfoP: BorderInfo,
  ): OverlapRemovalCluster {
    const newCluster = new OverlapRemovalCluster(
      this.nextNodeId,
      parentCluster,
      userData,
      minimumSize,
      minimumSizeP,
      this.Padding,
      this.PaddingP,
      this.ClusterPadding,
      this.ClusterPaddingP,
      openBorderInfo,
      closeBorderInfo,
      openBorderInfoP,
      closeBorderInfoP,
    )
    this.nextNodeId = this.nextNodeId + OverlapRemovalCluster.NumInternalNodes
    if (parentCluster == null) {
      this.clusterHierarchies.push(newCluster)
    } else {
      //  @@DCR: Enforce that Clusters live in only one hierarchy - they can have only one parent, so add a
      //           Cluster.parentCluster to enforce this.
      // parentCluster.AddNode(newCluster)
    }

    return newCluster
  }

  ///  <summary>
  ///  Add a node to a cluster in another hierarchy (a node can be in only one cluster per hierarchy).
  ///  </summary>
  ///  <param name="cluster"></param>
  ///  <param name="node"></param>
  //  @@DCR:  Keep a node->hierarchyParentsList hash and use cluster.parentCluster to traverse to the hierarchy root
  //             to verify the node is in one cluster per hierarchy.  This will require that the function be
  //             non-static, hence the rule suppression.
  //@System.Diagnostics.CodeAnalysis.SuppressMessage("Microsoft.Performance", "CA1822:MarkMembersAsStatic")
  public AddNodeToCluster(cluster: OverlapRemovalCluster, node: OverlapRemovalNode) {
    //  Node derives from Cluster so make sure we don't have this - the only way to create
    //  cluster hierarchies is by AddCluster.
    if (node instanceof OverlapRemovalCluster) {
      throw new Error("Argument 'node' must not be a Cluster")
    }

    cluster.AddNode(node)
  }

  ///  <summary>
  ///  Generate the necessary constraints to ensure there is no overlap (unless we're doing
  ///  a horizontal pass and deferring some movement, which would be smaller, to the vertical pass).
  ///  </summary>
  ///  <param name="solver">The solver to generate into.</param>
  ///  <param name="parameters">Parameters to OverlapRemoval and ProjectionSolver.Solver.Solve().</param>
  public Generate(solver: Solver, parameters: OverlapRemovalParameters) {
    if (parameters == null) {
      parameters = OverlapRemovalParameters.constructorEmpty()
    }

    for (const cluster of this.clusterHierarchies) {
      cluster.Generate(solver, parameters, this.IsHorizontal)
    }

    //  For Clusters we reposition their "fake border" variables between the constraint-generation
    //  and solving phases, so we need to tell the solver to do this.
    solver.UpdateVariables()
    //  @@PERF: Not needed if no clusters were created.
  }

  ///  <summary>
  ///  Generates and solves the constraints.
  ///  </summary>
  ///  <param name="solver">The solver to generate into and solve.  May be null, in which case one
  ///                      is created by the method.</param>
  ///  <param name="parameters">Parameters to OverlapRemoval and ProjectionSolver.Solver.Solve().</param>
  ///  <param name="doGenerate">Generate constraints before solving; if false, solver is assumed to
  ///                      have already been populated by this.Generate().</param>
  ///  <returns>The set of OverlapRemoval.Constraints that were unsatisfiable, or NULL.</returns>
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
    for (const cluster of this.clusterHierarchies) {
      cluster.UpdateFromVariable()
      //  "recursively" processes all child clusters
    }

    return solverSolution
  }
}
