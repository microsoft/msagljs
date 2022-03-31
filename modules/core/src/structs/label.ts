import {Entity} from './entity'

export class Label extends Entity {
  text: string
  constructor(text: string) {
    super()
    this.text = text
  }
  toString() {
    return this.text
  }
}
