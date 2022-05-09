export class Color {
  static parse(keyword: string): Color | undefined {
    switch (keyword.toLowerCase()) {
      case 'aliceblue':
        return Color.AliceBlue
      case 'antiquewhite':
        return Color.AntiqueWhite
      case 'aqua':
        Color.Aqua
      case 'aquamarine':
        Color.Aquamarine
      case 'azure':
        return Color.Azure
      case 'beige':
        return Color.Beige
      case 'bisque':
        return Color.Bisque
      case 'black':
        return Color.Black
      case 'blanchedalmond':
        return Color.BlanchedAlmond
      case 'blue':
        return Color.Blue
      case 'blueviolet':
        return Color.BlueViolet
      case 'brown':
        return Color.Brown
      case 'burlywood':
        return Color.BurlyWood
      case 'cadetblue':
        return Color.CadetBlue
      case 'chartreuse':
        return Color.Chartreuse
      case 'chocolate':
        return Color.Chocolate
      case 'coral':
        return Color.Coral
      case 'cornflowerblue':
        return Color.CornflowerBlue
      case 'cornsilk':
        return Color.Cornsilk
      case 'crimson':
        return Color.Crimson
      case 'cyan':
        return Color.Cyan
      case 'darkblue':
        return Color.DarkBlue
      case 'darkcyan':
        return Color.DarkCyan
      case 'darkgoldenrod':
        return Color.DarkGoldenrod
      case 'darkgray':
        return Color.DarkGray
      case 'darkgreen':
        return Color.DarkGreen
      case 'darkkhaki':
        return Color.DarkKhaki
      case 'darkmagenta':
        return Color.DarkMagenta
      case 'darkolivegreen':
        return Color.DarkOliveGreen
      case 'darkorange':
        return Color.DarkOrange
      case 'darkorchid':
        return Color.DarkOrchid
      case 'darkred':
        return Color.DarkRed
      case 'darksalmon':
        return Color.DarkSalmon
      case 'darkseagreen':
        return Color.DarkSeaGreen
      case 'darkslateblue':
        return Color.DarkSlateBlue
      case 'darkslategray':
        return Color.DarkSlateGray
      case 'darkturquoise':
        return Color.DarkTurquoise
      case 'darkviolet':
        return Color.DarkViolet
      case 'deeppink':
        return Color.DeepPink
      case 'deepskyblue':
        return Color.DeepSkyBlue
      case 'dimgray':
        return Color.DimGray
      case 'dodgerblue':
        return Color.DodgerBlue
      case 'firebrick':
        return Color.Firebrick
      case 'floralwhite':
        return Color.FloralWhite
      case 'forestgreen':
        return Color.ForestGreen
      case 'fuchsia':
        return Color.Fuchsia
      case 'gainsboro':
        return Color.Gainsboro
      case 'ghostwhite':
        return Color.GhostWhite
      case 'gold':
        return Color.Gold
      case 'goldenrod':
        return Color.Goldenrod
      case 'gray':
        return Color.Gray
      case 'green':
        return Color.Green
      case 'greenyellow':
        return Color.GreenYellow
      case 'honeydew':
        return Color.Honeydew
      case 'hotpink':
        return Color.HotPink
      case 'indianred':
        return Color.IndianRed
      case 'indigo':
        return Color.Indigo
      case 'ivory':
        return Color.Ivory
      case 'khaki':
        return Color.Khaki
      case 'lavender':
        return Color.Lavender
      case 'lavenderblush':
        return Color.LavenderBlush
      case 'lawngreen':
        return Color.LawnGreen
      case 'lemonchiffon':
        return Color.LemonChiffon
      case 'lightblue':
        return Color.LightBlue
      case 'lightcoral':
        return Color.LightCoral
      case 'lightcyan':
        return Color.LightCyan
      case 'lightgoldenrodyellow':
        return Color.LightGoldenrodYellow
      case 'lightgray':
        return Color.LightGray
      case 'lightgreen':
        return Color.LightGreen
      case 'lightpink':
        return Color.LightPink
      case 'lightsalmon':
        return Color.LightSalmon
      case 'lightseagreen':
        return Color.LightSeaGreen
      case 'lightskyblue':
        return Color.LightSkyBlue
      case 'lightslategray':
        return Color.LightSlateGray
      case 'lightsteelblue':
        return Color.LightSteelBlue
      case 'lightyellow':
        return Color.LightYellow
      case 'lime':
        return Color.Lime
      case 'limegreen':
        return Color.LimeGreen
      case 'linen':
        return Color.Linen
      case 'magenta':
        return Color.Magenta
      case 'maroon':
        return Color.Maroon
      case 'mediumaquamarine':
        return Color.MediumAquamarine
      case 'mediumblue':
        return Color.MediumBlue
      case 'mediumorchid':
        return Color.MediumOrchid
      case 'mediumpurple':
        return Color.MediumPurple
      case 'mediumseagreen':
        return Color.MediumSeaGreen
      case 'mediumslateblue':
        return Color.MediumSlateBlue
      case 'mediumspringgreen':
        return Color.MediumSpringGreen
      case 'mediumturquoise':
        return Color.MediumTurquoise
      case 'mediumvioletred':
        return Color.MediumVioletRed
      case 'midnightblue':
        return Color.MidnightBlue
      case 'mintcream':
        return Color.MintCream
      case 'mistyrose':
        return Color.MistyRose
      case 'moccasin':
        return Color.Moccasin
      case 'navajowhite':
        return Color.NavajoWhite
      case 'navy':
        return Color.Navy
      case 'oldlace':
        return Color.OldLace
      case 'olive':
        return Color.Olive
      case 'olivedrab':
        return Color.OliveDrab
      case 'orange':
        return Color.Orange
      case 'orangered':
        return Color.OrangeRed
      case 'orchid':
        return Color.Orchid
      case 'palegoldenrod':
        return Color.PaleGoldenrod
      case 'palegreen':
        return Color.PaleGreen
      case 'paleturquoise':
        return Color.PaleTurquoise
      case 'palevioletred':
        return Color.PaleVioletRed
      case 'papayawhip':
        return Color.PapayaWhip
      case 'peachpuff':
        return Color.PeachPuff
      case 'peru':
        return Color.Peru
      case 'pink':
        return Color.Pink
      case 'plum':
        return Color.Plum
      case 'powderblue':
        return Color.PowderBlue
      case 'purple':
        return Color.Purple
      case 'red':
        return Color.Red
      case 'rosybrown':
        return Color.RosyBrown
      case 'royalblue':
        return Color.RoyalBlue
      case 'saddlebrown':
        return Color.SaddleBrown
      case 'salmon':
        return Color.Salmon
      case 'sandybrown':
        return Color.SandyBrown
      case 'seagreen':
        return Color.SeaGreen
      case 'seashell':
        return Color.SeaShell
      case 'sienna':
        return Color.Sienna
      case 'silver':
        return Color.Silver
      case 'skyblue':
        return Color.SkyBlue
      case 'slateblue':
        return Color.SlateBlue
      case 'slategray':
        return Color.SlateGray
      case 'snow':
        return Color.Snow
      case 'springgreen':
        return Color.SpringGreen
      case 'steelblue':
        return Color.SteelBlue
      case 'tan':
        return Color.Tan
      case 'teal':
        return Color.Teal
      case 'thistle':
        return Color.Thistle
      case 'tomato':
        return Color.Tomato
      case 'transparent':
        return Color.Transparent
      case 'turquoise':
        return Color.Turquoise
      case 'violet':
        return Color.Violet
      case 'wheat':
        return Color.Wheat
      case 'white':
        return Color.White
      case 'whitesmoke':
        return Color.WhiteSmoke
      case 'yellow':
        return Color.Yellow
      case 'yellowgreen':
        return Color.YellowGreen
      default:
        return undefined
    }
  }
  private a: number

  //  constructor with alpha and red, green, bluee components
  constructor(a: number, r: number, g: number, b: number) {
    this.a = a
    this.r = r
    this.g = g
    this.b = b
  }

  //  opaque color

  static mkRGB(r: number, g: number, b: number): Color {
    return new Color(255, r, g, b)
  }

  //  alpha - transparency

  get A(): number {
    return this.a
  }

  set A(value: number) {
    this.a = value
  }

  r: number

  //  red

  get R(): number {
    return this.r
  }

  set R(value: number) {
    this.r = value
  }

  g: number

  //  green

  get G(): number {
    return this.g
  }

  set G(value: number) {
    this.g = value
  }

  b: number

  //  blue

  get B(): number {
    return this.b
  }

  set B(value: number) {
    this.b = value
  }

  static Xex(i: number): string {
    const s = i.toString(16)
    if (s.length == 1) {
      return '0' + s
    }

    return s.substring(s.length - 2, 2)
  }

  static equal(a: Color, b: Color): boolean {
    return a.a == b.a && a.r == b.r && a.b == b.b && a.g == b.g
  }

  //  !=

  toString(): string {
    return '"#' + Color.Xex(this.R) + Color.Xex(this.G) + Color.Xex(this.B) + (this.A == 255 ? '' : Color.Xex(this.A)) + '"'
  }

  //

  static get AliceBlue(): Color {
    return new Color(255, 240, 248, 255)
  }

  //

  static get AntiqueWhite(): Color {
    return new Color(255, 250, 235, 215)
  }

  //

  static get Aqua(): Color {
    return new Color(255, 0, 255, 255)
  }

  //

  static get Aquamarine(): Color {
    return new Color(255, 127, 255, 212)
  }

  //

  static get Azure(): Color {
    return new Color(255, 240, 255, 255)
  }

  //

  static get Beige(): Color {
    return new Color(255, 245, 245, 220)
  }

  //

  static get Bisque(): Color {
    return new Color(255, 255, 228, 196)
  }

  //

  static get Black(): Color {
    return new Color(255, 0, 0, 0)
  }

  //

  static get BlanchedAlmond(): Color {
    return new Color(255, 255, 235, 205)
  }

  //

  static get Blue(): Color {
    return new Color(255, 0, 0, 255)
  }

  //

  static get BlueViolet(): Color {
    return new Color(255, 138, 43, 226)
  }

  //

  static get Brown(): Color {
    return new Color(255, 165, 42, 42)
  }

  //

  static get BurlyWood(): Color {
    return new Color(255, 222, 184, 135)
  }

  //

  static get CadetBlue(): Color {
    return new Color(255, 95, 158, 160)
  }

  //

  static get Chartreuse(): Color {
    return new Color(255, 127, 255, 0)
  }

  //

  static get Chocolate(): Color {
    return new Color(255, 210, 105, 30)
  }

  //

  static get Coral(): Color {
    return new Color(255, 255, 127, 80)
  }

  //

  static get CornflowerBlue(): Color {
    return new Color(255, 100, 149, 237)
  }

  //

  static get Cornsilk(): Color {
    return new Color(255, 255, 248, 220)
  }

  //

  static get Crimson(): Color {
    return new Color(255, 220, 20, 60)
  }

  //

  static get Cyan(): Color {
    return new Color(255, 0, 255, 255)
  }

  //

  static get DarkBlue(): Color {
    return new Color(255, 0, 0, 139)
  }

  //

  static get DarkCyan(): Color {
    return new Color(255, 0, 139, 139)
  }

  //

  static get DarkGoldenrod(): Color {
    return new Color(255, 184, 134, 11)
  }

  //

  static get DarkGray(): Color {
    return new Color(255, 169, 169, 169)
  }

  //

  static get DarkGreen(): Color {
    return new Color(255, 0, 100, 0)
  }

  //

  static get DarkKhaki(): Color {
    return new Color(255, 189, 183, 107)
  }

  //

  static get DarkMagenta(): Color {
    return new Color(255, 139, 0, 139)
  }

  //

  static get DarkOliveGreen(): Color {
    return new Color(255, 85, 107, 47)
  }

  //

  static get DarkOrange(): Color {
    return new Color(255, 255, 140, 0)
  }

  //

  static get DarkOrchid(): Color {
    return new Color(255, 153, 50, 204)
  }

  //

  static get DarkRed(): Color {
    return new Color(255, 139, 0, 0)
  }

  //

  static get DarkSalmon(): Color {
    return new Color(255, 233, 150, 122)
  }

  //

  static get DarkSeaGreen(): Color {
    return new Color(255, 143, 188, 139)
  }

  //

  static get DarkSlateBlue(): Color {
    return new Color(255, 72, 61, 139)
  }

  //

  static get DarkSlateGray(): Color {
    return new Color(255, 47, 79, 79)
  }

  //

  static get DarkTurquoise(): Color {
    return new Color(255, 0, 206, 209)
  }

  //

  static get DarkViolet(): Color {
    return new Color(255, 148, 0, 211)
  }

  //

  static get DeepPink(): Color {
    return new Color(255, 255, 20, 147)
  }

  //

  static get DeepSkyBlue(): Color {
    return new Color(255, 0, 191, 255)
  }

  //

  static get DimGray(): Color {
    return new Color(255, 105, 105, 105)
  }

  //

  static get DodgerBlue(): Color {
    return new Color(255, 30, 144, 255)
  }

  //

  static get Firebrick(): Color {
    return new Color(255, 178, 34, 34)
  }

  //

  static get FloralWhite(): Color {
    return new Color(255, 255, 250, 240)
  }

  //

  static get ForestGreen(): Color {
    return new Color(255, 34, 139, 34)
  }

  //

  static get Fuchsia(): Color {
    return new Color(255, 255, 0, 255)
  }

  //

  static get Gainsboro(): Color {
    return new Color(255, 220, 220, 220)
  }

  //

  static get GhostWhite(): Color {
    return new Color(255, 248, 248, 255)
  }

  //

  static get Gold(): Color {
    return new Color(255, 255, 215, 0)
  }

  //

  static get Goldenrod(): Color {
    return new Color(255, 218, 165, 32)
  }

  //

  static get Gray(): Color {
    return new Color(255, 128, 128, 128)
  }

  //

  static get Green(): Color {
    return new Color(255, 0, 128, 0)
  }

  //

  static get GreenYellow(): Color {
    return new Color(255, 173, 255, 47)
  }

  //

  static get Honeydew(): Color {
    return new Color(255, 240, 255, 240)
  }

  //

  static get HotPink(): Color {
    return new Color(255, 255, 105, 180)
  }

  //

  static get IndianRed(): Color {
    return new Color(255, 205, 92, 92)
  }

  //

  static get Indigo(): Color {
    return new Color(255, 75, 0, 130)
  }

  //

  static get Ivory(): Color {
    return new Color(255, 255, 255, 240)
  }

  //

  static get Khaki(): Color {
    return new Color(255, 240, 230, 140)
  }

  //

  static get Lavender(): Color {
    return new Color(255, 230, 230, 250)
  }

  //

  static get LavenderBlush(): Color {
    return new Color(255, 255, 240, 245)
  }

  //

  static get LawnGreen(): Color {
    return new Color(255, 124, 252, 0)
  }

  //

  static get LemonChiffon(): Color {
    return new Color(255, 255, 250, 205)
  }

  //

  static get LightBlue(): Color {
    return new Color(255, 173, 216, 230)
  }

  //

  static get LightCoral(): Color {
    return new Color(255, 240, 128, 128)
  }

  //

  static get LightCyan(): Color {
    return new Color(255, 224, 255, 255)
  }

  //

  static get LightGoldenrodYellow(): Color {
    return new Color(255, 250, 250, 210)
  }

  //

  static get LightGray(): Color {
    return new Color(255, 211, 211, 211)
  }

  //

  static get LightGreen(): Color {
    return new Color(255, 144, 238, 144)
  }

  //

  static get LightPink(): Color {
    return new Color(255, 255, 182, 193)
  }

  //

  static get LightSalmon(): Color {
    return new Color(255, 255, 160, 122)
  }

  //

  static get LightSeaGreen(): Color {
    return new Color(255, 32, 178, 170)
  }

  //

  static get LightSkyBlue(): Color {
    return new Color(255, 135, 206, 250)
  }

  //

  static get LightSlateGray(): Color {
    return new Color(255, 119, 136, 153)
  }

  //

  static get LightSteelBlue(): Color {
    return new Color(255, 176, 196, 222)
  }

  //

  static get LightYellow(): Color {
    return new Color(255, 255, 255, 224)
  }

  //

  static get Lime(): Color {
    return new Color(255, 0, 255, 0)
  }

  //

  static get LimeGreen(): Color {
    return new Color(255, 50, 205, 50)
  }

  //

  static get Linen(): Color {
    return new Color(255, 250, 240, 230)
  }

  //

  static get Magenta(): Color {
    return new Color(255, 255, 0, 255)
  }

  //

  static get Maroon(): Color {
    return new Color(255, 128, 0, 0)
  }

  //

  static get MediumAquamarine(): Color {
    return new Color(255, 102, 205, 170)
  }

  //

  static get MediumBlue(): Color {
    return new Color(255, 0, 0, 205)
  }

  //

  static get MediumOrchid(): Color {
    return new Color(255, 186, 85, 211)
  }

  //

  static get MediumPurple(): Color {
    return new Color(255, 147, 112, 219)
  }

  //

  static get MediumSeaGreen(): Color {
    return new Color(255, 60, 179, 113)
  }

  //

  static get MediumSlateBlue(): Color {
    return new Color(255, 123, 104, 238)
  }

  //

  static get MediumSpringGreen(): Color {
    return new Color(255, 0, 250, 154)
  }

  //

  static get MediumTurquoise(): Color {
    return new Color(255, 72, 209, 204)
  }

  //

  static get MediumVioletRed(): Color {
    return new Color(255, 199, 21, 133)
  }

  //

  static get MidnightBlue(): Color {
    return new Color(255, 25, 25, 112)
  }

  //

  static get MintCream(): Color {
    return new Color(255, 245, 255, 250)
  }

  //

  static get MistyRose(): Color {
    return new Color(255, 255, 228, 225)
  }

  //

  static get Moccasin(): Color {
    return new Color(255, 255, 228, 181)
  }

  //

  static get NavajoWhite(): Color {
    return new Color(255, 255, 222, 173)
  }

  //

  static get Navy(): Color {
    return new Color(255, 0, 0, 128)
  }

  //

  static get OldLace(): Color {
    return new Color(255, 253, 245, 230)
  }

  //

  static get Olive(): Color {
    return new Color(255, 128, 128, 0)
  }

  //

  static get OliveDrab(): Color {
    return new Color(255, 107, 142, 35)
  }

  //

  static get Orange(): Color {
    return new Color(255, 255, 165, 0)
  }

  //

  static get OrangeRed(): Color {
    return new Color(255, 255, 69, 0)
  }

  //

  static get Orchid(): Color {
    return new Color(255, 218, 112, 214)
  }

  //

  static get PaleGoldenrod(): Color {
    return new Color(255, 238, 232, 170)
  }

  //

  static get PaleGreen(): Color {
    return new Color(255, 152, 251, 152)
  }

  //

  static get PaleTurquoise(): Color {
    return new Color(255, 175, 238, 238)
  }

  //

  static get PaleVioletRed(): Color {
    return new Color(255, 219, 112, 147)
  }

  //

  static get PapayaWhip(): Color {
    return new Color(255, 255, 239, 213)
  }

  //

  static get PeachPuff(): Color {
    return new Color(255, 255, 218, 185)
  }

  //

  static get Peru(): Color {
    return new Color(255, 205, 133, 63)
  }

  //

  static get Pink(): Color {
    return new Color(255, 255, 192, 203)
  }

  //

  static get Plum(): Color {
    return new Color(255, 221, 160, 221)
  }

  //

  static get PowderBlue(): Color {
    return new Color(255, 176, 224, 230)
  }

  //

  static get Purple(): Color {
    return new Color(255, 128, 0, 128)
  }

  //

  static get Red(): Color {
    return new Color(255, 255, 0, 0)
  }

  //

  static get RosyBrown(): Color {
    return new Color(255, 188, 143, 143)
  }

  //

  static get RoyalBlue(): Color {
    return new Color(255, 65, 105, 225)
  }

  //

  static get SaddleBrown(): Color {
    return new Color(255, 139, 69, 19)
  }

  //

  static get Salmon(): Color {
    return new Color(255, 250, 128, 114)
  }

  //

  static get SandyBrown(): Color {
    return new Color(255, 244, 164, 96)
  }

  //

  static get SeaGreen(): Color {
    return new Color(255, 46, 139, 87)
  }

  //

  static get SeaShell(): Color {
    return new Color(255, 255, 245, 238)
  }

  //

  static get Sienna(): Color {
    return new Color(255, 160, 82, 45)
  }

  //

  static get Silver(): Color {
    return new Color(255, 192, 192, 192)
  }

  //

  static get SkyBlue(): Color {
    return new Color(255, 135, 206, 235)
  }

  //

  static get SlateBlue(): Color {
    return new Color(255, 106, 90, 205)
  }

  //

  static get SlateGray(): Color {
    return new Color(255, 112, 128, 144)
  }

  //

  static get Snow(): Color {
    return new Color(255, 255, 250, 250)
  }

  //

  static get SpringGreen(): Color {
    return new Color(255, 0, 255, 127)
  }

  //

  static get SteelBlue(): Color {
    return new Color(255, 70, 130, 180)
  }

  //

  static get Tan(): Color {
    return new Color(255, 210, 180, 140)
  }

  //

  static get Teal(): Color {
    return new Color(255, 0, 128, 128)
  }

  //

  static get Thistle(): Color {
    return new Color(255, 216, 191, 216)
  }

  //

  static get Tomato(): Color {
    return new Color(255, 255, 99, 71)
  }

  //

  static get Transparent(): Color {
    return new Color(0, 255, 255, 255)
  }

  //

  static get Turquoise(): Color {
    return new Color(255, 64, 224, 208)
  }

  //

  static get Violet(): Color {
    return new Color(255, 238, 130, 238)
  }

  //

  static get Wheat(): Color {
    return new Color(255, 245, 222, 179)
  }

  //

  static get White(): Color {
    return new Color(255, 255, 255, 255)
  }

  //

  static get WhiteSmoke(): Color {
    return new Color(255, 245, 245, 245)
  }

  //

  static get Yellow(): Color {
    return new Color(255, 255, 255, 0)
  }

  //

  static get YellowGreen(): Color {
    return new Color(255, 154, 205, 50)
  }
}
