///  <summary>
///  A constraint must provide a method to find a feasible starting configuration,
///  and a method to satisfy the constraint by moving the affected nodes as little as possible
///  </summary>
export interface IConstraint {
  ///  <summary>
  ///  Satisfy the constraint by moving as little as possible.
  ///  <returns>Amount of displacement</returns>
  ///  </summary>
  Project(): number

  ///  <summary>
  ///  Get the list of nodes involved in the constraint
  ///  </summary>
  Nodes: Iterable<Node>

  ///  <summary>
  ///  Constraints are applied according to a schedule.
  ///  Level 0 constraints will be applied at all stages,
  ///  Level 1 after a certain number of Level 0 has completed
  ///  Level 2 after level 1 and so on.
  ///  </summary>
  ///  <returns></returns>
  Level: number
}
