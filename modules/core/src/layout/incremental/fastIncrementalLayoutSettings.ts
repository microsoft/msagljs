import {LinkedList} from '@esfx/collections'
import {Rectangle} from '../../math/geometry'
import {EdgeRoutingSettings} from '../../routing/EdgeRoutingSettings'
import {CancelToken} from '../../utils/cancelToken'
import {GeomGraph, GeomNode} from '../core'
import {EdgeConstraints} from '../edgeConstraints'
import {CommonLayoutSettings} from '../layered/commonLayoutSettings'
import {FastIncrementalLayout} from './fastIncrementalLayout'
import {IConstraint} from './iConstraint'
import {LockPosition} from './lockPosition'

export class FastIncrementalLayoutSettings {
  get edgeRoutingSettings() {
    return this.commonSettings.edgeRoutingSettings
  }
  set edgeRoutingSettings(value: EdgeRoutingSettings) {
    this.commonSettings.edgeRoutingSettings = value
  }
  commonSettings: CommonLayoutSettings = new CommonLayoutSettings()
  get PackingAspectRatio() {
    return this.commonSettings.PackingAspectRatio
  }
  set PackingAspectRatio(value: number) {
    this.commonSettings.PackingAspectRatio = value
  }
  get NodeSeparation() {
    return this.commonSettings.NodeSeparation
  }
  set NodeSeparation(value: number) {
    this.commonSettings.NodeSeparation = value
  }
  ///  <summary>
  ///  Stop after maxIterations completed
  ///  </summary>
  maxIterations = 100
  clusterMargin = 10

  ///  <summary>
  ///  Stop after maxIterations completed
  ///  </summary>
  public get MaxIterations(): number {
    return this.maxIterations
  }
  public set MaxIterations(value: number) {
    this.maxIterations = value
  }

  minorIterations = 3

  ///  <summary>
  ///  Number of iterations in inner loop.
  ///  </summary>
  public get MinorIterations(): number {
    return this.minorIterations
  }
  public set MinorIterations(value: number) {
    this.minorIterations = value
  }

  iterations: number

  ///  <summary>
  ///  Number of iterations completed
  ///  </summary>
  public get Iterations(): number {
    return this.iterations
  }
  public set Iterations(value: number) {
    this.iterations = value
  }

  projectionIterations = 5

  ///  <summary>
  ///  number of times to project over all constraints at each layout iteration
  ///  </summary>
  public get ProjectionIterations(): number {
    return this.projectionIterations
  }
  public set ProjectionIterations(value: number) {
    this.projectionIterations = value
  }

  approximateRepulsion = true

  ///  <summary>
  ///  Rather than computing the exact repulsive force between all pairs of nodes (which would take O(n^2) time for n nodes)
  ///  use a fast inexact technique (that takes O(n log n) time)
  ///  </summary>
  public get ApproximateRepulsion(): boolean {
    return this.approximateRepulsion
  }
  public set ApproximateRepulsion(value: boolean) {
    this.approximateRepulsion = value
  }

  ///  <summary>
  ///  RungaKutta integration potentially gives smoother increments, but is more expensive
  ///  </summary>
  RungeKuttaIntegration = false

  initialStepSize = 1.4

  ///  <summary>
  ///  StepSize taken at each iteration (a coefficient of the force on each node) adapts depending on change in
  ///  potential energy at each step.  With this scheme changing the InitialStepSize doesn't have much effect
  ///  because if it is too large or too small it will be quickly updated by the algorithm anyway.
  ///  </summary>
  public get InitialStepSize(): number {
    return this.initialStepSize
  }
  public set InitialStepSize(value: number) {
    if (value <= 0 || value > 2) {
      throw new Error(
        'ForceScalar should be greater than 0 and less than 2 (if we let you set it to 0 nothing would happen, greater than 2 would most likely be very unstable!)',
      )
    }

    this.initialStepSize = value
  }

  decay = 0.9

  ///  <summary>
  ///  FrictionalDecay isn't really friction so much as a scaling of velocity to improve convergence.  0.8 seems to work well.
  ///  </summary>
  public get Decay(): number {
    return this.decay
  }
  public set Decay(value: number) {
    if (value < 0.1 || value > 1) {
      throw new Error('Setting decay too small gives no progress.  1==no decay, 0.1==minimum allowed value')
    }

    this.decay = value
  }

  private friction = 0.8

  ///  <summary>
  ///  Friction isn't really friction so much as a scaling of velocity to improve convergence.  0.8 seems to work well.
  ///  </summary>
  public get Friction(): number {
    return this.friction
  }
  public set Friction(value: number) {
    if (value < 0 || value > 1) {
      throw new Error(
        'Setting friction less than 0 or greater than 1 would just be strange.  1==no friction, 0==no conservation of velocity',
      )
    }

    this.friction = value
  }

  repulsiveForceConstant = 1

  ///  <summary>
  ///  strength of repulsive force between each pair of nodes.  A setting of 1.0 should work OK.
  ///  </summary>
  public get RepulsiveForceConstant(): number {
    return this.repulsiveForceConstant
  }
  public set RepulsiveForceConstant(value: number) {
    this.repulsiveForceConstant = value
  }

  attractiveForceConstant = 1

  ///  <summary>
  ///  strength of attractive force between pairs of nodes joined by an edge.  A setting of 1.0 should work OK.
  ///  </summary>
  public get AttractiveForceConstant(): number {
    return this.attractiveForceConstant
  }
  public set AttractiveForceConstant(value: number) {
    this.attractiveForceConstant = value
  }

  gravity = 1

  ///  <summary>
  ///  gravity is a constant force applied to all nodes attracting them to the Origin
  ///  and keeping disconnected components from flying apart.  A setting of 1.0 should work OK.
  ///  </summary>
  public get GravityConstant(): number {
    return this.gravity
  }
  public set GravityConstant(value: number) {
    this.gravity = value
  }

  interComponentForces = true

  ///  <summary>
  ///  If the following is false forces will not be considered between each component and each component will have its own gravity origin.
  ///  </summary>
  public get InterComponentForces(): boolean {
    return this.interComponentForces
  }
  public set InterComponentForces(value: boolean) {
    this.interComponentForces = value
  }

  applyForces = true

  ///  <summary>
  ///  If the following is false forces will not be applied, but constraints will still be satisfied.
  ///  </summary>
  public get ApplyForces(): boolean {
    return this.applyForces
  }
  public set ApplyForces(value: boolean) {
    this.applyForces = value
  }

  algorithm: FastIncrementalLayout

  locks: LinkedList<LockPosition> = new LinkedList<LockPosition>()

  ///  <summary>
  ///  Add a LockPosition for each node whose position you want to keep fixed.  LockPosition allows you to,
  ///  for example, do interactive mouse
  ///   dragging.
  ///  We return the LinkedListNode which you can store together with your local GeomNode object so that a RemoveLock operation can be performed in
  ///  constant time.
  ///  </summary>
  ///  <param name="node"></param>
  ///  <param name="bounds"></param>
  ///  <returns>LinkedListNode which you should hang on to if you want to call RemoveLock later on.</returns>
  public CreateLockNR(node: GeomNode, bounds: Rectangle): LockPosition {
    const lp: LockPosition = new LockPosition(node, bounds, (g) => this.algorithm.getRB(g))
    lp.listNode = this.locks.push(lp)
    return lp
  }

  ///  <summary>
  ///  Add a LockPosition for each node whose position you want to keep fixed.  LockPosition allows you to,
  ///  for example, do interactive mouse dragging.
  ///  We return the LinkedListNode which you can store together with your local GeomNode object so that a RemoveLock operation can be performed in
  ///  constant time.
  ///  </summary>
  ///  <param name="node"></param>
  ///  <param name="bounds"></param>
  ///  <param name="weight">stay weight of lock</param>
  ///  <returns>LinkedListNode which you should hang on to if you want to call RemoveLock later on.</returns>
  public CreateLock(node: GeomNode, bounds: Rectangle, weight: number): LockPosition {
    const lp: LockPosition = LockPosition.constructorNRN(node, bounds, weight, (g) => this.algorithm.getRB(g))
    lp.listNode = this.locks.push(lp)
    return lp
  }

  ///  <summary>
  ///  restart layout, use e.g. after a mouse drag or non-structural change to the graph
  ///  </summary>
  public ResetLayout() {
    this.Unconverge()
    if (this.algorithm != null) {
      this.algorithm.ResetNodePositions()
      this.algorithm.SetLockNodeWeights()
    }
  }

  ///  <summary>
  ///  reset iterations and convergence status
  ///  </summary>
  Unconverge() {
    this.iterations = 0
    // EdgeRoutesUpToDate = false;
    this.converged = false
  }

  ///  <summary>
  ///
  ///  </summary>
  public InitializeLayoutGN(graph: GeomGraph, initialConstraintLevel: number) {
    this.InitializeLayout(graph, initialConstraintLevel, () => this)
  }

  ///  <summary>
  ///  Initialize the layout algorithm
  ///  </summary>
  ///  <param name="graph">The graph upon which layout is performed</param>
  ///  <param name="initialConstraintLevel"></param>
  ///  <param name="clusterSettings"></param>
  public InitializeLayout(graph: GeomGraph, initialConstraintLevel: number, clusterSettings: (a: GeomGraph) => any) {
    this.algorithm = new FastIncrementalLayout(graph, this, initialConstraintLevel, clusterSettings)
    this.ResetLayout()
  }

  ///  <summary>
  ///
  ///  </summary>
  public Uninitialize() {
    this.algorithm = null
  }

  ///  <summary>
  ///
  ///  </summary>
  public get IsInitialized(): boolean {
    return this.algorithm != null
  }

  ///  <summary>
  ///
  ///  </summary>
  public IncrementalRunG(graph: GeomGraph) {
    this.IncrementalRunGF(graph, () => this)
  }

  private SetupIncrementalRun(graph: GeomGraph, clusterSettings: (g: GeomGraph) => any) {
    if (!this.IsInitialized) {
      this.InitializeLayout(graph, this.MaxConstraintLevel, clusterSettings)
    } else if (this.IsDone) {
      //  If we were already done from last time but we are doing more work then something has changed.
      this.ResetLayout()
    }
  }

  ///  <summary>
  ///  Run the FastIncrementalLayout instance incrementally
  ///  </summary>
  public IncrementalRunGF(graph: GeomGraph, clusterSettings: (a: GeomGraph) => any) {
    this.SetupIncrementalRun(graph, clusterSettings)
    this.algorithm.run()
    // graph.UpdateBoundingBox()
  }

  ///  <summary>
  ///
  ///  </summary>
  public IncrementalRun(cancelToken: CancelToken, graph: GeomGraph, clusterSettings: (a: GeomGraph) => any) {
    if (cancelToken != null) {
      cancelToken.throwIfCanceled()
    }

    this.SetupIncrementalRun(graph, clusterSettings)
    this.algorithm.cancelToken = cancelToken
    this.algorithm.run()
    // graph.UpdateBoundingBox()
  }

  ///  <summary>
  ///  Clones the object
  ///  </summary>
  ///  <returns></returns>
  Clone(): FastIncrementalLayoutSettings {
    return FastIncrementalLayoutSettings.ctorClone(this)
  }

  ///  <summary>
  ///
  ///  </summary>
  public get StructuralConstraints(): Iterable<IConstraint> {
    return this.structuralConstraints
  }

  ///  <summary>
  ///
  ///  </summary>
  public AddStructuralConstraint(cc: IConstraint) {
    this.structuralConstraints.push(cc)
  }

  structuralConstraints: Array<IConstraint> = new Array<IConstraint>()

  ///  <summary>
  ///  Clear all constraints over the graph
  ///  </summary>
  public ClearConstraints() {
    this.locks.clear()
    this.structuralConstraints = []
    //  clusterHierarchies.Clear();
  }

  ///  <summary>
  ///
  ///  </summary>
  public ClearStructuralConstraints() {
    this.structuralConstraints = []
  }

  ///  <summary>
  ///  Avoid overlaps between nodes boundaries, and if there are any
  ///  clusters, then between each cluster boundary and nodes that are not
  ///  part of that cluster.
  ///  </summary>
  AvoidOverlaps: boolean
  ///  <summary>
  ///  If edges have FloatingPorts then the layout will optimize edge lengths based on the port locations.
  ///  If MultiLocationFloatingPorts are specified then the layout will choose the nearest pair of locations for each such edge.
  ///  </summary>
  RespectEdgePorts: boolean

  ///  <summary>
  ///  Apply nice but expensive routing of edges once layout converges
  ///  </summary>
  RouteEdges: boolean

  approximateRouting = true

  ///  <summary>
  ///  If RouteEdges is true then the following is checked to see whether to do optimal shortest path routing
  ///  or use a sparse visibility graph spanner to do approximate---but much faster---shortest path routing
  ///  </summary>
  public get ApproximateRouting(): boolean {
    return this.approximateRouting
  }
  public set ApproximateRouting(value: boolean) {
    this.approximateRouting = value
  }

  logScaleEdgeForces = true

  ///  <summary>
  ///  If true then attractive forces across edges are computed as:
  ///  AttractiveForceConstant * actualLength * Math.Log((actualLength + epsilon) / (idealLength + epsilon))
  ///  where epsilon is a small positive constant to avoid divide by zero or taking the log of zero.
  ///  Note that LogScaleEdges can lead to ghost forces in highly constrained scenarios.
  ///  If false then a the edge force is based on (actualLength - idealLength)^2, which works better with
  ///  lots of constraints.
  ///  </summary>
  public get LogScaleEdgeForces(): boolean {
    return this.logScaleEdgeForces
  }
  public set LogScaleEdgeForces(value: boolean) {
    this.logScaleEdgeForces = value
  }

  displacementThreshold = 0.1

  ///  <summary>
  ///  If the amount of total squared displacement after a particular iteration falls below DisplacementThreshold then Converged is set to true.
  ///  Make DisplacementThreshold larger if you want layout to finish sooner - but not necessarily make as much progress towards a good layout.
  ///  </summary>
  public get DisplacementThreshold(): number {
    return this.displacementThreshold
  }
  public set DisplacementThreshold(value: number) {
    this.displacementThreshold = value
  }

  converged: boolean

  ///  <summary>
  ///  Set to true if displacement from the last iteration was less than DisplacementThreshold.
  ///  The caller should invoke FastIncrementalLayout.CalculateLayout() in a loop, e.g.:
  ///
  ///   while(!settings.Converged)
  ///   {
  ///     layout.CalculateLayout();
  ///     redrawGraphOrHandleInteractionOrWhatever();
  ///   }
  ///
  ///  RemainingIterations affects damping.
  ///  </summary>
  public get Converged(): boolean {
    return this.converged
  }
  public set Converged(value: boolean) {
    this.converged = value
  }

  ///  <summary>
  ///  Return iterations as a percentage of MaxIterations.  Useful for reporting progress, e.g. in a progress bar.
  ///  </summary>
  public get PercentDone(): number {
    if (this.Converged) {
      return 100
    } else {
      return <number>((100 * <number>this.iterations) / <number>this.MaxIterations)
    }
  }

  ///  <summary>
  ///  Not quite the same as Converged:
  ///  </summary>
  public get IsDone(): boolean {
    return this.Converged || this.iterations >= this.MaxIterations
  }

  ///  <summary>
  ///  Returns an estimate of the cost function calculated in the most recent iteration.
  ///  It's a float because FastIncrementalLayout.Energy is a volatile float so it
  ///  can be safely read from other threads
  ///  </summary>
  public get Energy(): number {
    if (this.algorithm != null) {
      return this.algorithm.energy
    }

    return 0
  }

  ///  <summary>
  ///  When layout is in progress the following is false.
  ///  When layout has converged, routes are populated and this is set to true to tell the UI that the routes can be drawn.
  ///  </summary>
  EdgeRoutesUpToDate: boolean

  maxConstraintLevel = 2

  ///  <summary>
  ///
  ///  </summary>
  public get MaxConstraintLevel(): number {
    return this.maxConstraintLevel
  }
  public set MaxConstraintLevel(value: number) {
    if (this.maxConstraintLevel != value) {
      this.maxConstraintLevel = value
      if (this.IsInitialized) {
        this.Uninitialize()
      }
    }
  }

  minConstraintLevel = 0

  ///  <summary>
  ///
  ///  </summary>
  public get MinConstraintLevel(): number {
    return this.minConstraintLevel
  }
  public set MinConstraintLevel(value: number) {
    this.minConstraintLevel = value
  }

  ///  <summary>
  ///  Constraint level ranges from Min to MaxConstraintLevel.
  ///  0 = no constraints
  ///  1 = only structural constraints
  ///  2 = all constraints including non-overlap constraints
  ///
  ///  A typical run of FastIncrementalLayout will apply it at each constraint level, starting at 0 to
  ///  obtain an untangled unconstrained layout, then 1 to introduce structural constraints and finally 2 to beautify.
  ///  Running only at level 2 will most likely leave the graph stuck in a tangled local minimum.
  ///  </summary>
  public getCurrentConstraintLevel(): number {
    if (this.algorithm == null) {
      return 0
    }

    return this.algorithm.getCurrentConstraintLevel()
  }
  public setCurrentConstraintLevel(value: number) {
    this.algorithm.setCurrentConstraintLevel(value)
  }

  attractiveInterClusterForceConstant = 1

  ///  <summary>
  ///  Attractive strength of edges connected to clusters
  ///  </summary>
  public get AttractiveInterClusterForceConstant(): number {
    return this.attractiveInterClusterForceConstant
  }
  public set AttractiveInterClusterForceConstant(value: number) {
    this.attractiveInterClusterForceConstant = value
  }

  ///  <summary>
  ///  Shallow copy the settings
  ///  </summary>
  ///  <param name="previousSettings"></param>
  public static ctorClone(previousSettings: FastIncrementalLayoutSettings): FastIncrementalLayoutSettings {
    const ret = new FastIncrementalLayoutSettings()
    ret.maxIterations = previousSettings.maxIterations
    ret.minorIterations = previousSettings.minorIterations
    ret.projectionIterations = previousSettings.projectionIterations
    ret.approximateRepulsion = previousSettings.approximateRepulsion
    ret.initialStepSize = previousSettings.initialStepSize
    ret.RungeKuttaIntegration = previousSettings.RungeKuttaIntegration
    ret.decay = previousSettings.decay
    ret.friction = previousSettings.friction
    ret.repulsiveForceConstant = previousSettings.repulsiveForceConstant
    ret.attractiveForceConstant = previousSettings.attractiveForceConstant
    ret.gravity = previousSettings.gravity
    ret.interComponentForces = previousSettings.interComponentForces
    ret.applyForces = previousSettings.applyForces
    ret.edgeConstrains = previousSettings.edgeConstrains
    ret.AvoidOverlaps = previousSettings.AvoidOverlaps
    ret.RespectEdgePorts = previousSettings.RespectEdgePorts
    ret.RouteEdges = previousSettings.RouteEdges
    ret.approximateRouting = previousSettings.approximateRouting
    ret.logScaleEdgeForces = previousSettings.logScaleEdgeForces
    ret.displacementThreshold = previousSettings.displacementThreshold
    ret.minConstraintLevel = previousSettings.minConstraintLevel
    ret.maxConstraintLevel = previousSettings.maxConstraintLevel
    ret.attractiveInterClusterForceConstant = previousSettings.attractiveInterClusterForceConstant
    ret.clusterGravity = previousSettings.clusterGravity
    ret.PackingAspectRatio = previousSettings.PackingAspectRatio
    ret.NodeSeparation = previousSettings.NodeSeparation
    ret.clusterMargin = previousSettings.clusterMargin
    return ret
  }

  clusterGravity = 1

  ///  <summary>
  ///  Controls how tightly members of clusters are pulled together
  ///  </summary>
  public get ClusterGravity(): number {
    return this.clusterGravity
  }
  public set ClusterGravity(value: number) {
    this.clusterGravity = value
  }

  /**   Settings for calculation of ideal edge length*/
  edgeConstrains: EdgeConstraints = new EdgeConstraints()
  updateClusterBoundaries = true

  ///  <summary>
  ///  Force groups to follow their constituent nodes,
  ///  true by default.
  ///  </summary>
  public get UpdateClusterBoundariesFromChildren(): boolean {
    return this.updateClusterBoundaries
  }
  public set UpdateClusterBoundariesFromChildren(value: boolean) {
    this.updateClusterBoundaries = value
  }

  ///  <summary>
  ///      creates the settings that seems working
  ///  </summary>
  ///  <returns></returns>
  public static CreateFastIncrementalLayoutSettings(): FastIncrementalLayoutSettings {
    const f = new FastIncrementalLayoutSettings()
    f.ApplyForces = false
    f.ApproximateRepulsion = true
    f.ApproximateRouting = true
    f.AttractiveForceConstant = 1.0
    f.AttractiveInterClusterForceConstant = 1.0
    f.AvoidOverlaps = true
    f.ClusterGravity = 1.0
    f.Decay = 0.9
    f.DisplacementThreshold = 0.00000005
    f.Friction = 0.8
    f.GravityConstant = 1.0
    f.InitialStepSize = 2.0
    f.InterComponentForces = false
    f.Iterations = 0
    f.LogScaleEdgeForces = false
    f.MaxConstraintLevel = 2
    f.MaxIterations = 20
    f.MinConstraintLevel = 0
    f.MinorIterations = 1
    f.ProjectionIterations = 5
    f.RepulsiveForceConstant = 2.0
    f.RespectEdgePorts = false
    f.RouteEdges = false
    f.RungeKuttaIntegration = true
    f.UpdateClusterBoundariesFromChildren = true
    f.NodeSeparation = 20
    return f
  }
}
