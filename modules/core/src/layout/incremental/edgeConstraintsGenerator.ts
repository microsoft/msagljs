import {LinkedList, LinkedListNode} from '@esfx/collections'
import {Direction} from '../../math/geometry'
import {GeomNode, GeomEdge} from '../core'
import {EdgeConstraints} from '../edgeConstraints'
import {AxisSolver} from './axisSolver'
import {HorizontalSeparationConstraint} from './horizontalSeparationConstraints'
import {VerticalSeparationConstraint} from './verticalSeparationConstraint'

export class TNode {
  stackNode: LinkedListNode<TNode>

  v: GeomNode

  visited: boolean

  outNeighbours: Array<TNode> = new Array<TNode>()

  inNeighbours: Array<TNode> = new Array<TNode>()

  constructor(v: GeomNode) {
    this.v = v
  }
}

///  <summary>
///  Create separation constraints between the source and target of edges not involved of cycles
///  of order to better show flow
///  </summary>
export class EdgeConstraintGenerator {
  settings: EdgeConstraints

  edges: Iterable<GeomEdge>

  nodeMap: Map<GeomNode, TNode> = new Map<GeomNode, TNode>()

  stack: LinkedList<TNode> = new LinkedList<TNode>()

  component: Array<TNode>

  horizontalSolver: AxisSolver

  verticalSolver: AxisSolver

  cyclicComponents: Array<Set<GeomNode>> = new Array<Set<GeomNode>>()

  ///  <summary>
  ///  Creates a VerticalSeparationConstraint for each edge of the given set to structural constraints,
  ///  to require these edges to be downward pointing.  Also checks for cycles, and edges involved
  ///  of a cycle receive no VerticalSeparationConstraint, but can optionally receive a circle constraint.
  ///  </summary>
  ///  <param name="edges"></param>
  ///  <param name="settings"></param>
  ///  <param name="horizontalSolver"></param>
  ///  <param name="verticalSolver"></param>
  static GenerateEdgeConstraints(
    edges: Iterable<GeomEdge>,
    settings: EdgeConstraints,
    horizontalSolver: AxisSolver,
    verticalSolver: AxisSolver,
  ) {
    if (settings.Direction == Direction.None) {
      return
    }

    const g: EdgeConstraintGenerator = new EdgeConstraintGenerator(edges, settings, horizontalSolver, verticalSolver)
    g.GenerateSeparationConstraints()
  }

  constructor(edges: Iterable<GeomEdge>, settings: EdgeConstraints, horizontalSolver: AxisSolver, verticalSolver: AxisSolver) {
    //  filter out self edges
    this.edges = Array.from(this.edges).filter((e) => e.source != e.target)
    this.settings = settings
    this.horizontalSolver = horizontalSolver
    this.verticalSolver = verticalSolver
    for (const e of this.edges) {
      const v: TNode = this.CreateTNode(e.target)
      const u: TNode = this.CreateTNode(e.source)
      u.outNeighbours.push(v)
      v.inNeighbours.push(u)
    }

    for (const v of this.nodeMap.values()) {
      if (v.stackNode == null) {
        this.DFS(v)
      }
    }

    while (this.stack.size > 0) {
      this.component = new Array<TNode>()
      this.RDFS(this.stack.last.value)
      if (this.component.length > 1) {
        const cyclicComponent = new Set<GeomNode>()
        for (const v of this.component) {
          cyclicComponent.add(v.v)
        }

        this.cyclicComponents.push(cyclicComponent)
      }
    }

    switch (this.settings.Direction) {
      case Direction.South:
        this.addConstraint = this.AddSConstraint
        break
      case Direction.North:
        this.addConstraint = this.AddNConstraint
        break
      case Direction.West:
        this.addConstraint = this.AddWConstraint
        break
      case Direction.East:
        this.addConstraint = this.AddEConstraint
        break
    }
  }

  private addConstraint: (u: GeomNode, v: GeomNode) => void

  private AddSConstraint(u: GeomNode, v: GeomNode) {
    this.verticalSolver.AddStructuralConstraint(
      VerticalSeparationConstraint.constructorNNN(u, v, (u.height + v.height) / 2 + this.settings.Separation),
    )
  }

  private AddNConstraint(u: GeomNode, v: GeomNode) {
    this.verticalSolver.AddStructuralConstraint(
      VerticalSeparationConstraint.constructorNNN(v, u, (u.height + v.height) / 2 + this.settings.Separation),
    )
  }

  private AddEConstraint(u: GeomNode, v: GeomNode) {
    this.horizontalSolver.AddStructuralConstraint(
      HorizontalSeparationConstraint.constructorNNN(v, u, (u.width + v.width) / 2 + this.settings.Separation),
    )
  }

  private AddWConstraint(u: GeomNode, v: GeomNode) {
    this.horizontalSolver.AddStructuralConstraint(
      HorizontalSeparationConstraint.constructorNNN(u, v, (u.width + v.width) / 2 + this.settings.Separation),
    )
  }

  ///  <summary>
  ///  For each edge not involved of a cycle create a constraint
  ///  </summary>
  public GenerateSeparationConstraints() {
    for (const e of this.edges) {
      let edgeInCycle = false
      const v: GeomNode = e.target
      const u: GeomNode = e.source
      for (const c of this.cyclicComponents) {
        if (c.has(u) && c.has(v)) {
          edgeInCycle = true
          break
        }
      }

      if (!edgeInCycle) {
        this.addConstraint(u, v)
      }
    }
  }

  private DFS(u: TNode) {
    u.visited = true
    for (const v of u.outNeighbours) {
      if (!v.visited) {
        this.DFS(v)
      }
    }

    this.PushStack(u)
  }

  private RDFS(u: TNode) {
    this.component.push(u)
    this.PopStack(u)
    for (const v of u.inNeighbours) {
      if (v.stackNode != null) {
        this.RDFS(v)
      }
    }
  }

  private CreateTNode(v: GeomNode): TNode {
    let tv: TNode
    if (!this.nodeMap.has(v)) {
      tv = new TNode(v)
      this.nodeMap.set(v, tv)
    } else {
      tv = this.nodeMap.get(v)
    }

    return tv
  }

  private PushStack(v: TNode) {
    v.stackNode = this.stack.push(v)
  }

  private PopStack(v: TNode) {
    this.stack.deleteNode(v.stackNode)
    v.stackNode = null
  }
}
