import {Point, Rectangle} from '../../math/geometry'
import {GeomEdge, GeomGraph, GeomNode, Graph, Node} from '../..'
import {IGeomGraph} from './iGeomGraph'

export class GeomConnectedComponent implements IGeomGraph {
  RectangularBoundary: any
  topNodes: Node[]
  constructor(topNodes: Node[]) {
    this.topNodes = topNodes
  }
  calculateBoundsFromChildren(clusterMargin: number) {
    throw new Error('Method not implemented.')
  }
  deepNodes: IterableIterator<GeomNode>
  deepNodeCount: number
  get Clusters(): IterableIterator<IGeomGraph> {
    return this.clusters()
  }
  *clusters(): IterableIterator<IGeomGraph> {
    for (const n of this.topNodes) if (n instanceof Graph) yield GeomGraph.getGeom(n)
  }
  subgraphsDepthFirst: IterableIterator<IGeomGraph>
  uniformMargins: number;
  *edges(): IterableIterator<GeomEdge> {
    for (const n of this.topNodes) {
      for (const e of n.outEdges) yield GeomEdge.getGeom(e) as GeomEdge
      for (const e of n.selfEdges) yield GeomEdge.getGeom(e) as GeomEdge
    }
  }
  get shallowNodes(): IterableIterator<GeomNode> {
    return this.shallowNodes_()
  }
  *shallowNodes_(): IterableIterator<GeomNode> {
    for (const n of this.topNodes) yield GeomNode.getGeom(n) as GeomNode
  }
  pumpTheBoxToTheGraphWithMargins(): Rectangle {
    throw new Error('Method not implemented.')
  }
  shallowNodeCount: number
  translate(delta: Point) {
    throw new Error('Method not implemented.')
  }
  boundingBox: Rectangle
}
