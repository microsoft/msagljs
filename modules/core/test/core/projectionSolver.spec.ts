import {Solver} from '../../src/math/projectionSolver/Solver'
import {Variable} from '../../src/math/projectionSolver/Variable'
import {closeDistEps} from '../../src/utils/compare'

test('two vars test', () => {
  const s = new Solver()
  const v0 = s.AddVariableAN('v0', 0)
  const v1 = s.AddVariableAN('v1', 1)
  s.AddConstraint(v0, v1, 1)
  s.Solve()
  expect(v0.ActualPos).toBe(v0.DesiredPos)
  expect(v1.ActualPos).toBe(v1.DesiredPos)
})
test('two vars test, one real constr', () => {
  const s = new Solver()
  const v0 = s.AddVariableAN('v0', 0)
  const v1 = s.AddVariableAN('v1', 1)
  s.AddConstraint(v0, v1, 2)
  s.Solve()
  expect(v0.ActualPos).toBeLessThan(v1.ActualPos)
})

test('three vars test, one real constr', () => {
  const s = new Solver()
  const v0 = s.AddVariableAN('v0', 0)
  const v1 = s.AddVariableAN('v1', 1)
  const v2 = s.AddVariableAN('v2', 2)
  s.AddConstraint(v0, v1, 2)
  s.AddConstraint(v1, v2, 2)
  s.Solve()
  expect(v0.ActualPos).toBeLessThan(v1.ActualPos)
  expect(v1.ActualPos).toBeLessThan(v2.ActualPos)
  expect(closeDistEps(v0.ActualPos - v1.ActualPos, v1.ActualPos - v2.ActualPos)).toBe(true)
})

test('four vars test', () => {
  const s = new Solver()
  const v0 = s.AddVariableAN('v0', 0)
  const v1 = s.AddVariableAN('v1', 1)
  const v2 = s.AddVariableAN('v2', 2)
  const v3 = s.AddVariableAN('v3', 3)
  s.AddConstraint(v0, v1, 2)
  s.AddConstraint(v2, v3, 2)
  s.AddEqualityConstraint(v1, v2, 0)
  s.Solve()
  expect(v0.ActualPos).toBeLessThan(v1.ActualPos)
  expect(v2.ActualPos).toBeLessThan(v3.ActualPos)
  expect(closeDistEps(v1.ActualPos - v0.ActualPos, 2)).toBe(true)
  expect(v1.ActualPos).toBe(v2.ActualPos)
})
test('cycle', () => {
  const s = new Solver()
  const vars = new Array<Variable>()

  for (let i = 0; i < 5; i++) {
    vars.push(s.AddVariableAN(i, i))
  }
  for (let i = 0; i < 5; i++) {
    s.AddConstraint(vars[i], vars[(i + 1) % 5], 2)
  }
  let unres = 0
  for (let i = 0; i < 5; i++) {
    if (vars[i].ActualPos >= vars[(i + 1) % 5].ActualPos) unres++
  }
  expect(unres).toBe(1)
})
