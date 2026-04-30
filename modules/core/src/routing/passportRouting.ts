/**
 * Passport helpers for edge routing with subgraph/cluster support.
 *
 * A "passport" is the set of shapes whose interior an edge is allowed to cross.
 * Edges sharing the same passport can be routed on the same obstacle set.
 * These functions are extracted from SplineRouter so that both spline and
 * sleeve routers can use them.
 */
import {GeomEdge} from '../layout/core/geomEdge'
import {Port} from '../layout/core/port'
import {Shape} from './shape'
import {Queue} from 'queue-typescript'
import {insertRange, uniteSets, setIntersection, setsAreEqual} from '../utils/setOperations'

/** Pre-compute ancestor sets for every shape reachable from `shapes`. */
export function getAncestorSetsMap(shapes: Array<Shape>): Map<Shape, Set<Shape>> {
  const ancSets = new Map<Shape, Set<Shape>>()
  for (const child of shapes.filter((child) => !ancSets.has(child))) {
    ancSets.set(child, getAncestorSet(child, ancSets))
  }
  return ancSets
}

function getAncestorSet(child: Shape, ancSets: Map<Shape, Set<Shape>>): Set<Shape> {
  const ret = new Set<Shape>(child.Parents)
  for (const parent of child.Parents) {
    let addition = ancSets.get(parent)
    if (!addition) {
      ancSets.set(parent, (addition = getAncestorSet(parent, ancSets)))
    }
    for (const t of addition) ret.add(t)
  }
  return ret
}

/**
 * Compute the passport for a single edge: the set of shapes whose interior
 * the edge is allowed to traverse.
 */
export function edgePassport(
  edge: GeomEdge,
  portsToShapes: Map<Port, Shape>,
  ancestorSets: Map<Shape, Set<Shape>>,
  root: Shape,
): Set<Shape> {
  const ret = new Set<Shape>()
  const sourceShape = portsToShapes.get(edge.sourcePort)
  const targetShape = portsToShapes.get(edge.targetPort)

  if (isAncestor(sourceShape, targetShape, ancestorSets)) {
    insertRange(ret, targetShape.Parents)
    ret.add(sourceShape)
    return ret
  }

  if (isAncestor(targetShape, sourceShape, ancestorSets)) {
    insertRange(ret, sourceShape.Parents)
    ret.add(targetShape)
    return ret
  }

  if (sourceShape !== root) {
    insertRange(ret, sourceShape.Parents)
  }

  if (targetShape !== root) {
    insertRange(ret, targetShape.Parents)
  }

  return ret
}

function isAncestor(
  possibleAncestor: Shape,
  possiblePredecessor: Shape,
  ancestorSets: Map<Shape, Set<Shape>>,
): boolean {
  let ancestors: Set<Shape>
  return (
    possiblePredecessor != null &&
    (ancestors = ancestorSets.get(possiblePredecessor)) != null &&
    ancestors.has(possibleAncestor)
  )
}

/** Group edges by passport: edges with the same passport share obstacle sets. */
export function groupEdgesByPassport(
  edges: GeomEdge[],
  portsToShapes: Map<Port, Shape>,
  ancestorSets: Map<Shape, Set<Shape>>,
  root: Shape,
): Array<{passport: Set<Shape>; edges: Array<GeomEdge>}> {
  const ret = new Array<{passport: Set<Shape>; edges: Array<GeomEdge>}>()
  for (const edge of edges) {
    const ep = edgePassport(edge, portsToShapes, ancestorSets, root)
    let pair = ret.find((p) => setsAreEqual(p.passport, ep))
    if (!pair) {
      pair = {passport: ep, edges: []}
      ret.push(pair)
    }
    pair.edges.push(edge)
  }
  return ret
}

/**
 * Given a passport, return the set of obstacle shapes the edge must route around.
 * Shapes in the passport (and their ancestors) are transparent; their siblings
 * and children that are not ancestors are obstacles.
 */
export function getObstaclesFromPassport(
  passport: Set<Shape>,
  ancestorSets: Map<Shape, Set<Shape>>,
  root: Shape,
): Set<Shape> {
  if (passport.size === 0) {
    return new Set<Shape>(root.Children)
  }

  const commonAncestors = getCommonAncestorsAbovePassport(passport, ancestorSets)
  const allAncestors = getAllAncestors(passport, ancestorSets)
  const ret = new Set<Shape>()
  for (const p of passport) {
    for (const child of p.Children) {
      if (!allAncestors.has(child)) ret.add(child)
    }
  }
  const enqueued = uniteSets(new Set<Shape>(passport), ret)
  const queue = new Queue<Shape>()

  for (const shape of passport) {
    if (!commonAncestors.has(shape)) queue.enqueue(shape)
  }

  while (queue.length > 0) {
    const a = queue.dequeue()
    for (const parent of a.Parents) {
      for (const sibling of parent.Children) {
        if (!allAncestors.has(sibling)) {
          ret.add(sibling)
        }
      }

      if (!commonAncestors.has(parent) && !enqueued.has(parent)) {
        queue.enqueue(parent)
        enqueued.add(parent)
      }
    }
  }

  return ret
}

function getAllAncestors(passport: Set<Shape>, ancestorSets: Map<Shape, Set<Shape>>): Set<Shape> {
  if (passport.size === 0) {
    return new Set<Shape>()
  }

  let ret = new Set<Shape>(passport)
  for (const shape of passport) {
    ret = uniteSets(ret, ancestorSets.get(shape))
  }

  return ret
}

function getCommonAncestorsAbovePassport(passport: Set<Shape>, ancestorSets: Map<Shape, Set<Shape>>): Set<Shape> {
  if (passport.size === 0) {
    return new Set<Shape>()
  }

  const en = Array.from(passport)
  let ret = ancestorSets.get(en[0])
  for (let i = 1; i < en.length; i++) {
    const shape = en[i]
    ret = setIntersection(ret, ancestorSets.get(shape))
  }

  return ret
}

/** Build portToShapes mapping from the shape tree. */
export function calculatePortsToShapes(root: Shape, edges: GeomEdge[]): Map<Port, Shape> {
  const portsToShapes = new Map<Port, Shape>()
  for (const shape of root.Descendants()) {
    for (const port of shape.Ports) {
      portsToShapes.set(port, shape)
    }
  }

  // assign all orphan ports to the root
  for (const edge of edges) {
    if (edge.sourcePort && !portsToShapes.has(edge.sourcePort)) {
      root.Ports.add(edge.sourcePort)
      portsToShapes.set(edge.sourcePort, root)
    }
    if (edge.targetPort && !portsToShapes.has(edge.targetPort)) {
      root.Ports.add(edge.targetPort)
      portsToShapes.set(edge.targetPort, root)
    }
  }

  return portsToShapes
}
