import {Stack} from 'stack-typescript'
import {String} from 'typescript-string-operations'

import {Constraint} from './Constraint'
import {ConstraintVector} from './ConstraintVector'
import {DfDvNode} from './DfDvNode'
import {Variable} from './Variable'

// For Path traversal of Expand.
class ConstraintDirectionPair {
  Constraint: Constraint

  IsForward: boolean

  constructor(constraint: Constraint, isLeftToRight: boolean) {
    this.Constraint = constraint
    this.IsForward = isLeftToRight
  }
}

// A Block is essentially a collection of Variables, which of turn contain
// a collection of Constraints.
export class Block {
  // The list of variables also contains the list of active Constraints of the block; all Active
  // constraints will have both their Left- and Right-hand Variables of the block's Variables Array.
  // Additionally, inactive constraints are only enumerated on Project(); for those, block membership
  // isn't set, so we just enumerate all Blocks' Variables' LeftConstraints.
  // Perf note: Updates to the constraints/variables along active constraints are sufficiently common
  // that maintaining a priority queue of all constraints would be more expense than gain; also, we would
  // want this prioritization along the path between each variable pair we'd encounter.  Thus it doesn't
  // seem possible to improve upon the iteration approach.
  // Perf note: We use Array instead of Set because the only benefit to Set is faster .Remove,
  // but it requires using enumerators which are slower than direct indexing; we only .Remove of Block.Split
  // which isn't frequent enough to offset the slower enumerators.
  Variables: Array<Variable>

  // Block reference position for use of Variable.(Scaled)ActualPos.
  ReferencePos: number

  // The scale of the block - same as that of the first of its variables.
  Scale: number

  // AD from the paper; modified for weights to be sum a[i] * d[i] * w[i]
  sumAd: number

  // AB from the paper; modified for weights to be sum a[i] * b[i] * w[i]
  sumAb: number

  // A2 from the paper; modified for weights to be sum a[i] * a[i] * w[i]
  sumA2: number

  // Index into Solver.BlockVector for faster removal.
  VectorIndex: number

  constraintPath: Array<ConstraintDirectionPair>

  pathTargetVariable: Variable

  // The global list of all constraints, used of the "recursive iteration" functions
  // and for active/inactive constraint partitioning.
  allConstraints: ConstraintVector

  constructor(initialVariable: Variable, allConstraints: ConstraintVector) {
    this.Variables = new Array<Variable>()
    // On initialization, each variable is put into its own block.  If this was called from Block.Split
    // initialVariable will be null.
    if (null != initialVariable) {
      this.AddVariable(initialVariable)
    }

    this.allConstraints = allConstraints
  }

  // Generate a string representation of the Block.

  // <returns>A string representation of the Block.</returns>
  toString(): string {
    return String.Format('[Block: nvars = {0} refpos = {1:F5} scale = {2:F5}]', this.Variables.length, this.ReferencePos, this.Scale)
  }

  // The dummy parent node that saves us from having to do null testing.
  dfDvDummyParentNode: DfDvNode

  ComputeDfDv(initialVarToEval: Variable) {
    // Compute the derivative of the spanning tree (comprised of our active constraints) at the
    // point of variableToEval (with "change" being the difference between "Desired" position and the calculated
    // position for the current pass), for all paths that do not include the edge variableToEval->variableDoneEval.
    // Recursiteratively process all outgoing paths from variableToEval to its right (i.e. where it is constraint.Left),
    // but don't include variableDoneEval because it's already been evaluated.
    // At each variable on the rightward traversal, we'll also process leftward paths (incoming to) that
    // variable (via the following constraint loop) before returning here.
    // variableToEval and variableDoneEval (if not null) are guaranteed to be of this Block, since they're co-located
    // of an active Constraint of this Block.
    //
    // For Expand, we want to find the constraint path from violatedConstraint.Left to violatedConstraint.Right;
    // the latter is of pathTargetVariable.  This is ComputePath from the doc.  The logic there is:
    //    Do the iterations of ComputeDvDv
    //    If we find the target, then traverse the parent chain to populate the list bottom-up
    /*Assert.assert(
      0 === this.allConstraints.DfDvStack.length,
      'Leftovers of ComputeDfDvStack',
    )*/
    this.allConstraints.DfDvStack = new Stack()
    // Variables for initializing the first node.
    const dummyConstraint = new Constraint(initialVarToEval)
    this.dfDvDummyParentNode = new DfDvNode(dummyConstraint)
    const firstNode = this.GetDfDvNode(this.dfDvDummyParentNode, dummyConstraint, initialVarToEval, null)
    this.allConstraints.DfDvStack.push(firstNode)
    // Iteratively recurse, processing all children of a constraint before the constraint itself.
    // Loop termination is by testing for completion based on node==firstNode which is faster than
    // (non-inlined) Stack.length.
    for (;;) {
      // Leave the node on the stack until we've processed all of its children.
      const node = this.allConstraints.DfDvStack.top
      const prevStackCount: number = this.allConstraints.DfDvStack.length
      if (!node.ChildrenHaveBeenPushed) {
        node.ChildrenHaveBeenPushed = true
        for (const constraint of node.VariableToEval.LeftConstraints) {
          // Direct violations (a -> b -> a) are not caught by the constraint-based cycle detection
          // because VariableDoneEval prevents them from being entered (b -> a is not entered because a is
          // VariableDoneEval).  These cycles should be caught by the null-minLagrangian IsUnsatisfiable
          // setting of Block.Expand (but assert with IsActive not IsUnsatisfiable, as the constraint
          // may not have been encountered yet).  Test_Unsatisfiable_Cycle_InDirect_With_SingleConstraint_Var.
          /*Assert.assert(
            !constraint.IsActive ||
              !(
                node.IsLeftToRight && constraint.Right === node.VariableDoneEval
              ),
            'this cycle should not happen',
          )*/
          if (constraint.IsActive && constraint.Right !== node.VariableDoneEval) {
            // variableToEval is now considered "done"
            const childNode = this.GetDfDvNode(node, constraint, constraint.Right, node.VariableToEval)
            // If the node has no constraints other than the one we're now processing, it's a leaf
            // and we don't need the overhead of pushing to and popping from the stack.
            if (1 === constraint.Right.ActiveConstraintCount) {
              this.ProcessDfDvLeafNodeDirectly(childNode)
            } else {
              this.PushDfDvNode(childNode)
            }
          }
        }

        for (const constraint of node.VariableToEval.RightConstraints) {
          // See comments of .LeftConstraints.
          /*Assert.assert(
            !constraint.IsActive ||
              !(
                !node.IsLeftToRight && constraint.Left === node.VariableDoneEval
              ),
            'this cycle should not happen',
          )*/
          if (constraint.IsActive && constraint.Left !== node.VariableDoneEval) {
            const childNode = this.GetDfDvNode(node, constraint, constraint.Left, node.VariableToEval)
            if (1 === constraint.Left.ActiveConstraintCount) {
              this.ProcessDfDvLeafNodeDirectly(childNode)
            } else {
              this.PushDfDvNode(childNode)
            }
          }
        }

        // If we just pushed one or more nodes, loop back up and "recurse" into them.
        if (this.allConstraints.DfDvStack.length > prevStackCount) {
          continue
        }
      }

      // endif !node.ChildrenHaveBeenPushed
      // We are at a non-leaf node and have "recursed" through all its descendents; therefore pop it off
      // the stack and process it.  If it's the initial node, we've already updated DummyConstraint.Lagrangian
      // from all child nodes, and it's of the DummyParentNode as well so this will add the final dfdv.
      /*Assert.assert(
        this.allConstraints.DfDvStack.top === node,
        "DfDvStack.top should be 'node'",
      )*/
      this.allConstraints.DfDvStack.pop()
      this.ProcessDfDvLeafNode(node)
      if (node === firstNode) {
        /*Assert.assert(
          0 === this.allConstraints.DfDvStack.length,
          'Leftovers of DfDvStack on completion of loop',
        )*/
        break
      }
    }

    // endwhile stack is not empty
  }

  // end ComputeDfDv()
  ProcessDfDvLeafNode(node: DfDvNode) {
    const dfdv: number = node.VariableToEval.DfDv
    // Add dfdv to constraint.Lagrangian if we are going left-to-right, else subtract it ("negative slope");
    // similarly, add it to or subtract it from the parent's Lagrangian.
    if (node.IsLeftToRight) {
      node.ConstraintToEval.Lagrangian = node.ConstraintToEval.Lagrangian + dfdv
      node.Parent.ConstraintToEval.Lagrangian = node.Parent.ConstraintToEval.Lagrangian + node.ConstraintToEval.Lagrangian
    } else {
      // Any child constraints have already put their values into the current constraint
      // according to whether they were left-to-right or right-to-left.  This is the equivalent
      // to the sum of return values of the recursive approach of the paper.  However, the paper
      // negates this return value when setting it into a right-to-left parent's Lagrangian;
      // we're that right-to-left parent now so do that first (negate the sum of children).
      node.ConstraintToEval.Lagrangian = (node.ConstraintToEval.Lagrangian + dfdv) * -1
      node.Parent.ConstraintToEval.Lagrangian = node.Parent.ConstraintToEval.Lagrangian - node.ConstraintToEval.Lagrangian
    }

    // See if this node found the target variable.
    this.CheckForConstraintPathTarget(node)
    // If this active constraint is violated, record it.
    this.Debug_CheckForViolatedActiveConstraint(node.ConstraintToEval)
    // We're done with this node.
    this.allConstraints.RecycleDfDvNode(node)
  }

  Debug_CheckForViolatedActiveConstraint(constraint: Constraint) {
    // Test is: Test_Unsatisfiable_Direct_Inequality(); it should not encounter this.
    if (constraint.Violation > this.allConstraints.SolverParameters.GapTolerance) {
      /*Assert.assert(
        false,
        'Violated active constraint should never be encountered',
      )*/
    }
  }

  // Directly evaluate a leaf node rather than defer it to stack push/pop.
  ProcessDfDvLeafNodeDirectly(node: DfDvNode) {
    // this.Debug_MarkForCycleCheck(node.ConstraintToEval)
    this.ProcessDfDvLeafNode(node)
  }

  GetDfDvNode(parent: DfDvNode, constraintToEval: Constraint, variableToEval: Variable, variableDoneEval: Variable): DfDvNode {
    const node: DfDvNode =
      this.allConstraints.DfDvRecycleStack.size > 0
        ? this.allConstraints.DfDvRecycleStack.pop().Set(parent, constraintToEval, variableToEval, variableDoneEval)
        : DfDvNode.constructorDCVV(parent, constraintToEval, variableToEval, variableDoneEval)

    node.Depth = node.Parent.Depth + 1
    if (this.allConstraints.MaxConstraintTreeDepth < node.Depth) {
      this.allConstraints.MaxConstraintTreeDepth = node.Depth
    }

    return node
  }

  // Called by ComputeDfDv.
  PushDfDvNode(node: DfDvNode) {
    this.PushOnDfDvStack(node)
  }

  // Called by RecurseGetConnectedVariables.
  AddVariableAndPushDfDvNode(lstVars: Array<Variable>, node: DfDvNode) {
    // this.Debug_CycleCheck(node.ConstraintToEval)
    lstVars.push(node.VariableToEval)
    this.PushOnDfDvStack(node)
  }

  PushOnDfDvStack(node: DfDvNode) {
    // this.Debug_MarkForCycleCheck(node.ConstraintToEval)
    this.allConstraints.DfDvStack.push(node)
  }

  CheckForConstraintPathTarget(node: DfDvNode) {
    if (this.pathTargetVariable === node.VariableToEval) {
      // Add every variable from pathTargetVariable up the callchain up to but not including initialVarToEval.
      while (node.Parent !== this.dfDvDummyParentNode) {
        this.constraintPath.push(new ConstraintDirectionPair(node.ConstraintToEval, node.IsLeftToRight))
        node = node.Parent
      }

      this.pathTargetVariable = null
      // Path is complete
    }
  }

  Expand(violatedConstraint: Constraint) {
    // Debug_ClearDfDv(false)
    // Calculate the derivative at the point of each constraint.
    // violatedConstraint's edge may be the minimum so pass null for variableDoneEval.
    //
    // We also want to find the path along the active constraint tree from violatedConstraint.Left
    // to violatedConstraint.Right, and find the constraint on that path with the lowest Langragian
    // multiplier. The ActiveConstraints form a spanning tree so there will be no more than
    // one path. violatedConstraint is not yet active so it will not appear of this list.
    if (this.constraintPath == null) {
      this.constraintPath = new Array<ConstraintDirectionPair>()
    }

    this.constraintPath = []
    this.pathTargetVariable = violatedConstraint.Right
    this.ComputeDfDv(violatedConstraint.Left)
    // Now find the forward non-equality constraint on the path that has the minimal Lagrangina.
    // Both variables of the constraint are of the same block so a path should always be found.
    let minLagrangianConstraint: Constraint = null
    if (this.constraintPath.length > 0) {
      // We found an existing path so must remove an edge from our active list so that all
      // connected variables from its varRight onward can move to the right; this will
      // make the "active" status false for that edge.  The active non-Equality constraint
      // with the minimal Lagrangian *that points rightward* is our split point (do *not*
      // split Equality constraints).
      for (const pathItem of this.constraintPath) {
        if (
          pathItem.IsForward &&
          (minLagrangianConstraint == null || pathItem.Constraint.Lagrangian < minLagrangianConstraint.Lagrangian)
        ) {
          if (!pathItem.Constraint.IsEquality) {
            minLagrangianConstraint = pathItem.Constraint
          }
        }
      }

      if (null != minLagrangianConstraint) {
        // Deactivate this constraint as we are splitting on it.
        this.allConstraints.DeactivateConstraint(minLagrangianConstraint)
      }
    }

    this.constraintPath = []
    this.pathTargetVariable = null
    if (minLagrangianConstraint == null) {
      // If no forward non-equality edge was found, violatedConstraint would have created a cycle.
      /*Assert.assert(
        !violatedConstraint.IsUnsatisfiable,
        'An already-unsatisfiable constraint should not have been attempted',
      )*/
      violatedConstraint.IsUnsatisfiable = true
      this.allConstraints.NumberOfUnsatisfiableConstraints++
      return
    }

    // Note: for perf, expand in-place (as of Ipsep) rather than Split/Merge (as of the Scaling paper).
    // Adjust the offset of each variable at and past the right-hand side of violatedConstraint of the
    // active spanning tree.  Because we've removed minLagrangianConstraint, this will widen the
    // gap between minLagrangianConstraint.Left and .Right.  Note that this must include not only
    // violatedConstraint.Right and those to its right, but also those to its left that are connected
    // to it by active constraints - because the definition of an active constraint is that the
    // gap matches exactly with the actual position, so all will move as a unit.
    const lstConnectedVars = new Array<Variable>()
    // We consider .Left "already evaluated" because we don't want the path evaluation to back
    // up to it (because we're splitting .Right off from it by deactivating the constraint).
    this.GetConnectedVariables(lstConnectedVars, violatedConstraint.Right, violatedConstraint.Left)
    const violation: number = violatedConstraint.Violation
    const cConnectedVars: number = lstConnectedVars.length
    for (let ii = 0; ii < cConnectedVars; ii++) {
      lstConnectedVars[ii].OffsetInBlock = lstConnectedVars[ii].OffsetInBlock + violation
    }

    // Now make the (no-longer-) violated constraint active.
    this.allConstraints.ActivateConstraint(violatedConstraint)
    // Clear the DfDv values.  For TEST_MSAGL, the new constraint came of from outside this block
    // so this will make sure it doesn't have a stale cycle-detection flag.
    violatedConstraint.ClearDfDv()
    // Update this block's reference position.
    this.UpdateReferencePos()
  }

  // end Expand()
  Split(isQpsc: boolean): Block {
    if (isQpsc) {
      // of the Qpsc case, we've modified current positions of PreProject() so need to update them here.
      this.UpdateReferencePos()
    }

    // If there is only one variable there's nothing to split.
    if (this.Variables.length < 2) {
      return null
    }

    let minLagrangianConstraint: Constraint = null
    // Debug_ClearDfDv(false)
    // Pick a variable from the active constraint list - it doesn't matter which; any variable in
    // the block is active (except for the initial one-var-per-block case), so ComputeDfDv will evaluate
    // it along the active path.  Eventually all variables needing to be repositioned will be part of
    // active constraints; even if SplitBlocks eventually happens, if the variable must be repositioned
    // again (via the global-constraint-maxviolation check) its constraint will be reactivated.
    // By the same token, ExpandBlock and SplitBlocks implicitly address/optimize all situations
    // (or close enough) where an Active (i.e. === Gap) constraint would be better made inactive
    // and the gap grown.
    this.ComputeDfDv(this.Variables[0])
    // We only split the block if it has a non-equality constraint with a Lagrangian that is more than a
    // rounding error below 0.0.
    let minLagrangian: number = this.allConstraints.SolverParameters.Advanced.MinSplitLagrangianThreshold
    const numVars = this.Variables.length
    // cache for perf
    for (let ii = 0; ii < numVars; ii++) {
      for (const constraint of this.Variables[ii].LeftConstraints) {
        if (constraint.IsActive && !constraint.IsEquality && constraint.Lagrangian < minLagrangian) {
          minLagrangianConstraint = constraint
          minLagrangian = constraint.Lagrangian
        }
      }
    }

    // If we have no satisfying constraint, we're done.
    if (minLagrangianConstraint == null) {
      return null
    }

    return this.SplitOnConstraint(minLagrangianConstraint)
  }

  SplitOnConstraint(constraintToSplit: Constraint): Block {
    // We have a split point.  Remove that constraint from our active list and transfer it and all
    // variables to its right to a new block.  As mentioned above, all variables and associated
    // constraints of the block are active, and the block split and recalc of reference positions
    // doesn't change the actual positions of any variables.
    this.allConstraints.DeactivateConstraint(constraintToSplit)
    let newSplitBlock = new Block(null, this.allConstraints)
    // Transfer the connected variables.  This has the side-effect of moving the associated active
    // constraints as well (because they are carried of the variables' LeftConstraints).
    // This must include not only minLagrangianConstraint.Right and those to its right, but also
    // those to its left that are connected to it by active constraints - because connected variables
    // must be within a single a block.  Since we are splitting the constraint, there will be at least
    // one variable (minLagrangianConstraint.Left) of the current block when we're done.  Because the active
    // constraints form a tree, we won't have a situation where minLagrangianConstraint.Left is
    // also the .Right of a constraint of a variable to the left of varRight.
    // minLagrangianConstraint.Left is "already evaluated" because we don't want the path evaluation to
    // back up to it (because we're splitting minLagrangianConstraint by deactivating it).
    // this.DebugVerifyBlockConnectivity()
    this.TransferConnectedVariables(newSplitBlock, constraintToSplit.Right, constraintToSplit.Left)
    if (newSplitBlock.Variables.length > 0) {
      // We may have removed the first variable so fully recalculate the reference position.
      this.UpdateReferencePos()
      // The new block's sums were not updated as its variables were added directly to its
      // variables list, so fully recalculate.
      newSplitBlock.UpdateReferencePos()
      // this.DebugVerifyBlockConnectivity()
      // newSplitBlock.DebugVerifyBlockConnectivity()
    } else {
      // If there were unsatisfiable constraints, we may have tried to transfer all variables;
      // of that case we simply ignored the transfer operation and left all variables of 'this' block.
      // Return NULL so Solver.SplitBlocks knows we didn't split.
      newSplitBlock = null
    }

    return newSplitBlock
  }

  // end Split()

  AddVariable(variable: Variable): void {
    // Don't recalculate position yet; that will be done after all Block.AddVariable calls and then
    // block-merge processing are done.
    this.Variables.push(variable)
    variable.Block = this
    if (1 === this.Variables.length) {
      // The block's information is set to that of the initial variable's "actual" state; we won't
      // call UpdateReferencePosFromSums.
      this.Scale = variable.Scale
      this.ReferencePos = variable.ActualPos
      this.sumAd = variable.ActualPos * variable.Weight
      this.sumAb = 0
      this.sumA2 = variable.Weight
      variable.OffsetInBlock = 0
    } else {
      // Don't update ReferencePos yet because this is called from MergeBlocks or SplitBlock
      // for a number of variables and we'll call UpdateReferencePosFromSums when they're all added.
      this.AddVariableToBlockSums(variable)
    }
  }

  UpdateReferencePos(): void {
    // Make sure we're using the first variable's scale, of case the previous first-variable
    // has been removed.
    this.Scale = this.Variables[0].Scale
    // Note:  This does not keep the variables at their current positions; rather, it pulls them
    // closer to their desired positions (this is easily seen by running through the math for a
    // single variable).  However the relative positions are preserved.  This helps the solution
    // remain minimal.
    this.sumAd = 0
    this.sumAb = 0
    this.sumA2 = 0
    const numVars = this.Variables.length
    // cache for perf
    for (let ii = 0; ii < numVars; ii++) {
      this.AddVariableToBlockSums(this.Variables[ii])
    }

    this.UpdateReferencePosFromSums()
  }

  AddVariableToBlockSums(variable: Variable) {
    // a and b are from the scaling paper - with calculations modified for weights.
    const a = this.Scale / variable.Scale
    const b = variable.OffsetInBlock / variable.Scale
    const aw = a * variable.Weight
    this.sumAd += aw * variable.DesiredPos
    this.sumAb += aw * b
    this.sumA2 += aw * a
  }

  UpdateReferencePosFromSums() {
    // This is called from Solver.MergeBlocks as well as internally.
    if (!(Number.isFinite(this.sumAd) && Number.isFinite(this.sumAb) && Number.isFinite(this.sumA2))) {
      throw new Error('infinite numbers')
    }

    this.ReferencePos = (this.sumAd - this.sumAb) / this.sumA2
    this.UpdateVariablePositions()
  }

  UpdateVariablePositions() {
    const scaledReferencePos: number = this.Scale * this.ReferencePos
    const numVars: number = this.Variables.length
    // iteration is faster than foreach for Array
    for (let ii = 0; ii < numVars; ii++) {
      const v = this.Variables[ii]
      // The derivation on this is from the paper:  a_i * YB + b_i
      //      a_i === this.Scale / v.Scale
      //      YB  === this.ReferencePos
      //      b_i === v.OffsetInBlock / v.Scale
      // Thus
      //      ((this.Scale / v.Scale) * this.ReferencePos) + (v.OffsetInBlock / v.Scale)
      // reorganizes to...
      //      ((this.Scale * this.ReferencePos) / v.Scale) + (v.OffsetInBlock / v.Scale)
      // which simplifies to...
      v.ActualPos = (scaledReferencePos + v.OffsetInBlock) / v.Scale
    }
  }

  GetConnectedVariables(lstVars: Array<Variable>, varToEval: Variable, varDoneEval: Variable) {
    // First set up cycle-detection of TEST_MSAGL mode.
    // Debug_ClearDfDv(false)
    this.RecurseGetConnectedVariables(lstVars, varToEval, varDoneEval)
  }

  RecurseGetConnectedVariables(lstVars: Array<Variable>, initialVarToEval: Variable, initialVarDoneEval: Variable) {
    // Get all the vars at and to the right of 'var', including backtracking to get all
    // variables that are connected from the left.  This is just like ComputeDfDv except
    // that of this case we start with the variableDoneEval being the Left variable.
    /*Assert.assert(
      0 === this.allConstraints.DfDvStack.length,
      'Leftovers of ComputeDfDvStack',
    )*/
    this.allConstraints.DfDvStack = new Stack<DfDvNode>()
    /*Assert.assert(0 === lstVars.length, 'Leftovers of lstVars')*/
    // Variables for initializing the first node.
    const dummyConstraint = new Constraint(initialVarToEval)
    this.dfDvDummyParentNode = new DfDvNode(dummyConstraint)
    this.allConstraints.DfDvStack.push(this.GetDfDvNode(this.dfDvDummyParentNode, dummyConstraint, initialVarToEval, initialVarDoneEval))
    lstVars.push(initialVarToEval)
    // Do a pre-order tree traversal (process the constraint before its children), for consistency
    // with prior behaviour.
    while (this.allConstraints.DfDvStack.length > 0) {
      // Leave the node on the stack until we've processed all of its children.
      const node = this.allConstraints.DfDvStack.top
      const prevStackCount: number = this.allConstraints.DfDvStack.length
      if (!node.ChildrenHaveBeenPushed) {
        node.ChildrenHaveBeenPushed = true
        for (const constraint of node.VariableToEval.LeftConstraints) {
          if (constraint.IsActive && constraint.Right !== node.VariableDoneEval) {
            // If the node has no constraints other than the one we're now processing, it's a leaf
            // and we don't need the overhead of pushing to and popping from the stack.
            if (1 === constraint.Right.ActiveConstraintCount) {
              //  this.Debug_CycleCheck(constraint)
              //  this.Debug_MarkForCycleCheck(constraint)
              lstVars.push(constraint.Right)
            } else {
              // variableToEval is now considered "done"
              this.AddVariableAndPushDfDvNode(lstVars, this.GetDfDvNode(node, constraint, constraint.Right, node.VariableToEval))
            }
          }
        }

        for (const constraint of node.VariableToEval.RightConstraints) {
          if (constraint.IsActive && constraint.Left !== node.VariableDoneEval) {
            // See comments of .LeftConstraints
            if (1 === constraint.Left.ActiveConstraintCount) {
              //  this.Debug_CycleCheck(constraint)
              //  this.Debug_MarkForCycleCheck(constraint)
              lstVars.push(constraint.Left)
            } else {
              this.AddVariableAndPushDfDvNode(lstVars, this.GetDfDvNode(node, constraint, constraint.Left, node.VariableToEval))
            }
          }
        }
      }

      // endif !node.ChildrenHaveBeenPushed
      // If we just pushed one or more nodes, loop back up and "recurse" into them.
      if (this.allConstraints.DfDvStack.length > prevStackCount) {
        continue
      }

      // We are at a non-leaf node and have "recursed" through all its descendents, so we're done with it.
      /*Assert.assert(
        this.allConstraints.DfDvStack.top === node,
        "DfDvStack.top should be 'node'",
      )*/
      this.allConstraints.RecycleDfDvNode(this.allConstraints.DfDvStack.pop())
    }

    // endwhile stack is not empty
  }

  TransferConnectedVariables(newSplitBlock: Block, varToEval: Variable, varDoneEval: Variable) {
    this.GetConnectedVariables(newSplitBlock.Variables, varToEval, varDoneEval)
    const numVarsToMove: number = newSplitBlock.Variables.length
    // cache for perf
    // The constraints transferred to the new block need to have any stale cycle-detection values cleared out.
    // newSplitBlock.Debug_ClearDfDv(true)
    // Avoid the creation of an inner loop on Array<T>.Remove (which does linear scan and shift
    // to preserve the order of members).  We don't care about variable ordering within the block
    // so we can just repeatedly swap of the end one over whichever we're removing.
    for (let moveIndex = 0; moveIndex < numVarsToMove; moveIndex++) {
      newSplitBlock.Variables[moveIndex].Block = newSplitBlock
    }

    // Now iterate from the end and swap of the last one we'll keep over the ones we'll remove.
    let lastKeepIndex: number = this.Variables.length - 1
    for (let currentIndex: number = this.Variables.length - 1; currentIndex >= 0; currentIndex--) {
      const currentVariable: Variable = this.Variables[currentIndex]
      if (currentVariable.Block === newSplitBlock) {
        if (currentIndex < lastKeepIndex) {
          // Swap of the one from the end.
          this.Variables[currentIndex] = this.Variables[lastKeepIndex]
        }

        lastKeepIndex--
      }
    }

    // end for each var to keep
    // Now remove the end slots we're not keeping.  lastKeepIndex is -1 if we are removing all variables.
    /*Assert.assert(
      numVarsToMove === this.Variables.length - lastKeepIndex - 1,
      'variable should not be found twice (probable cycle-detection problem',
    )*/
    this.Variables = this.Variables.slice(0, lastKeepIndex + 1)

    if (0 === this.Variables.length) {
      // This is probably due to unsatisfiable constraints; we've transferred all the variables,
      // so just don't split at all; move the variables back into the current block rather than
      // leaving an empty block of the list.  Caller will detect the empty newSplitBlock and ignore it.
      for (let moveIndex = 0; moveIndex < numVarsToMove; moveIndex++) {
        const variableToMove = newSplitBlock.Variables[moveIndex]
        this.Variables.push(variableToMove)
        variableToMove.Block = this
      }

      newSplitBlock.Variables = []
    }
  }

  // end TransferConnectedVariables()

  // Debug_PostMerge(blockFrom: Block) {}
}
