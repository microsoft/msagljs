import {Node} from './node'
import {Edge} from './edge'
import {Graph} from './graph'

export class NodeCollection {
  private *nodes_(): IterableIterator<Node> {
    for (const p of this.nodeMap.values()) yield p
  }

  private *graphs_(): IterableIterator<Graph> {
    for (const n of this.nodes_()) {
      if (n instanceof Graph) {
        yield n as Graph
      }
    }
  }

  find(id: string): Node {
    return this.nodeMap.get(id)
  }

  get nodesShallow(): IterableIterator<Node> {
    return this.nodes_()
  }

  *nodesDeep(): IterableIterator<Node> {
    for (const n of this.nodes_()) {
      yield n
      if (n instanceof Graph) {
        for (const nn of (<Graph>n).nodeCollection.nodesDeep()) {
          yield nn
        }
      }
    }
  }

  get graphs(): IterableIterator<Graph> {
    return this.graphs_()
  }

  nodeMap: Map<string, Node> = new Map<string, Node>()

  private *_edges() {
    // if we go over node.inEdges too then not self edges will be reported twice
    for (const node of this.nodeMap.values()) {
      for (const e of node.outEdges) {
        yield e
      }
      for (const e of node.selfEdges) {
        yield e
      }
    }
  }

  interGraphEdges(): IterableIterator<Edge> {
    throw new Error('not implemented')
  }
  /** this is a recursive search */
  hasNode(id: string) {
    if (this.nodeMap.has(id)) return true
    for (const p of this.nodeMap) {
      if (p[1] instanceof Graph && (p[1] as Graph).nodeCollection.hasNode(id)) return true
    }
    return false
  }

  getNode(id: string): Node {
    let r = this.nodeMap.get(id)
    if (r != undefined) return r
    for (const p of this.nodeMap) {
      if (p[1] instanceof Graph) {
        r = (p[1] as Graph).nodeCollection.getNode(id)
        if (r != undefined) {
          return r
        }
      }
    }
    return undefined
  }

  get nodeShallowCount(): number {
    return this.nodeMap.size
  }

  get nodeDeepCount(): number {
    let count = this.nodeMap.size
    for (const p of this.nodeMap.values()) {
      if (p instanceof Graph) {
        count += (<Graph>p).nodeCollection.nodeDeepCount
      }
    }
    return count
  }
  // caution: it is a linear by the number of nodes method
  get edgeCount(): number {
    let count = 0
    for (const p of this.nodeMap.values()) {
      count += p.outDegree + p.selfDegree
    }
    return count
  }

  // returns the edges of shallow nodes
  get edges(): IterableIterator<Edge> {
    return this._edges()
  }

  addNode(node: Node) {
    /*Assert.assert(node.id != null)*/
    if (this.getNode(node.id) == null) {
      this.nodeMap.set(node.id, node)
    }
  }

  addEdge(edge: Edge): void {
    this.addNode(edge.source)
    this.addNode(edge.target)
    if (edge.source != edge.target) {
      edge.source.outEdges.add(edge)
      edge.target.inEdges.add(edge)
    } else {
      edge.source.selfEdges.add(edge)
    }
  }
  removeNode(node: Node) {
    for (const e of node.outEdges) {
      e.target.inEdges.delete(e)
    }
    for (const e of node.inEdges) {
      e.source.outEdges.delete(e)
    }
    this.nodeMap.delete(node.id)
    for (const p of this.nodeMap.values()) {
      if (p instanceof Graph) {
        const t = p as Graph
        t.nodeCollection.nodeMap.delete(node.id)
      }
    }
  }

  nodeIsConsistent(n: Node): boolean {
    for (const e of n.outEdges) {
      if (e.source != n) {
        return false
      }
      if (e.source == e.target) {
        return false
      }
      if (!this.nodeMap.has(e.target.id)) {
        return false
      }
    }
    for (const e of n.inEdges) {
      if (e.target != n) {
        return false
      }

      if (e.source == e.target) {
        return false
      }
      if (!this.nodeMap.has(e.source.id)) {
        return false
      }
      return true
    }

    for (const e of n.selfEdges) {
      if (e.target != e.source) {
        return false
      }
      if (e.source == n) {
        return false
      }
    }

    return true
  }

  isConsistent(): boolean {
    for (const pair of this.nodeMap) {
      if (!this.nodeIsConsistent(pair[1])) {
        return false
      }
    }
    return true
  }
}
