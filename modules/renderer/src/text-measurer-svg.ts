import {Size} from 'msagl-js'
import {TextMeasurerOptions} from 'msagl-js/drawing'

export default class TextMeasurerSvg {
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

  measure(text: string, opts: Partial<TextMeasurerOptions>): Size {
    this.setOptions(opts)
    const lineHeight = this.opts.lineHeight
    const rowSpacing = opts.fontSize * 0.2
    let w = 0
    let h = 0
    const lines = text.split('\n')
    for (const line of lines) {
      const metrics = this.ctx.measureText(line)
      w = Math.max(w, metrics.width)
      h += metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
    }
    return new Size(w, h * lineHeight + rowSpacing * (lines.length - 1))
  }
}
