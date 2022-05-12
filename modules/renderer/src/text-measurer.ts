import {Size} from 'msagl-js'

export type TextMeasurerOptions = {
  fontFamily: string
  fontSize: number
  lineHeight: number
  fontStyle: 'normal' | 'italic' | 'oblique'
  fontWeight: 'normal' | 'bold' | 'lighter' | 'bolder' | number
}

export default class TextMeasurer {
  opts: TextMeasurerOptions = {
    fontFamily: 'sans-serif',
    fontSize: 16,
    lineHeight: 1,
    fontStyle: 'normal',
    fontWeight: 'normal',
  }
  el: HTMLCanvasElement
  ctx: CanvasRenderingContext2D

  constructor(opts: Partial<TextMeasurerOptions> = {}) {
    this.el = document.createElement('canvas')
    this.ctx = this.el.getContext('2d')
    this.measure = this.measure.bind(this)

    this.setOptions(opts)
  }

  setOptions(opts: Partial<TextMeasurerOptions>): void {
    Object.assign(this.opts, opts)
    const {fontFamily, fontSize, fontStyle, fontWeight} = this.opts

    this.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
  }

  measure(text: string, fontSize: number, fontFamily: string, fontStyle: string): Size {
    let w = 0
    let h = 0
    const lines = text.split('\n')
    this.ctx.font = fontStyle + ' ' + fontSize.toString() + ' ' + fontFamily
    let lineH: number
    for (const line of lines) {
      const metrics = this.ctx.measureText(line)
      w = Math.max(w, metrics.width)
      lineH = metrics.actualBoundingBoxAscent
      h += 2 * lineH
    }
    h -= lineH
    return new Size(w, h)
  }
}
