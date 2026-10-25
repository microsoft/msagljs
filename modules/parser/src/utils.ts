import parseCSSColor from 'parse-color'
import {Color} from '@msagl/drawing'

export function parseColor(s: string): Color {
  // Older JSON exports include DOT quotes inside the attribute value.
  const value = s.replace(/^"|"$/g, '')
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(value)
  if (hex) {
    return new Color(
      parseInt(hex[2], 16),
      parseInt(hex[1].slice(0, 2), 16),
      parseInt(hex[1].slice(2, 4), 16),
      parseInt(hex[1].slice(4, 6), 16),
    )
  }
  const p = parseCSSColor(value)
  if (p.keyword != null && (p.rgba == null || p.rgba[3] === 1)) {
    const namedColor = Color.parse(p.keyword.toString())
    if (namedColor) return namedColor
  }
  if (p != null) {
    if (p.rgba != null) {
      return new Color(Math.round(p.rgba[3] * 255), p.rgba[0], p.rgba[1], p.rgba[2])
    }
    if (p.rgb != null) {
      return Color.mkRGB(p.rgb[0], p.rgb[1], p.rgb[2])
    }
  }
  return Color.Black
}
