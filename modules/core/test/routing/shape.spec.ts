import {Shape} from '../../src/routing/shape'

test('parents', () => {
  const a = new Shape(null)
  const b = new Shape(null)
  a.AddParent(b)
  const c = Shape.mkShape()
  b.AddParent(c)
  const ancestors = [...a.Ancestors()]
  expect(ancestors.length).toBe(2)
  const children = [...c.Children]
  expect(children.length).toBe(1)
  const achildren = [...a.Children]
  expect(achildren.length).toBe(0)
})
