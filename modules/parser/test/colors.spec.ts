import {parseColor} from '../src/utils'

test.each([
  ['red', [255, 0, 0, 255]],
  ['#123456', [18, 52, 86, 255]],
  ['#12345678', [18, 52, 86, 120]],
  ['#12345600', [18, 52, 86, 0]],
  ['"#12345678"', [18, 52, 86, 120]],
  ['rgba(255, 0, 0, 0.5)', [255, 0, 0, 128]],
  ['transparent', [255, 255, 255, 0]],
])('parses %s with byte-range RGBA components', (value, expected) => {
  const color = parseColor(value as string)
  expect([color.R, color.G, color.B, color.A]).toEqual(expected)
})

// DOT colorscheme values: a numeric index, scheme-relative and explicit indices, and an X11 scheme name.
test.each([1, '//11', '/ylgn7/5', '/X11/thistle'])('falls back to black for unsupported color %s', (value) => {
  const color = parseColor(value)
  expect([color.R, color.G, color.B, color.A]).toEqual([0, 0, 0, 255])
})
