import {Point, Rectangle} from '../../math/geometry'
import {GeomEdge, GeomGraph, GeomNode, Graph, Node} from '../..'
import {IGeomGraph} from './iGeomGraph'
import {pumpTheBoxToTheGraph} from '../core/geomGraph'

export class GeomConnectedComponent implements IGeomGraph {
  bbox: Rectangle
  RectangularBoundary: any
  topNodes: Node[]
  constructor(topNodes: Node[]) {
    this.topNodes = topNodes
  }
  calculateBoundsFromChildren(clusterMargin: number) {
    throw new Error('Method not implemented.')
  }
  get deepNodes(): IterableIterator<GeomNode> {
    return this.deepNodes_()
  }
  *deepNodes_(): IterableIterator<GeomNode> {
    for (const n of this.topNodes) {
      yield GeomNode.getGeom(n) as GeomNode
      if (n instanceof Graph) {
        for (const nn of n.deepNodes) {
          yield GeomNode.getGeom(nn) as GeomNode
        }
      }
    }
  }

  deepNodeCount: number
  get Clusters(): IterableIterator<IGeomGraph> {
    return this.clusters()
  }
  *clusters(): IterableIterator<IGeomGraph> {
    for (const n of this.topNodes) if (n instanceof Graph) yield GeomGraph.getGeom(n)
  }
  get subgraphsDepthFirst(): IterableIterator<IGeomGraph> {
    return this.subgraphsDepthFirst_()
  }
  *subgraphsDepthFirst_(): IterableIterator<IGeomGraph> {
    for (const n of this.topNodes) {
      if (n instanceof Graph) {
        const gn = GeomGraph.getGeom(n)
        yield* gn.subgraphsDepthFirst
        yield gn
      }
    }
  }
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
    const t = {b: Rectangle.mkEmpty()}
    pumpTheBoxToTheGraph(this, t)
    return t.b
  }
  get shallowNodeCount(): number {
    return this.topNodes.length
  }

  translate(delta: Point) {
    if (this.bbox) this.bbox.center = this.bbox.center.add(delta)

    for (const n of this.topNodes) {
      const gn = GeomNode.getGeom(n) as GeomNode
      gn.translate(delta)
    }
    // todo :test the edges!
  }
  boundingBox: Rectangle
}
