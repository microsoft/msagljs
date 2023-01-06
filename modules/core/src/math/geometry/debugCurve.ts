import {ICurve} from './icurve'

export class DebugCurve {
  pen: number
  color: string
  fillColor: string
  transparency: number
  width: number
  icurve: ICurve
  dashArray: number[]
  label: any
  drawPN: boolean
  clone(): DebugCurve {
    const r = new DebugCurve()
    r.transparency = this.transparency
    r.width = this.width
    r.color = this.color
    r.icurve = this.icurve.clone()
    r.label = this.label
    r.dashArray = this.dashArray
    r.drawPN = this.drawPN
    return r
  }
  static mkDebugCurveTWCILD(
    transparency: number,
    width: number,
    color: string,
    curve: ICurve,
    label: any,
    dashArray: number[],
    drawPN = false,
  ) {
    const r = new DebugCurve()
    r.transparency = transparency
    r.width = width
    r.color = color
    r.icurve = curve
    r.label = label
    r.dashArray = dashArray
    r.drawPN = drawPN
    return r
  }

  static mkDebugCurveTWCI(transparency: number, width: number, color: string, curve: ICurve) {
    return DebugCurve.mkDebugCurveTWCILD(transparency, width, color, curve, null, null)
  }

  static mkDebugCurveWCI(width: number, color: string, curve: ICurve) {
    return DebugCurve.mkDebugCurveTWCI(255, width, color, curve)
  }

  static mkDebugCurveCI(color: string, curve: ICurve) {
    return DebugCurve.mkDebugCurveWCI(1, color, curve)
  }

  static mkDebugCurveI(curve: ICurve) {
    return DebugCurve.mkDebugCurveCI('Black', curve)
  }

  // color strings for debugging
  static readonly colors: string[] = [
    'DeepSkyBlue',
    'IndianRed',
    'Orange',
    'Gold',
    'DarkRed',
    'Plum',
    'Red',
    'Violet',
    'Indigo',
    'Yellow',
    'OrangeRed',
    'Tomato',
    'Purple',
    'SaddleBrown',
    'Green',
    'Navy',
    'Aqua',
    'Pink',
    'Bisque',
    'Black',
    'BlanchedAlmond',
    'Blue',
    'BlueViolet',
    'Brown',
    'Lime',
    'BurlyWood',
    'Chocolate',
    'Coral',
    'CornflowerBlue',
    'Cornsilk',
    'Crimson',
    'Cyan',
    'CadetBlue',
    'Chartreuse',
    'DarkBlue',
    'DarkCyan',
    'DarkGoldenrod',
    'DarkGray',
    'DarkGreen',
    'DarkKhaki',
    'DarkMagenta',
    'DarkOliveGreen',
    'DarkOrange',
    'DarkOrchid',
    'DarkSalmon',
    'DarkSeaGreen',
    'DarkSlateBlue',
    'DarkSlateGray',
    'DarkTurquoise',
    'DarkViolet',
    'DeepPink',
    'DimGray',
    'DodgerBlue',
    'Firebrick',
    'FloralWhite',
    'ForestGreen',
    'Fuchsia',
    'CodeAnalysis',
    'Gainsboro',
    'GhostWhite',
    'Goldenrod',
    'Gray',
    'GreenYellow',
    'Honeydew',
    'HotPink',
    'Ivory',
    'Lavender',
    'LavenderBlush',
    'LawnGreen',
    'LemonChiffon',
    'LightBlue',
    'LightCoral',
    'LightCyan',
    'LightGoldenrodYellow',
    'LightGray',
    'LightGreen',
    'LightPink',
    'LightSalmon',
    'LightSeaGreen',
    'LightSkyBlue',
    'LightSlateGray',
    'LightSteelBlue',
    'LightYellow',
    'LimeGreen',
    'Linen',
    'Magenta',
    'Maroon',
    'MediumAquamarine',
    'MediumBlue',
    'MediumOrchid',
    'MediumPurple',
    'MediumSeaGreen',
    'MediumSlateBlue',
    'MediumSpringGreen',
    'MediumTurquoise',
    'MediumVioletRed',
    'MidnightBlue',
    'MintCream',
    'MistyRose',
    'Moccasin',
    'NavajoWhite',
    'OldLace',
    'Olive',
    'OliveDrab',
    'Orchid',
    'PaleGoldenrod',
    'PaleGreen',
    'PaleTurquoise',
    'PaleVioletRed',
    'PapayaWhip',
    'PeachPuff',
    'Peru',
    'PowderBlue',
    'RosyBrown',
    'RoyalBlue',
    'Salmon',
    'SandyBrown',
    'SeaGreen',
    'CodeAnalysis',
    'SeaShell',
    'Sienna',
    'Silver',
    'SkyBlue',
    'SlateBlue',
    'SlateGray',
    'Snow',
    'SpringGreen',
    'SteelBlue',
    'Tan',
    'Teal',
    'Thistle',
    'Transparent',
    'Turquoise',
    'Aquamarine',
    'Azure',
    'Beige',
    'Wheat',
    'White',
    'WhiteSmoke',
    'YellowGreen',
    'Khaki',
    'AntiqueWhite',
  ]
}
