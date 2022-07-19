///  <summary>
///  Per-instance parameters for OverlapRemoval.ConstraintGenerator.Generate()/Solve().

import {Parameters} from '../../projectionSolver/Parameters'

///  </summary>
export class OverlapRemovalParameters {
  ///  <summary>
  ///  If true and the current instance's IsHorizontal property is true, then by default
  ///  constraints will not be generated on the horizontal pass if a vertical constraint
  ///  would result in less movement.
  ///  </summary>
  AllowDeferToVertical: boolean

  ///  <summary>
  ///  The calculation to choose in deciding which way to resolve overlap (horizontally or vertically)
  ///  between two nodes u and v.
  ///  If this is false the calculation is simply HOverlap > VOverlap, otherwise we use:
  ///  HOverlap / (u.Width + v.Width) > VOverlap / (u.Height + v.Height)
  ///  </summary>
  ConsiderProportionalOverlap: boolean

  ///  <summary>
  ///  Parameters to the Solver, used in Generate as well as passed through to the Solver.
  ///  </summary>

  SolverParameters: Parameters

  ///  <summary>
  ///  Default Constructor.
  ///  </summary>
  static constructorEmpty(): OverlapRemovalParameters {
    return new OverlapRemovalParameters(new Parameters())
  }

  ///  <summary>
  ///  Constructor taking solver parameters.
  ///  </summary>
  ///  <param name="solverParameters"></param>
  public constructor(solverParameters: Parameters) {
    this.SolverParameters = solverParameters
    this.AllowDeferToVertical = true
  }

  ///  <summary>
  ///  Constructor taking OverlapRemoval parameter and solver parameters.
  ///  </summary>
  ///  <param name="allowDeferToVertical"></param>
  ///  <param name="solverParameters"></param>
  static constructorBP(allowDeferToVertical: boolean, solverParameters: Parameters): OverlapRemovalParameters {
    const p = OverlapRemovalParameters.constructorEmpty()
    p.AllowDeferToVertical = allowDeferToVertical
    p.SolverParameters = solverParameters
    return p
  }

  public Clone(): OverlapRemovalParameters {
    const newParams: OverlapRemovalParameters = this.Clone()
    newParams.SolverParameters = this.SolverParameters.Clone()
    return newParams
  }
}
