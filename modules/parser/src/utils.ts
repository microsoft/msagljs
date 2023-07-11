import parseCSSColor from 'parse-color'
import {Color} from '@msagl/drawing'

export function parseColor(s: string): Color {
  const p = parseCSSColor(s)
  if (p.keyword != null) {
    return Color.parse(p.keyword.toString())
  }
  if (p != null) {
    if (p.rgba != null) {
      return new Color(p.rgba[3], p.rgba[0], p.rgba[1], p.rgba[2])
    }
    if (p.rgb != null) {
      return Color.mkRGB(p.rgb[0], p.rgb[1], p.rgb[2])
    }
  }
  return Color.Black
}
