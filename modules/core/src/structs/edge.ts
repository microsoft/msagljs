import {Entity} from './entity'
import {Label} from './label'
import {Node} from './node'
export class Edge extends Entity {
  source: Node
  target: Node
  constructor(s: Node, t: Node) {
    super()
    this.source = s
    this.target = t
    if (s != t) {
      s.outEdges.add(this)
      t.inEdges.add(this)
    } else {
      s.selfEdges.add(this)
    }
  }
  add() {
    if (this.source != this.target) {
      this.source.outEdges.add(this)
      this.target.inEdges.add(this)
    } else {
      this.source.selfEdges.add(this)
    }
  }
  remove() {
    if (this.source != this.target) {
      this.source.outEdges.delete(this)
      this.target.inEdges.delete(this)
    } else {
      this.source.selfEdges.delete(this)
    }
  }
  toString(): string {
    return '(' + this.source.toString() + '->' + this.target.toString() + ')'
  }
  isInterGraphEdge(): boolean {
    return this.source.parent != this.target.parent
  }
  label: Label
}
