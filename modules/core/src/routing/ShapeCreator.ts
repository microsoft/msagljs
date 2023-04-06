﻿// Class for creating Shape elements from a Graph.

import {GeomEdge} from '../layout/core/geomEdge'
import {GeomGraph} from '../layout/core/geomGraph'
import {GeomNode} from '../layout/core/geomNode'
import {HookUpAnywhereFromInsidePort} from '../layout/core/hookUpAnywhereFromInsidePort'
import {Port} from '../layout/core/port'
import {RelativeFloatingPort} from '../layout/core/relativeFloatingPort'
import {ToAncestorEnum} from '../structs/edge'
// import {Assert} from '../utils/assert'
import {ClusterBoundaryPort} from './ClusterBoundaryPort'
import {RelativeShape} from './RelativeShape'
import {Shape} from './shape'

export class ShapeCreator {
  /**  For a given graph finds the obstacles for nodes and clusters, correctly parenting the obstacles
       according to the cluster hierarchy
       graph with edges to route and nodes/clusters to route around.
       Returns the set of obstacles with correct cluster hierarchy and ports
  */
  public static GetShapes(graph: GeomGraph, edges: GeomEdge[] = Array.from(graph.shallowEdges)): Array<Shape> {
    const nodesToShapes = new Map<GeomNode, Shape>()
    getShapesUnderGraph(graph, nodesToShapes)

    for (const edge of edges) {
      let shape = nodesToShapes.get(edge.source)
      if (shape) {
        if (edge.sourcePort != null) {
          shape.Ports.add(edge.sourcePort)
        }
      }
      shape = nodesToShapes.get(edge.target)
      if (shape) {
        if (edge.targetPort != null) {
          shape.Ports.add(edge.targetPort)
        }
      }
    }

    return Array.from(nodesToShapes.values())
  }

  /**   Creates a shape with a RelativeFloatingPort for the node center, attaches it to the shape and all edges */

  static CreateShapeWithCenterPort(node: GeomNode): Shape {
    // Assert.assert(ApproximateComparer.Close(node.BoundaryCurve.BoundingBox, node.BoundingBox), "node's curve doesn't fit its bounds!");
    const shape = new RelativeShape(() => node.boundaryCurve)

    const port = RelativeFloatingPort.mk(
      () => node.boundaryCurve,
      () => node.center,
    )
    shape.Ports.add(port)
    for (const e of node.inEdges()) {
      ShapeCreator.FixPortAtTarget(port, e)
    }

    for (const e of node.outEdges()) {
      ShapeCreator.FixPortAtSource(port, e)
    }

    for (const e of node.selfEdges()) {
      ShapeCreator.FixPortAtSource(port, e)
      ShapeCreator.FixPortAtTarget(port, e)
    }

    return shape
  }

  /**   Creates a ClusterBoundaryPort for the cluster boundary, attaches it to the shape and all edges */
  static CreateShapeWithClusterBoundaryPort(cluster: GeomGraph): Shape {
    // Assert.assert(ApproximateComparer.Close(node.BoundaryCurve.BoundingBox, node.BoundingBox), "node's curve doesn't fit its bounds!");
    // Assert.assert(cluster instanceof GeomGraph)
    const shape = new RelativeShape(() => cluster.boundaryCurve)

    const port = ClusterBoundaryPort.mk(
      () => cluster.boundaryCurve,
      () => cluster.center,
    )
    shape.Ports.add(port)
    let clusterPort: HookUpAnywhereFromInsidePort = undefined

    for (const e of cluster.inEdges()) {
      if (e.EdgeToAncestor() === ToAncestorEnum.ToAncestor) {
        if (clusterPort == null) {
          clusterPort = new HookUpAnywhereFromInsidePort(() => cluster.boundaryCurve)
        }
        e.targetPort = clusterPort
      } else {
        ShapeCreator.FixPortAtTarget(port, e)
      }
    }
    for (const e of cluster.outEdges()) {
      if (e.EdgeToAncestor() === ToAncestorEnum.FromAncestor) {
        if (clusterPort == null) {
          clusterPort = new HookUpAnywhereFromInsidePort(() => cluster.boundaryCurve)
        }
        e.sourcePort = clusterPort
      } else {
        ShapeCreator.FixPortAtSource(port, e)
      }
    }

    for (const e of cluster.selfEdges()) {
      ShapeCreator.FixPortAtSource(port, e)
      ShapeCreator.FixPortAtTarget(port, e)
    }

    return shape
  }

  static FixPortAtSource(port: Port, e: GeomEdge) {
    if (e == null) return
    if (e.sourcePort == null) {
      e.sourcePort = port
    }
  }

  static FixPortAtTarget(port: Port, e: GeomEdge) {
    if (e == null) return
    if (e.targetPort == null) {
      e.targetPort = port
    }
  }
}
function getShapesUnderGraph(graph: GeomGraph, nodesToShapes: Map<GeomNode, Shape>) {
  for (const n of graph.shallowNodes) {
    if (n instanceof GeomGraph) {
      const nShape = ShapeCreator.CreateShapeWithClusterBoundaryPort(n)
      nodesToShapes.set(n, nShape)
      const ng = <GeomGraph>n
      if (!ng.isCollapsed) {
        getShapesUnderGraph(ng, nodesToShapes)
        for (const ch of ng.shallowNodes) {
          nShape.AddChild(nodesToShapes.get(ch))
        }
      }
    } else {
      nodesToShapes.set(n, ShapeCreator.CreateShapeWithCenterPort(n))
    }
  }
}
