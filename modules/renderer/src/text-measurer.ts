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

  measure(text: string): Size {
    const {fontSize, lineHeight} = this.opts
    const rowHeight = fontSize * 1.2
    const rowSpacing = fontSize * (lineHeight - 1)
    let w = 0
    const lines = text.split('\n')
    for (const line of text.split('\n')) {
      const metrics = this.ctx.measureText(line)
      w = Math.max(w, metrics.width)
    }

    return new Size(w, lines.length * rowHeight + (lines.length - 1) * rowSpacing)
  }
}
