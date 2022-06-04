import {Queue} from 'queue-typescript'

import {Edge} from './edge'
import {Node} from './node'
import {NodeCollection} from './nodeCollection'
/** This class keeps the connection between the nodes and the edges of the graph. Some nodes of a Graph can also be Graphs.  */
export class Graph extends Node {
  toJSON() {
    return null
    throw new Error('Method not implemented.')
  }
  *graphs(): IterableIterator<Graph> {
    for (const g of this.nodeCollection.graphs) {
      yield g
    }
  }

  noEmptySubgraphs(): boolean {
    for (const g of this.subgraphs()) {
      if (g.shallowNodeCount == 0) return false
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
    return this.shallowNodeCount == 0
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

  get shallowNodes(): IterableIterator<Node> {
    return this.nodeCollection.nodesShallow
  }
  get deepNodes(): IterableIterator<Node> {
    return this.nodeCollection.nodesDeep()
  }

  constructor(id = '__graph__') {
    super(id)
  }
  findNode(id: string): Node {
    return this.nodeCollection.find(id)
  }
  get edges() {
    return this.nodeCollection.edges
  }

  *deepEdges() {
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
    return this.nodeCollection.isConsistent()
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
    /*Assert.assert(n.parent == null || n.parent == this)*/
    n.parent = this
    this.nodeCollection.addNode(n)
    return n
  }
  /** adds an edge to the graph */
  addEdge(n: Edge) {
    this.nodeCollection.addEdge(n)
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
    while (n != null && n.parent != this) {
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
}
