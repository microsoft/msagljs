import {GeomConstants} from '../../../src/math/geometry'

test('round', () => {
  let rp = GeomConstants.RoundDouble(1.2222225)
  expect(rp).toBe(1.222223)
  expect(GeomConstants.RoundDouble(1.2222224)).toBe(1.222222)
  rp = GeomConstants.RoundDouble(1.2222226)
  expect(rp).toBe(1.222223)
  expect(GeomConstants.RoundDouble(1.9999996)).toBe(2)
  expect(GeomConstants.RoundDouble(1.3333334)).toBe(1.333333)
  expect(GeomConstants.RoundDouble(1.0000011)).toBe(1.000001)
  expect(GeomConstants.RoundDouble(1.0000019)).toBe(1.000002)
})
