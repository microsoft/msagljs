import {Graph} from './graph'

/** Entity is an attribute container with a parent*/
export abstract class Entity {
  private attrs: any[] = []

  clearAttr() {
    this.attrs = []
  }
  setAttr(position: number, val: any) {
    this.attrs[position] = val
  }
  getAttr(position: number): any {
    return this.attrs[position]
  }

  private _parent: Entity = null
  public get parent(): Entity {
    return this._parent
  }
  public set parent(value: Entity) {
    this._parent = value
  }

  abstract toString(): string

  *getAncestors(): IterableIterator<Entity> {
    let p = this.parent
    while (p != null) {
      yield p
      p = p.parent
    }
  }

  // Determines if this node is a descendant of the given graph.
  isDescendantOf(graph: Graph): boolean {
    for (const p of this.getAncestors()) {
      if (p == graph) return true
    }
    return false
  }
}
