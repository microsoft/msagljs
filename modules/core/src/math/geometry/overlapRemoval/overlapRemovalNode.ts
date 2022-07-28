import {Solver} from '../../projectionSolver/Solver'
import {Variable} from '../../projectionSolver/Variable'
import {BorderInfo} from './borderInfo'
import {String} from 'typescript-string-operations'

///  <summary>
///  A node essentially wraps the coordinates of a Variable for the Open and Close Events for
///  that Variable.  It contains the list of left and right nodes which are immediate neighbours,
///  where immediate is defined as overlapping or some subset of the closest non-overlapping
///  Variables (currently this subset is the first one encountered on any event, since it is
///  transitive; if there is a second non-overlapping node, then the first non-overlapping
///  node will have a constraint on it).
///  </summary>
export class OverlapRemovalNode {
  ///  <summary>
  ///  Passed through as a convenience to the caller; it is not used by OverlapRemoval directly
  ///  (except in VERIFY/VERBOSE where it uses ToString()).  When Solve() is complete, the caller
  ///  should copy the Node.Position property into whatever property the class specialization for this has.
  ///  </summary>
  UserData: any

  ///  <summary>
  ///  The string representing the user data object, or a null indicator string.
  ///  </summary>
  protected get UserDataString(): string {
    return this.UserData == null ? '-0-' : this.UserData.ToString()
  }

  ///  <summary>
  ///  The Variable representing this Node (or Cluster border) in the ProjectionSolver passed to
  ///  Generate().  Once Solve() is called, this is cleared out.
  ///  </summary>
  Variable: Variable

  //  Set and retrieved during Cluster.GenerateFromEvents.
  LeftNeighbors: Array<OverlapRemovalNode>
  RightNeighbors: Array<OverlapRemovalNode>

  //  If these are set, it means that during the horizontal pass we deferred a node's constraint
  //  generation to the vertical pass, so we can't jump out of neighbour evaluation on that node.
  DeferredLeftNeighborToV: boolean
  DeferredRightNeighborToV: boolean

  //  These track the (P)erpendicular coordinates to the Variable's coordinates.
  //  This is to order the Events, and for horizontal constraint generation, is
  //  also used to decide which direction resolves the overlap with minimal movement.
  ///  <summary>
  ///  The coordinate of the Node along the primary axis.  Updated by ConstraintGenerator.Solve().
  ///  </summary>
  Position: number

  ///  <summary>
  ///  The coordinate of the Node along the secondary (Perpendicular) axis.
  ///  </summary>
  PositionP: number

  //  Updated only for Clusters
  ///  <summary>
  ///  The size of the Node along the primary axis.
  ///  </summary>
  Size: number

  //  Updated only for Clusters
  ///  <summary>
  ///  The size of the Node along the secondary (Perpendicular) axis.
  ///  </summary>
  SizeP: number

  //  Updated only for Clusters
  ///  <summary>
  ///  The opening border of the Node along the primary axis; Left if horizontal,
  ///  Top if Vertical.
  ///  </summary>
  get Open(): number {
    return this.Position - this.Size / 2
  }

  ///  <summary>
  ///  The closing border of the Node along the primary axis; Right if horizontal,
  ///  Bottom if Vertical.
  ///  </summary>
  public get Close(): number {
    return this.Position + this.Size / 2
  }

  ///  <summary>
  ///  The opening border of the Node along the secondary (Perpendicular) axis; Top if horizontal,
  ///  Bottom if Vertical.
  ///  </summary>
  public get OpenP(): number {
    return this.PositionP - this.SizeP / 2
  }

  ///  <summary>
  ///  The closing border of the Node along the secondary (Perpendicular) axis; Bottom if horizontal,
  ///  Right if Vertical.
  ///  </summary>
  public get CloseP(): number {
    return this.PositionP + this.SizeP / 2
  }

  ///  <summary>
  ///  The weight of the node along the primary axis.
  ///  </summary>
  Weight: number

  //  This identifies the node for consistent-sorting purposes in the Event list.
  Id: number

  //  This is the normal node ctor, from ConstraintGenerator.
  constructor(id: number, userData: any, position: number, positionP: number, size: number, sizeP: number, weight: number) {
    if (weight <= 0) {
      throw new Error('weight')
    }

    let dblCheck: number = (Math.abs(position) + size) * weight
    if (!Number.isFinite(dblCheck) || Number.isNaN(dblCheck)) {
      throw new Error('position')
    }

    dblCheck = (Math.abs(positionP) + sizeP) * weight
    if (!Number.isFinite(dblCheck) || Number.isNaN(dblCheck)) {
      throw new Error('positionP')
    }

    this.Id = id
    this.UserData = userData
    this.Position = position
    this.PositionP = positionP
    this.Size = size
    this.SizeP = sizeP
    this.Weight = weight
  }

  //  This is the constructor for the "fake nodes" of a Cluster and its Borders.
  //  We default to free border weight so the cluster borders can move freely during Solve().
  //  The weight is overridden for the Cluster border nodes during Cluster.Generate.
  static constructorNA(id: number, userData: any): OverlapRemovalNode {
    return new OverlapRemovalNode(id, userData, 0, 0, 0, 0, BorderInfo.DefaultFreeWeight)
  }

  static Overlap(n1: OverlapRemovalNode, n2: OverlapRemovalNode, padding: number): number {
    //  Returns > 0 if the nodes overlap (combined sizes/2 plus required padding between
    //  nodes is greater than the distance between the nodes).
    return (n1.Size + n2.Size) / 2 + (padding - Math.abs(n1.Position - n2.Position))
  }

  static OverlapP(n1: OverlapRemovalNode, n2: OverlapRemovalNode, paddingP: number): number {
    //  Returns > 0 if the nodes overlap (combined sizes/2 plus required padding between
    //  nodes is greater than the distance between the nodes).
    return (n1.SizeP + n2.SizeP) / 2 + (paddingP - Math.abs(n1.PositionP - n2.PositionP))
  }

  ///  <summary>
  ///  Create the backing Variable for this Node in the solver.
  ///  </summary>
  ///  <param name="solver"></param>
  public CreateVariable(solver: Solver) {
    //  Due to multiple hierarchies, we must check to see if the variable has been created yet;
    //  we share one Node (and its single Variable) across all clusters it's a member of.
    if (this.Variable == null) {
      this.Variable = solver.AddVariableANN(this, this.Position, this.Weight)
    } else {
      //  Make sure the position is updated as the caller may have called this before and then we recalculated
      //  the position at some point (e.g. for Cluster boundary nodes).
      this.UpdateDesiredPosition(this.Position)
    }
  }

  //  Overridden by Cluster.  Called after Solve(); sets the Node position to that of its Variable.
  UpdateFromVariable() {
    //  If the Variable is null then we were already updated from an earlier cluster in
    //  another hierarchy.
    if (null != this.Variable) {
      this.Position = this.Variable.ActualPos
      //  Currently we don't use this anymore.
      this.Variable = null
    }
  }

  //  Currently called only from clusters when repositioning "fake border" nodes from the
  //  constraint-generation position (outer edge) to the pre-Solve position (central edge).
  UpdateDesiredPosition(newPosition: number) {
    this.Position = newPosition
    this.Variable.DesiredPos = newPosition
  }

  ///  <summary>
  ///  Generate a string representation of the Node.
  ///  </summary>
  ///  <returns>A string representation of the Node.</returns>
  public /* override */ ToString(): string {
    return String.Format(
      "Nod '{0}': id {1} p {2:F5} s {3:F5} pP {4:F5} sP {5:F5}",
      this.UserDataString,
      this.Id,
      this.Position,
      this.Size,
      this.PositionP,
      this.SizeP,
    )
  }

  public compareTo(other: OverlapRemovalNode): number {
    let cmp: number = this.Position - other.Position
    if (cmp == 0) {
      cmp = this.Id - other.Id
    }

    return cmp
  }

  //  Omitting any of the following violates rule: OverrideMethodsOnComparableTypes.
  public /* override */ Equals(obj: OverlapRemovalNode): boolean {
    return this.compareTo(obj) == 0
  }
}
