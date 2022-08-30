import {Algorithm} from '../../utils/algorithm'
import {BasicGraphOnEdges, mkGraphOnEdgesN} from '../../structs/basicGraphOnEdges'
import {FiEdge} from './fiEdge'
import {FiNode, getFiNode} from './fiNode'
import {IConstraint} from './iConstraint'
import {Point} from '../../math/geometry'
import {Edge} from '../../structs/edge'
import {GeomGraph, GeomNode} from '../core'
import {FloatingPort} from '../core/floatingPort'
import {FastIncrementalLayoutSettings} from './fastIncrementalLayoutSettings'
import {AxisSolver} from './axisSolver'
import {IGeomGraph} from '../initialLayout/iGeomGraph'
import {AlgorithmData} from '../../structs/algorithmData'
import {GetConnectedComponents as getConnectedComponents} from '../../math/graphAlgorithms/ConnectedComponentCalculator'
import {OverlapRemovalParameters} from '../../math/geometry/overlapRemoval/overlapRemovalParameters'
import {RectangularClusterBoundary} from '../../math/geometry/overlapRemoval/rectangularClusterBoundary'
import {VerticalSeparationConstraint} from './verticalSeparationConstraint'
import {HorizontalSeparationConstraint} from './horizontalSeparationConstraints'
import {Assert} from '../../utils/assert'
import {EdgeConstraintGenerator} from './edgeConstraintsGenerator'
import {Feasibility} from './feasibility'
import {KDTree, Particle} from './multipole/kdTree'
import {MultipoleCoefficients} from './multipole/multipoleCoefficients'
import {GeomObject} from '../core/geomObject'
import {Graph} from '../../structs/graph'
/** 
  Fast incremental layout is a force directed layout strategy with approximate computation of long-range node-node repulsive forces to achieve O(n log n) running time per iteration.
  It can be invoked on an existing layout (for example, as computed by MDS) to beautify it.  See docs for CalculateLayout method (below) to see how to use it incrementally.

*/
export class FastIncrementalLayout extends Algorithm {
  basicGraph: BasicGraphOnEdges<FiEdge>

  components: Array<FiNode[]>

  constraints = new Map<number, Array<IConstraint>>()

  edges: Array<FiEdge>
  nodes: Array<FiNode>

  clustersInfo = new Map<IGeomGraph, {barycenter: Point; weight?: number; rectBoundary?: RectangularClusterBoundary}>()

  /**  Holds the derivative of the cost function calculated of the most recent iteration.*/
  energy: number

  graph: IGeomGraph

  horizontalSolver: AxisSolver

  progress: number

  settings: FastIncrementalLayoutSettings

  stepSize: number

  verticalSolver: AxisSolver

  clusterSettings: (g: IGeomGraph) => any

  clusterEdges: Array<Edge> = new Array<Edge>()

  getRB(g: IGeomGraph): RectangularClusterBoundary | undefined {
    const t = this.clustersInfo.get(g)
    return t ? t.rectBoundary : undefined
  }

  setRB(g: IGeomGraph, rb: RectangularClusterBoundary) {
    const t = this.clustersInfo.get(g)
    if (t == null) {
      this.clustersInfo.set(g, {barycenter: new Point(0, 0)})
    }
    t.rectBoundary = rb
  }

  ///  Create the graph data structures.

  constructor(
    geometryGraph: IGeomGraph,
    settings: FastIncrementalLayoutSettings,
    initialConstraintLevel: number,
    clusterSettings: (g: IGeomGraph) => any,
  ) {
    super(null)
    this.graph = geometryGraph
    this.settings = settings
    this.clusterSettings = clusterSettings
    this.initFiNodesEdges()
    this.edges = Array.from(this.graph.edges()).map((gn) => AlgorithmData.getAlgData(gn.edge).data as FiEdge)
    this.nodes = Array.from(this.graph.shallowNodes).map((gn) => AlgorithmData.getAlgData(gn.node).data as FiNode)
    this.SetLockNodeWeights()
    this.components = new Array<FiNode[]>()
    if (!this.settings.InterComponentForces) {
      this.basicGraph = mkGraphOnEdgesN(this.edges, this.nodes.length)
      for (const componentNodes of getConnectedComponents(this.basicGraph)) {
        const vs = new Array(componentNodes.length)
        let vi = 0
        for (const v of componentNodes) {
          vs[vi++] = this.nodes[v]
        }

        this.components.push(vs)
      }
    } else {
      this.components.push(this.nodes)
    }

    this.horizontalSolver = new AxisSolver(
      true,
      this.nodes,
      Array.from(this.graph.Clusters),
      settings.AvoidOverlaps,
      settings.MinConstraintLevel,
      this.clusterSettings,
      (g) => this.getRB(g),
    )
    const orp = (this.horizontalSolver.OverlapRemovalParameters = OverlapRemovalParameters.constructorEmpty())
    orp.AllowDeferToVertical = true
    orp.ConsiderProportionalOverlap = this.settings.applyForces

    this.verticalSolver = new AxisSolver(
      false,
      this.nodes,
      Array.from(this.graph.Clusters),
      this.settings.AvoidOverlaps,
      this.settings.minConstraintLevel,
      this.clusterSettings,
      (g) => this.getRB(g),
    )
    this.SetupConstraints()
    this.computeWeight(geometryGraph)
    for (const c of this.graph.subgraphsDepthFirst) {
      if (this.getRB(c) == null) {
        this.setRB(c, new RectangularClusterBoundary())
      }
    }
    // if (this.getRB(this.graph) == null) {
    //   this.setRB(this.graph, new RectangularClusterBoundary())
    // }

    this.setCurrentConstraintLevel(initialConstraintLevel)
  }
  initFiNodesEdges() {
    let i = 0
    for (const gn of this.graph.shallowNodes) {
      const fiNode = new FiNode(i++, gn)
      new AlgorithmData(gn.node, fiNode) //this will bind the new fiNode with the underlying Node
    }

    for (const e of this.graph.edges()) {
      // if (e.source instanceof GeomGraph || e.target instanceof GeomGraph) {
      // continue
      //} else {
      const fiEdge = new FiEdge(e)
      new AlgorithmData(e.edge, fiEdge)
      //}
    }
  }

  SetupConstraints() {
    this.AddConstraintLevel(0)
    if (this.settings.AvoidOverlaps) {
      this.AddConstraintLevel(2)
    }

    for (const c of this.settings.StructuralConstraints) {
      this.AddConstraintLevel(c.Level)
      if (c instanceof VerticalSeparationConstraint) {
        this.verticalSolver.AddStructuralConstraint(c)
      } else if (c instanceof HorizontalSeparationConstraint) {
        this.horizontalSolver.AddStructuralConstraint(c)
      } else {
        this.AddConstraint(c)
      }
    }

    EdgeConstraintGenerator.GenerateEdgeConstraints(
      this.graph.edges(),
      this.settings.edgeConstrains,
      this.horizontalSolver,
      this.verticalSolver,
    )
  }

  currentConstraintLevel: number

  ///  Controls which constraints are applied of CalculateLayout.  Setter enforces feasibility at that level.

  getCurrentConstraintLevel(): number {
    return this.currentConstraintLevel
  }
  setCurrentConstraintLevel(value: number) {
    this.currentConstraintLevel = value
    this.horizontalSolver.ConstraintLevel = value
    this.verticalSolver.ConstraintLevel = value
    Feasibility.Enforce(
      this.settings,
      value,
      this.nodes,
      this.horizontalSolver.structuralConstraints,
      this.verticalSolver.structuralConstraints,
      Array.from(this.graph.Clusters),
      this.clusterSettings,
      (g) => this.getRB(g),
    )
    this.settings.Unconverge()
  }

  ///  Add constraint to constraints lists.  Warning, no check that dictionary alread holds a list for the level.
  ///  Make sure you call AddConstraintLevel first (perf).

  AddConstraint(c: IConstraint) {
    if (!this.constraints.has(c.Level)) {
      this.constraints.set(c.Level, new Array<IConstraint>())
    }

    this.constraints.get(c.Level).push(c)
  }

  ///  Check for constraint level of dictionary, if it doesn't exist add the list at that level.

  AddConstraintLevel(level: number) {
    if (!this.constraints.has(level)) {
      this.constraints.set(level, new Array<IConstraint>())
    }
  }

  SetLockNodeWeights() {
    for (const l of this.settings.locks) {
      l.SetLockNodeWeight()
    }
  }

  ResetNodePositions() {
    for (const v of this.nodes) {
      v.ResetBounds()
    }
  }

  AddRepulsiveForce(v: FiNode, repulsion: Point) {
    //  scale repulsion
    v.force = repulsion.mul(10 * this.settings.RepulsiveForceConstant)
  }

  AddLogSpringForces(e: FiEdge, duv: Point, d: number) {
    const l = duv.length
    const f = 0.0007 * this.settings.AttractiveForceConstant * l * Math.log((l + 0.1) / (d + 0.1))
    e.sourceFiNode.force = e.sourceFiNode.force.add(duv.mul(f))
    e.targetFiNode.force = e.targetFiNode.force.sub(duv.mul(f))
  }

  AddSquaredSpringForces(e: FiEdge, duv: Point, d: number) {
    /*
  double l = duv.Length,
                   d2 = d*d + 0.1,
                   f = settings.AttractiveForceConstant*(l - d)/d2;
            e.source.force += f*duv;
            e.target.force -= f*duv;
            */
    const l: number = duv.length
    const d2: number = d * d + 0.1
    const f = (this.settings.AttractiveForceConstant * (l - d)) / d2
    e.sourceFiNode.force = e.sourceFiNode.force.add(duv.mul(f))
    e.targetFiNode.force = e.targetFiNode.force.sub(duv.mul(f))
  }

  AddSpringForces(e: FiEdge) {
    let duv: Point
    if (this.settings.RespectEdgePorts) {
      let sourceLocation = e.sourceFiNode.Center
      let targetLocation = e.targetFiNode.Center
      const sourcePort = e.mEdge.sourcePort
      if (sourcePort instanceof FloatingPort) {
        sourceLocation = sourcePort.Location
      }
      const targetPort = e.mEdge.targetPort
      if (targetPort instanceof FloatingPort) {
        targetLocation = targetPort.Location
      }

      duv = sourceLocation.sub(targetLocation)
    } else {
      duv = e.vector()
    }

    if (this.settings.LogScaleEdgeForces) {
      this.AddLogSpringForces(e, duv, e.length)
    } else {
      this.AddSquaredSpringForces(e, duv, e.length)
    }
  }

  static AddGravityForce(origin: Point, gravity: number, v: FiNode) {
    if (v == null) return
    //  compute and add gravity  v.force -= 0.0001*gravity*(origin - v.Center);
    v.force = v.force.sub(origin.sub(v.Center).mul(gravity * 0.0001))
  }

  ComputeRepulsiveForces(vs: FiNode[]) {
    const n: number = vs.length
    if (n > 16 && this.settings.ApproximateRepulsion) {
      const ps = new Array(vs.length)
      //  before calculating forces we perturb each center by a small vector of a unique
      //  but deterministic direction (by walking around a circle of n steps) - this allows
      //  the KD-tree to decompose even when some nodes are at exactly the same position
      const angleDelta = 2 * (Math.PI / n)
      let angle = 0
      for (let i = 0; i < n; i++) {
        ps[i] = new Particle(vs[i].Center.add(new Point(Math.cos(angle), Math.sin(angle)).mul(1e-5)))
        angle += angleDelta
      }

      const kdTree = new KDTree(ps, 8)
      kdTree.ComputeForces(5)
      for (let i = 0; i < vs.length; i++) {
        this.AddRepulsiveForce(vs[i], ps[i].force)
      }
    } else {
      for (const u of vs) {
        let fu = new Point(0, 0)
        for (const v of vs) {
          if (u != v) {
            fu = fu.add(MultipoleCoefficients.Force(u.Center, v.Center))
          }
        }

        this.AddRepulsiveForce(u, fu)
      }
    }
  }

  SetBarycenter(root: IGeomGraph): Point {
    const w = this.clustersInfo.get(root)
    if (w != undefined) return w.barycenter
    let center = new Point(0, 0)
    //  If these are empty then Weight is 0 and barycenter becomes NaN.
    //  If there are no child clusters with nodes, then Weight stays 0.
    if (root.shallowNodeCount || hasSomeClusters(root)) {
      const clusterInfo = this.clustersInfo.get(root)

      if (clusterInfo == undefined || clusterInfo.weight == undefined) {
        this.computeWeight(root)
      }

      if (clusterInfo.weight != null) {
        for (const v of root.shallowNodes) {
          if (v instanceof GeomNode) {
            center = center.add(v.center)
          } else {
            center = center.add(this.SetBarycenter(v).mul(this.clustersInfo.get(v).weight))
          }
        }

        this.clustersInfo.get(root).barycenter = center = center.div(clusterInfo.weight)
      }
    } else {
      this.clustersInfo.get(root).barycenter = center
    }

    return center
  }
  computeWeight(root: IGeomGraph): number {
    let w = 0
    for (const n of root.shallowNodes) {
      if (n.entity instanceof Graph) {
        w += this.computeWeight(n as unknown as IGeomGraph)
      } else {
        w++
      }
    }
    let info = this.clustersInfo.get(root)
    if (info == null) {
      this.clustersInfo.set(root, (info = {barycenter: new Point(0, 0)}))
    }
    info.weight = w
    return w
  }
  AddClusterForces(root: IGeomGraph) {
    if (root == null) {
      return
    }

    //  SetBarycenter is recursive.
    this.SetBarycenter(root)
    //  The cluster edges draw the barycenters of the connected clusters together
    for (const e of this.clusterEdges) {
      //  foreach cluster keep a force vector.  Replace ForEachNode calls below with a simple
      //  addition to this force vector.  Traverse top down, tallying up force vectors of children
      //  to be the sum of their parents.
      const gn1 = GeomObject.getGeom(e.source) as GeomNode
      const gn2 = GeomObject.getGeom(e.target) as GeomNode
      const n1 = <FiNode>AlgorithmData.getAlgData(e.source).data
      const n2 = <FiNode>AlgorithmData.getAlgData(e.target).data
      const c1_is_cluster = gn1.hasOwnProperty('shallowNodes')
      const center1: Point = c1_is_cluster ? this.clustersInfo.get(gn1 as unknown as IGeomGraph).barycenter : gn1.center
      const c2_is_cluster = gn2.hasOwnProperty('shallowNodes')
      const center2: Point = c2_is_cluster ? this.clustersInfo.get(gn2 as unknown as IGeomGraph).barycenter : gn2.center
      let duv: Point = center1.sub(center2)
      const l: number = duv.length
      const f: number = 1e-8 * (this.settings.AttractiveInterClusterForceConstant * (l * Math.log(l + 0.1)))
      duv = duv.mul(f)
      if (c1_is_cluster) {
        const ig = gn1 as unknown as IGeomGraph
        for (const v of ig.shallowNodes) {
          const fv = <FiNode>AlgorithmData.getAlgData(v.node).data
          fv.force = fv.force.add(duv)
        }
      } else {
        n1.force = n1.force.add(duv)
      }
      if (c2_is_cluster) {
        const ig = gn2 as unknown as IGeomGraph
        for (const v of ig.shallowNodes) {
          const fv = <FiNode>AlgorithmData.getAlgData(v.node).data
          fv.force = fv.force.sub(duv)
        }
      } else {
        n2.force = n2.force.sub(duv)
      }
    }

    for (const c of root.subgraphsDepthFirst) {
      const cCenter = this.clustersInfo.get(c).barycenter
      for (const v of c.shallowNodes) {
        FastIncrementalLayout.AddGravityForce(cCenter, this.settings.ClusterGravity, getFiNode(v))
      }
    }
  }

  ///  Aggregate all the forces affecting each node

  ComputeForces() {
    if (this.components != null) {
      for (const c of this.components) this.ComputeRepulsiveForces(c)
    } else {
      this.ComputeRepulsiveForces(this.nodes)
    }

    this.edges.forEach((e) => this.AddSpringForces(e))
    for (const c of this.components) {
      let origin = new Point(0, 0)
      for (let i = 0; i < c.length; i++) {
        origin = origin.add(c[i].Center)
      }
      origin = origin.div(c.length)
      let maxForce: number = Number.NEGATIVE_INFINITY
      for (let i = 0; i < c.length; i++) {
        const v: FiNode = c[i]
        FastIncrementalLayout.AddGravityForce(origin, this.settings.GravityConstant, v)
        if (v.force.length > maxForce) {
          maxForce = v.force.length
        }
      }

      if (maxForce > 100) {
        for (let i = 0; i < c.length; i++) {
          c[i].force = c[i].force.mul(100 / maxForce)
        }
      }
    }

    //  This is the only place where ComputeForces (and hence verletIntegration) considers clusters.
    //  It's just adding a "gravity" force on nodes inside each cluster towards the barycenter of the cluster.
    this.AddClusterForces(this.graph)
  }

  SatisfyConstraints() {
    for (let i = 0; i < this.settings.ProjectionIterations; i++) {
      for (const level of this.constraints.keys()) {
        if (level > this.getCurrentConstraintLevel()) {
          break
        }

        for (const c of this.constraints.get(level)) {
          c.Project()
          //  c.Project operates only on MSAGL nodes, so need to update the local FiNode.Centers
          for (const v of c.Nodes) {
            const fiNode = getFiNode(v)
            fiNode.Center = v.center
          }
        }
      }

      for (const l of this.settings.locks) {
        l.Project()
        //  again, project operates only on MSAGL nodes, we'll also update FiNode.PreviousPosition since we don't want any inertia of this case
        for (const v of l.Nodes) {
          const fiNode: FiNode = getFiNode(v)
          //  the locks should have had their AlgorithmData updated, but if (for some reason)
          //  the locks list is out of date we don't want to null ref here.
          if (fiNode != null) {
            fiNode.ResetBounds()
          }
        }
      }
    }
  }

  ///  Checks if solvers need to be applied, i.e. if there are user constraints or
  ///  generated constraints (such as non-overlap) that need satisfying

  ///  <returns></returns>
  NeedSolve(): boolean {
    return this.horizontalSolver.NeedSolve || this.verticalSolver.NeedSolve
  }

  ///  Force directed layout is basically an iterative approach to solving a bunch of differential equations.
  ///  Different integration schemes are possible for applying the forces iteratively.  Euler is the simplest:
  ///   v_(i+1) = v_i + a dt
  ///   x_(i+1) = x_i + v_(i+1) dt
  ///
  ///  Verlet is much more stable (and not really much more complicated):
  ///   x_(i+1) = x_i + (x_i - x_(i-1)) + a dt dt

  VerletIntegration(): number {
    //  The following sets the Centers of all nodes to a (not necessarily feasible) configuration that reduces the cost (forces)
    const energy0: number = this.energy
    this.energy = this.ComputeDescentDirection(1)
    this.UpdateStepSize(energy0)
    this.SolveSeparationConstraints()
    let displacementSquared = 0
    for (let i = 0; i < this.nodes.length; i++) {
      const v: FiNode = this.nodes[i]
      displacementSquared += v.Center.sub(v.previousCenter).lengthSquared
    }

    return displacementSquared
  }

  SolveSeparationConstraints() {
    if (this.NeedSolve()) {
      //  Increasing the padding effectively increases the size of the rectangle, so it will lead to more overlaps,
      //  and therefore tighter packing once the overlap is removed and therefore more apparent "columnarity".
      //  We don't want to drastically change the shape of the rectangles, just increase them ever so slightly so that
      //  there is a bit more space of the horizontal than vertical direction, thus reducing the likelihood that
      //  the vertical constraint generation will detect spurious overlaps, which should allow the nodes to slide
      //  smoothly around each other.  ConGen padding args are:  First pad is of direction of the constraints being
      //  generated, second pad is of the perpendicular direction.
      const dblVpad: number = this.settings.NodeSeparation
      const dblHpad: number = dblVpad + Feasibility.Pad
      const dblCVpad: number = this.settings.clusterMargin
      const dblCHpad: number = dblCVpad + Feasibility.Pad
      //  The centers are our desired positions, but we need to find a feasible configuration
      for (const v of this.nodes) {
        v.desiredPosition = v.Center
      }

      //  Set up horizontal non-overlap constraints based on the (feasible) starting configuration
      this.horizontalSolver.Initialize(dblHpad, dblVpad, dblCHpad, dblCVpad, (v) => v.previousCenter)
      this.horizontalSolver.SetDesiredPositions()
      this.horizontalSolver.Solve()
      //  generate y constraints
      this.verticalSolver.Initialize(dblHpad, dblVpad, dblCHpad, dblCVpad, (v) => v.Center)
      this.verticalSolver.SetDesiredPositions()
      this.verticalSolver.Solve()
      //  If we have multiple locks (hence multiple high-weight nodes), there can still be some
      //  movement of the locked variables - so update all lock positions.
      for (const l of this.settings.locks) {
        if (!l.Sticky) l.Bounds = l.node.boundingBox
      }
    }
  }

  ComputeDescentDirection(alpha: number): number {
    this.ResetForceVectors()
    //  velocity is the distance travelled last time step
    if (this.settings.ApplyForces) {
      this.ComputeForces()
    }

    let lEnergy = 0
    for (const v of this.nodes) {
      lEnergy = lEnergy + v.force.lengthSquared
      let dx: Point = v.Center.sub(v.previousCenter).mul(this.settings.Friction)
      const a: Point = v.force.mul(-this.stepSize * alpha)
      v.previousCenter = v.Center

      Assert.assert(!Number.isNaN(a.x), '!double.IsNaN(a.X)')
      Assert.assert(!Number.isNaN(a.y), '!double.IsNaN(a.Y)')
      Assert.assert(Number.isFinite(a.x), '!double.IsInfinity(a.X)')
      Assert.assert(Number.isFinite(a.y), '!double.IsInfinity(a.Y)')
      dx = dx.add(a)
      dx = dx.div(v.stayWeight)
      v.Center = v.Center.add(dx)
    }

    this.SatisfyConstraints()
    return lEnergy
  }

  ResetForceVectors() {
    for (const v of this.nodes) {
      v.force = new Point(0, 0)
    }
  }

  ///  Adapt StepSize based on change of energy.
  ///  Five sequential improvements of energy mean we increase the stepsize.
  ///  Any increase of energy means we reduce the stepsize.

  UpdateStepSize(energy0: number) {
    if (this.energy < energy0) {
      if (++this.progress >= 3) {
        this.progress = 0
        this.stepSize /= this.settings.Decay
      }
    } else {
      this.progress = 0
      this.stepSize *= this.settings.Decay
    }
  }

  RungeKuttaIntegration(): number {
    const y0 = new Array<Point>(this.nodes.length)
    const k1 = new Array<Point>(this.nodes.length)
    const k2 = new Array<Point>(this.nodes.length)
    const k3 = new Array<Point>(this.nodes.length)
    const k4 = new Array<Point>(this.nodes.length)
    const energy0: number = this.energy
    this.SatisfyConstraints()
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].previousCenter = this.nodes[i].Center
      y0[i] = this.nodes[i].Center
    }

    const alpha = 3
    this.ComputeDescentDirection(alpha)
    for (let i = 0; i < this.nodes.length; i++) {
      k1[i] = this.nodes[i].Center.sub(this.nodes[i].previousCenter)
      this.nodes[i].Center = y0[i].add(k1[i].mul(0.5))
    }

    this.ComputeDescentDirection(alpha)
    for (let i = 0; i < this.nodes.length; i++) {
      k2[i] = this.nodes[i].Center.sub(this.nodes[i].previousCenter)
      this.nodes[i].previousCenter = y0[i]
      this.nodes[i].Center = y0[i].add(k2[i].mul(0.5))
    }

    this.ComputeDescentDirection(alpha)
    for (let i = 0; i < this.nodes.length; i++) {
      k3[i] = this.nodes[i].Center.sub(this.nodes[i].previousCenter)
      this.nodes[i].previousCenter = y0[i]
      this.nodes[i].Center = y0[i].add(k3[i])
    }

    this.energy = <number>this.ComputeDescentDirection(alpha)
    for (let i = 0; i < this.nodes.length; i++) {
      k4[i] = this.nodes[i].Center.sub(this.nodes[i].previousCenter)
      this.nodes[i].previousCenter = y0[i]
      /* (k1[i] + 2.0*k2[i] + 2.0*k3[i] + k4[i])/6.0;*/
      const dx: Point = k1[i].add(k2[i].mul(2).add(k3[i].mul(2)).add(k4[i])).div(6)
      this.nodes[i].Center = y0[i].add(dx)
    }

    this.UpdateStepSize(energy0)
    this.SolveSeparationConstraints()
    return this.nodes.reduce((prevSum, v) => v.Center.sub(v.previousCenter).lengthSquared + prevSum, 0)
  }

  ///  Apply a small number of iterations of the layout.
  ///  The idea of incremental layout is that settings.minorIterations should be a small number (e.g. 3) and
  ///  CalculateLayout should be invoked of a loop, e.g.:
  ///
  ///  while(settings.RemainingIterations > 0) {
  ///     fastIncrementalLayout.CalculateLayout();
  ///     InvokeYourProcedureToRedrawTheGraphOrHandleInteractionEtc();
  ///  }
  ///
  ///  In the verletIntegration step above, the RemainingIterations is used to control damping.

  run() {
    this.settings.Converged = false
    this.settings.EdgeRoutesUpToDate = false
    if (this.settings.Iterations++ == 0) {
      this.stepSize = this.settings.InitialStepSize
      this.energy = Number.MAX_VALUE
      this.progress = 0
    }
    //this.StartListenToLocalProgress(this.settings.MinorIterations);
    for (let i = 0; i < this.settings.MinorIterations; i++) {
      const d2 = this.settings.RungeKuttaIntegration ? this.RungeKuttaIntegration() : this.VerletIntegration()
      if (d2 < this.settings.DisplacementThreshold || this.settings.Iterations > this.settings.MaxIterations) {
        this.settings.Converged = true
        //      this.ProgressComplete();
        break
      }

      this.ProgressStep()
    }
  }

  ///  Simply does a depth first traversal of the cluster hierarchies fitting Rectangles to the contents of the cluster
  ///  or updating the cluster BoundingBox to the already calculated RectangularBoundary
}
function hasSomeClusters(g: IGeomGraph): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of g.Clusters) {
    return true
  }
  return false
}
