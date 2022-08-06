import { Algorithm } from "../../utils/algorithm";    

import { BasicGraphOnEdges } from "../../structs/basicGraphOnEdges";
import { FiEdge } from "./fiEdge";
import { FiNode } from "./fiNode";
import { IConstraint } from "./iConstraint";
import { Point } from "../../math/geometry";
import { Edge } from "../../structs/edge";
import { GeomGraph } from "../core";
import { FloatingPort } from "../core/floatingPort";
import { FastIncrementalLayoutSettings } from "./fastIncrementalLayoutSettings";
import { AxisSolver } from "./axisSolver";
import { LayoutSettings } from "../layered/SugiyamaLayoutSettings";
import { IGeomGraph } from "../initialLayout/iGeomGraph";
    ///  <summary>
    ///  Fast incremental layout is a force directed layout strategy with approximate computation of long-range node-node repulsive forces to achieve O(n log n) running time per iteration.
    ///  It can be invoked on an existing layout (for example, as computed by MDS) to beautify it.  See docs for CalculateLayout method (below) to see how to use it incrementally.
    ///  
    ///  Note that in debug mode lots of numerical checking is applied, which slows things down considerably.  So, run in Release mode unless you're actually debugging!
    ///  </summary>
    export class FastIncrementalLayout extends Algorithm {
        
        basicGraph: BasicGraphOnEdges<FiEdge>;
        
        components: Array<FiNode[]>;
        
         constraints: Map<number, Array<IConstraint>> = new Map<number, Array<IConstraint>>();
        
        edges: Array<FiEdge> = new Array<FiEdge>();
        
        ///  <summary>
        ///  Returns the derivative of the cost function calculated in the most recent iteration.
        ///  It's a volatile float so that we can potentially access it from other threads safely,
        ///  for example during test.
        ///  </summary>
         energy: number;
        
        graph: IGeomGraph;
        
        horizontalSolver: AxisSolver;
        
        ///  <summary>
        ///  Construct a graph by adding nodes and edges to these lists
        ///  </summary>
        nodes: FiNode[];
        
        progress: number;
        
        settings: FastIncrementalLayoutSettings;
        
        stepSize: number;
        
        verticalSolver: AxisSolver;
        
        clusterSettings: (g:GeomGraph)=> LayoutSettings;
        
        clusterEdges: Array<Edge> = new Array<Edge>();
        
        ///  <summary>
        ///  Create the graph data structures.
        ///  </summary>
        ///  <param name="geometryGraph"></param>
        ///  <param name="settings">The settings for the algorithm.</param>
        ///  <param name="initialConstraintLevel">initialize at this constraint level</param>
        ///  <param name="clusterSettings">settings by cluster</param>
         constructor (geometryGraph: IGeomGraph, settings: FastIncrementalLayoutSettings, initialConstraintLevel: number, clusterSettings: (g:GeomGraph)=>LayoutSettings) {
            super(null)
            this.graph = geometryGraph;
            this.settings = this.settings;
            this.clusterSettings = this.clusterSettings;
            let i: number = 0;
            this.nodes = new Array(geometryGraph.Count);
            for (let v: Node in allNodes) {
                this.nodes[i] = new FiNode(i, v);
                v.AlgorithmData = new FiNode(i, v);
                i++;
            }
            
            this.clusterEdges.Clear();
            this.edges.Clear();
            for (let e: Edge in this.graph.Edges) {
                if ((e.Source instanceof  ((Cluster || e.Target) instanceof  Cluster))) {
                    this.clusterEdges.Add(e);
                }
                else {
                    this.edges.Add(new FiEdge(e));
                }
                
                for (let l in e.Labels) {
                    l.OuterPoints = null;
                }
                
                l.InnerPoints = null;
            }
            
            this.SetLockNodeWeights();
            this.components = new Array<FiNode[]>();
            if (!this.settings.InterComponentForces) {
                this.basicGraph = new BasicGraphOnEdges<FiEdge>(this.edges, this.nodes.Length);
                for (let componentNodes in ConnectedComponentCalculator.GetComponents(this.basicGraph)) {
                    let vs = new Array(componentNodes.Count());
                    let vi: number = 0;
                    for (let v: number in componentNodes) {
                        vs[vi++] = this.nodes[v];
                    }
                    
                    this.components.Add(vs);
                }
                
            }
            else {
                this.components.Add(this.nodes);
            }
            
            this.horizontalSolver = new AxisSolver(true, this.nodes, new, [);
            geometryGraph.RootCluster;
            this.settings.AvoidOverlaps;
            this.settings.MinConstraintLevel;
            this.clusterSettings;
            OverlapRemovalParameters = [][
                    AllowDeferToVertical=true,
                    ConsiderProportionalOverlap=settings.ApplyForces];
            
            this.verticalSolver = new AxisSolver(false, this.nodes, new, [);
            geometryGraph.RootCluster;
            this.settings.AvoidOverlaps;
            this.settings.MinConstraintLevel;
            this.clusterSettings;
            this.SetupConstraints();
            geometryGraph.RootCluster.ComputeWeight();
            for (let c: Cluster in geometryGraph.RootCluster.AllClustersDepthFirst().Where(() => {  }, (c.RectangularBoundary == null))) {
                c.RectangularBoundary = new RectangularClusterBoundary();
            }
            
            CurrentConstraintLevel = initialConstraintLevel;
        }
        
        SetupConstraints() {
            this.AddConstraintLevel(0);
            if (this.settings.AvoidOverlaps) {
                this.AddConstraintLevel(2);
            }
            
            for (let c: IConstraint in this.settings.StructuralConstraints) {
                this.AddConstraintLevel(c.Level);
                if ((c instanceof  VerticalSeparationConstraint)) {
                    this.verticalSolver.AddStructuralConstraint(c);
                }
                else if ((c instanceof  HorizontalSeparationConstraint)) {
                    this.horizontalSolver.AddStructuralConstraint(c);
                }
                else {
                    this.AddConstraint(c);
                }
                
            }
            
            EdgeConstraintGenerator.GenerateEdgeConstraints(this.graph.Edges, this.settings.IdealEdgeLength, this.horizontalSolver, this.verticalSolver);
        }
        
        currentConstraintLevel: number;
        
        ///  <summary>
        ///  Controls which constraints are applied in CalculateLayout.  Setter enforces feasibility at that level.
        ///  </summary>
         get CurrentConstraintLevel(): number {
            return this.currentConstraintLevel;
        }
         set CurrentConstraintLevel(value: number)  {
            this.currentConstraintLevel = value;
            this.horizontalSolver.ConstraintLevel = value;
            this.verticalSolver.ConstraintLevel = value;
            Feasibility.Enforce(this.settings, value, this.nodes, this.horizontalSolver.structuralConstraints, this.verticalSolver.structuralConstraints, new, [);
            this.graph.RootCluster;
            this.clusterSettings;
            this.settings.Unconverge();
        }
        
        ///  <summary>
        ///  Add constraint to constraints lists.  Warning, no check that dictionary alread holds a list for the level.
        ///  Make sure you call AddConstraintLevel first (perf).
        ///  </summary>
        ///  <param name="c"></param>
        AddConstraint(c: IConstraint) {
            if (!this.constraints.ContainsKey(c.Level)) {
                this.constraints[c.Level] = new Array<IConstraint>();
            }
            
            this.constraints[c.Level].Add(c);
        }
        
        ///  <summary>
        ///  Check for constraint level in dictionary, if it doesn't exist add the list at that level.
        ///  </summary>
        ///  <param name="level"></param>
        AddConstraintLevel(level: number) {
            if (!this.constraints.ContainsKey(level)) {
                this.constraints[level] = new Array<IConstraint>();
            }
            
        }
        
         SetLockNodeWeights() {
            for (let l: LockPosition in this.settings.locks) {
                l.SetLockNodeWeight();
            }
            
        }
        
         ResetNodePositions() {
            for (let v: FiNode in this.nodes) {
                v.ResetBounds();
            }
            
            for (let e in this.edges) {
                for (let l in e.mEdge.Labels) {
                    l.OuterPoints = null;
                    l.InnerPoints = null;
                }
                
            }
            
        }
        
        AddRepulsiveForce(v: FiNode, repulsion: Point) {
            //  scale repulsion
            v.force = (10 
                        * (this.settings.RepulsiveForceConstant * repulsion));
        }
        
        AddLogSpringForces(e: FiEdge, duv: Point, d: number) {
            let f: number = (0.0007 
                        * (this.settings.AttractiveForceConstant 
                        * (l * Math.Log(((l + 0.1) 
                            / (d + 0.1))))));
            let l: number = duv.Length;
            e.source.force = (e.source.force 
                        + (f * duv));
            e.target.force = (e.target.force 
                        - (f * duv));
        }
        
        AddSquaredSpringForces(e: FiEdge, duv: Point, d: number) {
            let f: number = (this.settings.AttractiveForceConstant 
                        * ((l - d) 
                        / d2));
            let l: number = duv.Length;
            let d2: number = ((d * d) 
                        + 0.1);
            e.source.force = (e.source.force 
                        + (f * duv));
            e.target.force = (e.target.force 
                        - (f * duv));
        }
        
        AddSpringForces(e: FiEdge) {
            let duv: Point;
            if (this.settings.RespectEdgePorts) {
                let sourceLocation = e.source.Center;
                let targetLocation = e.target.Center;
                let sourceFloatingPort = (<FloatingPort>(e.mEdge.SourcePort));
                if ((sourceFloatingPort != null)) {
                    sourceLocation = sourceFloatingPort.Location;
                }
                
                let targetFloatingPort = (<FloatingPort>(e.mEdge.TargetPort));
                if ((targetFloatingPort != null)) {
                    targetLocation = targetFloatingPort.Location;
                }
                
                duv = (sourceLocation - targetLocation);
            }
            else {
                duv = e.vector();
            }
            
            if (this.settings.LogScaleEdgeForces) {
                this.AddLogSpringForces(e, duv, e.mEdge.Length);
            }
            else {
                this.AddSquaredSpringForces(e, duv, e.mEdge.Length);
            }
            
        }
        
        static AddGravityForce(origin: Point, gravity: number, v: FiNode) {
            //  compute and add gravity
            v.force = (v.force - (0.0001 
                        * (gravity 
                        * (origin - v.Center))));
        }
        
        ComputeRepulsiveForces(vs: FiNode[]) {
            let n: number = vs.Length;
            if (((n > 16) 
                        && this.settings.ApproximateRepulsion)) {
                let ps = new Array(vs.Length);
                //  before calculating forces we perturb each center by a small vector in a unique
                //  but deterministic direction (by walking around a circle in n steps) - this allows
                //  the KD-tree to decompose even when some nodes are at exactly the same position
                let angleDelta: number = (2 
                            * (Math.PI / n));
                let angle: number = 0;
                for (let i: number = 0; (i < n); i++) {
                    ps[i] = new KDTree.Particle((vs[i].Center + (1E-05 * new Point(Math.Cos(angle), Math.Sin(angle)))));
                    angle = (angle + angleDelta);
                }
                
                let kdTree = new KDTree(ps, 8);
                kdTree.ComputeForces(5);
                for (let i: number = 0; (i < vs.Length); i++) {
                    this.AddRepulsiveForce(vs[i], ps[i].force);
                }
                
            }
            else {
                for (let u: FiNode in vs) {
                    let fu = new Point();
                    for (let v: FiNode in vs) {
                        if ((u != v)) {
                            fu = (fu + MultipoleCoefficients.Force(u.Center, v.Center));
                        }
                        
                    }
                    
                    this.AddRepulsiveForce(u, fu);
                }
                
            }
            
        }
        
        AddClusterForces(root: Cluster) {
            if ((root == null)) {
                return;
            }
            
            //  SetBarycenter is recursive.
            root.SetBarycenter();
            //  The cluster edges draw the barycenters of the connected clusters together
            for (let e in this.clusterEdges) {
                //  foreach cluster keep a force vector.  Replace ForEachNode calls below with a simple
                //  addition to this force vector.  Traverse top down, tallying up force vectors of children
                //  to be the sum of their parents.
                let c1 = (<Cluster>(e.Source));
                let c2 = (<Cluster>(e.Target));
                let n1 = (<FiNode>(e.Source.AlgorithmData));
                let n2 = (<FiNode>(e.Target.AlgorithmData));
                let center1: Point = c1.Barycenter;
                // TODO: Warning!!!, inline IF is not supported ?
                (c1 != null);
                n1.Center;
                let center2: Point = c2.Barycenter;
                // TODO: Warning!!!, inline IF is not supported ?
                (c2 != null);
                n2.Center;
                let duv: Point = (center1 - center2);
                let f: number = (1E-08 
                            * (this.settings.AttractiveInterClusterForceConstant 
                            * (l * Math.Log((l + 0.1)))));
                let l: number = duv.Length;
                if ((c1 != null)) {
                    let fv = (<FiNode>(v.AlgorithmData));
                    fv.force = (fv.force 
                                + (f * duv));
                    // Warning!!! Lambda constructs are not supported
                    c1.ForEachNode(() => {  });
                }
                else {
                    n1.force = (n1.force 
                                + (f * duv));
                }
                
                if ((c2 != null)) {
                    let fv = (<FiNode>(v.AlgorithmData));
                    fv.force = (fv.force 
                                - (f * duv));
                    // Warning!!! Lambda constructs are not supported
                    c2.ForEachNode(() => {  });
                }
                else {
                    n2.force = (n2.force 
                                - (f * duv));
                }
                
            }
            
            for (let c: Cluster in root.AllClustersDepthFirst()) {
                if ((c != root)) {
                    c.ForEachNode(() => {  }, FastIncrementalLayout.AddGravityForce(c.Barycenter, this.settings.ClusterGravity, (<FiNode>(v.AlgorithmData))));
                }
                
            }
            
        }
        
        ///  <summary>
        ///  Aggregate all the forces affecting each node
        ///  </summary>
        ComputeForces() {
            if ((this.components != null)) {
                this.components.ForEach(ComputeRepulsiveForces);
            }
            else {
                this.ComputeRepulsiveForces(this.nodes);
            }
            
            this.edges.ForEach(AddSpringForces);
            for (let c in this.components) {
                let origin = new Point();
                for (let i: number = 0; (i < c.Length); i++) {
                    origin = (origin + c[i].Center);
                }
                
                (<number>(c.Length));
                let maxForce: number = double.NegativeInfinity;
                for (let i: number = 0; (i < c.Length); i++) {
                    let v: FiNode = c[i];
                    FastIncrementalLayout.AddGravityForce(origin, this.settings.GravityConstant, v);
                    if ((v.force.Length > maxForce)) {
                        maxForce = v.force.Length;
                    }
                    
                }
                
                if ((maxForce > 100)) {
                    for (let i: number = 0; (i < c.Length); i++) {
                        c[i].force = (c[i].force * (100 / maxForce));
                    }
                    
                }
                
            }
            
            //  This is the only place where ComputeForces (and hence verletIntegration) considers clusters.
            //  It's just adding a "gravity" force on nodes inside each cluster towards the barycenter of the cluster.
            this.AddClusterForces(this.graph.RootCluster);
        }
        
        SatisfyConstraints() {
            for (let i: number = 0; (i < this.settings.ProjectionIterations); i++) {
                for (let level in this.constraints.Keys) {
                    if ((level > this.CurrentConstraintLevel)) {
                        break;
                    }
                    
                    for (let c in this.constraints[level]) {
                        c.Project();
                        //  c.Project operates only on MSAGL nodes, so need to update the local FiNode.Centers
                        for (let v in c.Nodes) {
                            (<FiNode>(v.AlgorithmData)).Center = v.Center;
                        }
                        
                    }
                    
                }
                
                for (let l: LockPosition in this.settings.locks) {
                    l.Project();
                    //  again, project operates only on MSAGL nodes, we'll also update FiNode.PreviousPosition since we don't want any inertia in this case
                    for (let v in l.Nodes) {
                        let fiNode: FiNode = (<FiNode>(v.AlgorithmData));
                        //  the locks should have had their AlgorithmData updated, but if (for some reason)
                        //  the locks list is out of date we don't want to null ref here.
                        if (((fiNode != null) 
                                    && (v.AlgorithmData != null))) {
                            fiNode.ResetBounds();
                        }
                        
                    }
                    
                }
                
            }
            
        }
        
        ///  <summary>
        ///  Checks if solvers need to be applied, i.e. if there are user constraints or 
        ///  generated constraints (such as non-overlap) that need satisfying
        ///  </summary>
        ///  <returns></returns>
        NeedSolve(): boolean {
            return (this.horizontalSolver.NeedSolve || this.verticalSolver.NeedSolve);
        }
        
        ///  <summary>
        ///  Force directed layout is basically an iterative approach to solving a bunch of differential equations.
        ///  Different integration schemes are possible for applying the forces iteratively.  Euler is the simplest:
        ///   v_(i+1) = v_i + a dt
        ///   x_(i+1) = x_i + v_(i+1) dt
        ///  
        ///  Verlet is much more stable (and not really much more complicated):
        ///   x_(i+1) = x_i + (x_i - x_(i-1)) + a dt dt
        ///  </summary>
        VerletIntegration(): number {
            //  The following sets the Centers of all nodes to a (not necessarily feasible) configuration that reduces the cost (forces)
            let energy0: number = this.energy;
            this.energy = (<number>(this.ComputeDescentDirection(1)));
            this.UpdateStepSize(energy0);
            this.SolveSeparationConstraints();
            let displacementSquared: number = 0;
            for (let i: number = 0; (i < this.nodes.Length); i++) {
                let v: FiNode = this.nodes[i];
                displacementSquared = (displacementSquared + (v.Center - v.previousCenter).LengthSquared);
            }
            
            return displacementSquared;
        }
        
        SolveSeparationConstraints() {
            if (this.NeedSolve()) {
                //  Increasing the padding effectively increases the size of the rectangle, so it will lead to more overlaps,
                //  and therefore tighter packing once the overlap is removed and therefore more apparent "columnarity".
                //  We don't want to drastically change the shape of the rectangles, just increase them ever so slightly so that
                //  there is a bit more space in the horizontal than vertical direction, thus reducing the likelihood that
                //  the vertical constraint generation will detect spurious overlaps, which should allow the nodes to slide
                //  smoothly around each other.  ConGen padding args are:  First pad is in direction of the constraints being
                //  generated, second pad is in the perpendicular direction.
                let dblVpad: number = this.settings.NodeSeparation;
                let dblHpad: number = (dblVpad + Feasibility.Pad);
                let dblCVpad: number = this.settings.ClusterMargin;
                let dblCHpad: number = (dblCVpad + Feasibility.Pad);
                //  The centers are our desired positions, but we need to find a feasible configuration
                for (let v: FiNode in this.nodes) {
                    v.desiredPosition = v.Center;
                }
                
                //  Set up horizontal non-overlap constraints based on the (feasible) starting configuration
                this.horizontalSolver.Initialize(dblHpad, dblVpad, dblCHpad, dblCVpad, () => {  }, v.previousCenter);
                this.horizontalSolver.SetDesiredPositions();
                this.horizontalSolver.Solve();
                //  generate y constraints
                this.verticalSolver.Initialize(dblHpad, dblVpad, dblCHpad, dblCVpad, () => {  }, v.Center);
                this.verticalSolver.SetDesiredPositions();
                this.verticalSolver.Solve();
                //  If we have multiple locks (hence multiple high-weight nodes), there can still be some
                //  movement of the locked variables - so update all lock positions.
                for (let l: LockPosition in this.settings.locks.Where(() => {  }, !l.Sticky)) {
                    l.Bounds = l.node.BoundingBox;
                }
                
            }
            
        }
        
        ComputeDescentDirection(alpha: number): number {
            this.ResetForceVectors();
            //  velocity is the distance travelled last time step
            if (this.settings.ApplyForces) {
                this.ComputeForces();
            }
            
            let lEnergy: number = 0;
            for (let v: FiNode in this.nodes) {
                lEnergy = (lEnergy + v.force.LengthSquared);
                let dx: Point = (v.Center - v.previousCenter);
                v.previousCenter = v.Center;
                dx = (dx * this.settings.Friction);
                let a: Point = ((this.stepSize 
                            * (alpha * v.force)) 
                            * -1);
                Debug.Assert(!number.IsNaN(a.X), "!double.IsNaN(a.X)");
                Debug.Assert(!number.IsNaN(a.Y), "!double.IsNaN(a.Y)");
                Debug.Assert(!number.IsInfinity(a.X), "!double.IsInfinity(a.X)");
                Debug.Assert(!number.IsInfinity(a.Y), "!double.IsInfinity(a.Y)");
                dx = (dx + a);
                v.stayWeight;
                v.Center = (v.Center + dx);
            }
            
            this.SatisfyConstraints();
            return lEnergy;
        }
        
        ResetForceVectors() {
            for (let v in this.nodes) {
                v.force = new Point();
            }
            
        }
        
        ///  <summary>
        ///  Adapt StepSize based on change in energy.  
        ///  Five sequential improvements in energy mean we increase the stepsize.
        ///  Any increase in energy means we reduce the stepsize.
        ///  </summary>
        ///  <param name="energy0"></param>
        UpdateStepSize(energy0: number) {
            if ((this.energy < energy0)) {
                this.progress = 0;
                this.settings.Decay;
            }
            
        }
    }
}

    
    RungeKuttaIntegration(): number {
        let y0 = new Array(nodes.Length);
        let k1 = new Array(nodes.Length);
        let k2 = new Array(nodes.Length);
        let k3 = new Array(nodes.Length);
        let k4 = new Array(nodes.Length);
        let energy0: number = energy;
        SatisfyConstraints();
        for (let i: number = 0; (i < nodes.Length); i++) {
            nodes[i].previousCenter = nodes[i].Center;
            y0[i] = nodes[i].Center;
        }
        
        const let alpha: number = 3;
        ComputeDescentDirection(alpha);
        for (let i: number = 0; (i < nodes.Length); i++) {
            k1[i] = (nodes[i].Center - nodes[i].previousCenter);
            nodes[i].Center = (y0[i] + (0.5 * k1[i]));
        }
        
        ComputeDescentDirection(alpha);
        for (let i: number = 0; (i < nodes.Length); i++) {
            k2[i] = (nodes[i].Center - nodes[i].previousCenter);
            nodes[i].previousCenter = y0[i];
            nodes[i].Center = (y0[i] + (0.5 * k2[i]));
        }
        
        ComputeDescentDirection(alpha);
        for (let i: number = 0; (i < nodes.Length); i++) {
            k3[i] = (nodes[i].Center - nodes[i].previousCenter);
            nodes[i].previousCenter = y0[i];
            nodes[i].Center = (y0[i] + k3[i]);
        }
        
        energy = (<number>(ComputeDescentDirection(alpha)));
        for (let i: number = 0; (i < nodes.Length); i++) {
            k4[i] = (nodes[i].Center - nodes[i].previousCenter);
            nodes[i].previousCenter = y0[i];
            let dx: Point = ((k1[i] 
                        + ((2 * k2[i]) 
                        + ((2 * k3[i]) 
                        + k4[i]))) 
                        / 6);
            nodes[i].Center = (y0[i] + dx);
        }
        
        UpdateStepSize(energy0);
        SolveSeparationConstraints();
        return this.nodes.Sum(() => {  }, (v.Center - v.previousCenter).LengthSquared);
    }
    
    ///  <summary>
    ///  Apply a small number of iterations of the layout.  
    ///  The idea of incremental layout is that settings.minorIterations should be a small number (e.g. 3) and 
    ///  CalculateLayout should be invoked in a loop, e.g.:
    ///  
    ///  while(settings.RemainingIterations > 0) {
    ///     fastIncrementalLayout.CalculateLayout();
    ///     InvokeYourProcedureToRedrawTheGraphOrHandleInteractionEtc();
    ///  }
    ///  
    ///  In the verletIntegration step above, the RemainingIterations is used to control damping.
    ///  </summary>
    protected /* override */ run() {
        settings.Converged = false;
        settings.EdgeRoutesUpToDate = false;
        0;
        stepSize = settings.InitialStepSize;
        energy = float.MaxValue;
        progress = 0;
        this.StartListenToLocalProgress(settings.MinorIterations);
        for (let i: number = 0; (i < settings.MinorIterations); i++) {
            let d2: number = RungeKuttaIntegration();
            // TODO: Warning!!!, inline IF is not supported ?
            settings.RungeKuttaIntegration;
            VerletIntegration();
            if (((d2 < settings.DisplacementThreshold) 
                        || (settings.Iterations > settings.MaxIterations))) {
                settings.Converged = true;
                this.ProgressComplete();
                break;
            }
            
            ProgressStep();
        }
        
        FinalizeClusterBoundaries();
    }
    
    ///  <summary>
    ///  Simply does a depth first traversal of the cluster hierarchies fitting Rectangles to the contents of the cluster
    ///  or updating the cluster BoundingBox to the already calculated RectangularBoundary
    ///  </summary>
    FinalizeClusterBoundaries() {
        for (let c in graph.RootCluster.AllClustersDepthFirst()) {
            if ((c == graph.RootCluster)) {
                // TODO: Warning!!! continue If
            }
            
            if ((!this.NeedSolve() 
                        && settings.UpdateClusterBoundariesFromChildren)) {
                //  if we are not using the solver (e.g. when constraintLevel == 0) then we need to get the cluster bounds manually
                c.CalculateBoundsFromChildren(this.settings.ClusterMargin);
            }
            else {
                c.BoundingBox = c.RectangularBoundary.Rect;
            }
            
            c.RaiseLayoutDoneEvent();
        }
        
    }