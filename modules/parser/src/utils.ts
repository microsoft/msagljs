import parseCSSColor from 'parse-color'
import {Color} from 'msagl-js/drawing'

export function parseColor(s: string, aMult = 255): Color {
  const p = parseCSSColor(s)
  if (p != null) {
    if (p.rgba != null) {
      return new Color(p.rgba[3] * aMult, p.rgba[0], p.rgba[1], p.rgba[2])
    }
    if (p.rgb != null) {
      return Color.mkRGB(p.rgb[0], p.rgb[1], p.rgb[2])
    }
  }
  if (p.keyword != null) {
    return Color.parse(p.keyword)
  }
  return Color.Black
}
