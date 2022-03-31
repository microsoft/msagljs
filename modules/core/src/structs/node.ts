import {Entity} from './entity'
import {Edge} from './edge'
import {Graph} from './graph'
/** Represent a node of a graph: has id, which is a string, and sets of in/out/self edges */
export class Node extends Entity {
  private _id: string
  /** the unique, in the parent graph, id of the node */
  public get id(): string {
    return this._id
  }
  public set id(value: string) {
    /*Assert.assert(value != null)*/
    this._id = value
  }
  inEdges: Set<Edge> = new Set<Edge>()
  outEdges: Set<Edge> = new Set<Edge>()
  selfEdges: Set<Edge> = new Set<Edge>()

  toString(): string {
    return this.id
  }
  constructor(id: string) {
    super()
    //  Assert.assert(id != null && id.toString() === id)

    this.id = id
  }

  private *_edges(): IterableIterator<Edge> {
    for (const e of this.inEdges) yield e
    for (const e of this.outEdges) yield e
    for (const e of this.selfEdges) yield e
  }

  private addInEdge(edge: Edge): void {
    /*Assert.assert(edge.target == this)*/
    this.inEdges.add(edge)
  }

  private addOutEdge(edge: Edge): void {
    /*Assert.assert(edge.source == this)*/
    this.outEdges.add(edge)
  }

  private addSelfEdge(edge: Edge): void {
    /*Assert.assert(edge.source == edge.target && edge.source == this)*/
    this.selfEdges.add(edge)
  }

  addEdde(e: Edge): Edge {
    if (this == e.source) {
      if (e.target == this) this.addSelfEdge(e)
      else this.addOutEdge(e)
    } else if (this == e.target) {
      this.addInEdge(e)
    } else {
      throw new Error('attaching an edge to non adjacent node')
      // Assert.assert(false, 'attaching an edge to non adjacent node')
    }
    return e
  }

  get edges(): IterableIterator<Edge> {
    return this._edges()
  }

  get outDegree(): number {
    return this.outEdges.size
  }
  get inDegree(): number {
    return this.inEdges.size
  }
  get selfDegree(): number {
    return this.selfEdges.size
  }

  get degree(): number {
    return this.outDegree + this.inDegree + this.selfDegree
  }

  *getAncestors(): IterableIterator<Graph> {
    let g: Graph = this.parent as unknown as Graph
    while (g != null) {
      yield g
      g = g.parent as unknown as Graph
    }
  }
  isUnderCollapsedGraph(): boolean {
    return this.parent != null && (this.parent as unknown as Graph).isCollapsed
  }
}
