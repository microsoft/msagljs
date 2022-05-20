import {Size} from '../'
import {Color} from './color'

export class DrawingLabel {
  measuredTextSize: Size
  text: string
  fontColor: Color
  constructor(text: string) {
    this.text = text
  }
}
