import {Edge} from './edge'
import {Entity} from './entity'

export class Label extends Entity {
  isRemoved(): boolean {
    if (this.parent == null) return true
    const edge = this.parent as Edge
    return edge.label !== this
  }
  /** parent is the entity having this label */
  toString(): string {
    return 'label of ' + (this.parent ? this.parent.toString() : 'null')
  }
  constructor(labelledParent: Entity) {
    super()
    this.parent = labelledParent
  }
}
