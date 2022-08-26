import {Queue} from 'queue-typescript'
// import {Assert} from '../utils/assert'

import {Edge} from './edge'
import {Node} from './node'
import {NodeCollection} from './nodeCollection'

/** This class keeps the connection between the nodes and the edges of the graph. Some nodes of a Graph can also be Graphs.  */
export class Graph extends Node {
  /**  Iterates over all connected components of the graph and for each component
   * returns all its nodes with "this" as the parent
   */

  *getClusteredConnectedComponents(): IterableIterator<Array<Node>> {
    const processed = new Set<Node>()
    const q = new Queue<Node>()
    for (const v of this.deepNodes) {
      if (processed.has(v)) continue
      processed.add(v)
      q.enqueue(v)
      const component = new Set<Node>()
      do {
        const u = q.dequeue()
        if (u.parent === this) {
          component.add(u)
        }
        for (const w of this.reachableFrom(u)) {
          if (!processed.has(w)) {
            processed.add(w)
            q.enqueue(w)
          }
        }
      } while (q.length > 0)
      yield Array.from(component)
    }
  }
  private *reachableFrom(u: Node): IterableIterator<Node> {
    for (const e of u.outEdges) {
      yield e.target
    }
    for (const e of u.inEdges) {
      yield e.source
    }
    if (u instanceof Graph) {
      yield* u.shallowNodes
    }
    if (u.parent != this) {
      yield u.parent as Node
    }
  }
  hasSomeAttrOnIndex(index: number): boolean {
    for (const n of this.deepNodes) {
      if (n.getAttr(index)) return true
    }
    for (const n of this.deepEdges) {
      if (n.getAttr(index)) return true
    }
    return false
  }
  *graphs(): IterableIterator<Graph> {
    for (const g of this.nodeCollection.graphs) {
      yield g
    }
  }

  noEmptySubgraphs(): boolean {
    for (const g of this.subgraphs()) {
      if (g.shallowNodeCount === 0) return false
    }
    return true
  }

  hasSubgraphs(): boolean {
    for (const n of this.shallowNodes) if (n instanceof Graph) return true
    return false
  }

  *subgraphs(): IterableIterator<Graph> {
    for (const n of this.deepNodes) {
      if (n instanceof Graph) yield <Graph>n
    }
  }

  isEmpty() {
    return this.shallowNodeCount === 0
  }

  setEdge(sourceId: string, targetId: string): Edge {
    const s = this.nodeCollection.find(sourceId)
    if (s == null) return
    const t = this.nodeCollection.find(targetId)
    if (t == null) return
    const e = new Edge(s, t)
    this.addEdge(e)
    return e
  }

  /** iterates over the node of the current graph but not entering the subgraphs */
  get shallowNodes(): IterableIterator<Node> {
    return this.nodeCollection.nodesShallow
  }
  /** iterates over all the nodes of including the subgraphs */
  get deepNodes(): IterableIterator<Node> {
    return this.nodeCollection.nodesDeep()
  }

  constructor(id = '__graph__') {
    super(id)
  }
  /**
   * Finds the node with the givin id belonging to a graph or one of its subgraphs.
   */
  findNodeRecursive(id: string): Node {
    const n = this.nodeCollection.find(id)
    if (n) {
      return n
    }
    for (const g of this.shallowNodes) {
      if (g instanceof Graph) {
        const nn = g.findNodeRecursive(id)
        if (nn) return nn
      }
    }
    return null
  }
  /** Returns a node belonging to this graph having the same id.
   * If a node with the given id belongs to a subgraph than it would no be returned.
   * To find such a deeper nested node use findNodeRecursive
   */
  findNode(id: string): Node {
    return this.nodeCollection.find(id)
  }
  /** iterates over the edges of the graph which adjacent to the nodes of the graph:
   * not iterating over the subgraphs
   */
  get edges() {
    return this.nodeCollection.edges
  }

  /** iterates over the edges of the graph including subgraphs */
  get deepEdges(): IterableIterator<Edge> {
    return this.deepEdgesIt()
  }

  private *deepEdgesIt() {
    for (const node of this.deepNodes) {
      for (const e of node.outEdges) {
        yield e
      }
      for (const e of node.selfEdges) {
        yield e
      }
    }
  }

  isConsistent(): boolean {
    if (this.parent) return (this.parent as Graph).isConsistent()

    return this.eachNodeIdIsUnique() && this.nodeCollection.isConsistent()
  }
  nodeIsConsistent(n: Node): boolean {
    return this.nodeCollection.nodeIsConsistent(n)
  }
  /** detouches all the node's edges and removes the node from the graph */
  removeNode(n: Node): void {
    this.nodeCollection.removeNode(n)
  }

  /** adds a node to the graph */
  addNode(n: Node): Node {
    /*Assert.assert(n.parent == null  || n.parent === this)*/
    n.parent = this
    this.nodeCollection.addNode(n)
    // Assert.assert(this.isConsistent())
    return n
  }
  /** adds an edge to the graph */
  addEdge(n: Edge) {
    this.nodeCollection.addEdge(n)
    // Assert.assert(this.isConsistent())
  }
  nodeCollection: NodeCollection = new NodeCollection()
  get shallowNodeCount() {
    return this.nodeCollection.nodeShallowCount
  }

  get nodeCountDeep() {
    return this.nodeCollection.nodeDeepCount
  }

  get edgeCount() {
    return this.nodeCollection.edgeCount
  }

  // If n has the graph as the parent then return n,
  // otherwise set n = n.parent and repeat.
  // Return null if the node parent is above the graph.
  liftNode(n: Node): Node {
    while (n != null && n.parent !== this) {
      n = <Node>n.parent
    }
    return n
  }
  /** return the number of all nodes in the graph, including the subgraphs */
  deepEdgesCount(): number {
    let count = 0
    for (const p of this.deepNodes) {
      count += p.outDegree + p.selfDegree
    }
    return count
  }
  eachNodeIdIsUnique(): boolean {
    const ids = new Set<string>()
    for (const n of this.deepNodes) {
      if (ids.has(n.id)) {
        return false
      }
      ids.add(n.id)
    }
    return true
  }
  *allSuccessorsWidthFirst(): IterableIterator<Node> {
    for (const n of this.shallowNodes) {
      yield n
    }
    for (const n of this.shallowNodes) {
      if (n instanceof Graph) {
        yield* n.allSuccessorsWidthFirst()
      }
    }
  }
}

export function* shallowConnectedComponents(graph: Graph): IterableIterator<Node[]> {
  const enqueueed = new Set<Node>()
  const queue = new Queue<Node>()
  for (const n of graph.shallowNodes) {
    if (enqueueed.has(n)) continue
    const nodes = new Array<Node>()
    enqueue(n, queue, enqueueed)
    while (queue.length > 0) {
      const s = queue.dequeue()
      nodes.push(s)
      for (const neighbor of neighbors(s)) {
        enqueue(neighbor, queue, enqueueed)
      }
    }
    yield nodes
  }
  function* neighbors(n: Node): IterableIterator<Node> {
    for (const e of n.outEdges) yield e.target
    for (const e of n.inEdges) yield e.source
  }
  function enqueue(n: Node, queue: Queue<Node>, enqueueed: Set<Node>) {
    if (!enqueueed.has(n)) {
      queue.enqueue(n)
      enqueueed.add(n)
    }
  }
}
/** sets a new Graph as the parent of the node */
export function setNewParent(newParent: Graph, node: Node) {
  if (node.parent) {
    const oldParent = node.parent as Graph
    oldParent.nodeCollection.nodeMap.delete(node.id)
  }
  newParent.nodeCollection.nodeMap.set(node.id, node)
  node.parent = newParent
  // let p = newParent
  // while (p.parent) p = p.parent as Graph
  // Assert.assert(p.isConsistent())
}
