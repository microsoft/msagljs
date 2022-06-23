import { Point, Rectangle, Polyline, Curve } from "../../math/geometry";
import { SplineRouter } from "../../routing/splineRouter";
import { Edge } from "../../structs/edge";
import { GeomEdge } from "../core/geomEdge";
import { GeomGraph } from "../core/GeomGraph";
import { GeomNode } from "../core/geomNode";
import { LayoutSettings } from "../layered/SugiyamaLayoutSettings";
import { BumperPusher } from "./bumperPusher";
import { LabelFixture } from "./labelFixture";


 export class IncrementalDragger {
        geomGraph:GeomGraph
        get graph(): GeomGraph {
            return this.geomGraph
        }
        set graph(value: GeomGraph)  {
        }
        
        nodeSeparation: number;
        
        layoutSettings: LayoutSettings;
        
        listOfPushers = new Array<BumperPusher>();
        
        pushingNodesArray: GeomNode[];
        

        ///  it is smaller graph that needs to be refreshed by the viewer

        public ChangedGraph: GeomGraph;
        
        labelFixtures: Map<GeomEdge, LabelFixture> = new Map<GeomEdge, LabelFixture>();
        

        ///  

        ///  <param name="pushingNodes">the nodes are already at the correct positions</param>
        ///  <param name="graph"></param>
        ///  <param name="layoutSettings"></param>
        public constructor (pushingNodes: IEnumerable<GeomNode>, graph: GeomGraph, layoutSettings: LayoutAlgorithmSettings) {
            this.graph = this.graph;
            this.nodeSeparation = this.layoutSettings.NodeSeparation;
            this.layoutSettings = this.layoutSettings;
            pushingNodes.ToArray();
            Debug.Assert((this.pushingNodesArray.All(() => {  }, (IncrementalDragger.DefaultClusterParent(n) == null)) 
                            || (new Set<GeomNode>(this.pushingNodesArray.Select(() => {  }, n.ClusterParent)).Count == 1)), "dragged nodes have to belong to the same cluster");
            this.InitBumperPushers();
        }
        
        InitBumperPushers() {
            if ((this.pushingNodesArray.Length == 0)) {
                return;
            }
            
            let cluster = IncrementalDragger.DefaultClusterParent(this.pushingNodesArray[0]);
            if ((cluster == null)) {
                this.listOfPushers.Add(new BumperPusher(this.graph.Nodes, this.nodeSeparation, this.pushingNodesArray));
            }
            else {
                this.listOfPushers.Add(new BumperPusher(cluster.Nodes.Concat(cluster.Clusters), this.nodeSeparation, this.pushingNodesArray));
                for (
                ; true; 
                ) {
                    let pushingCluster = cluster;
                    cluster = IncrementalDragger.DefaultClusterParent(cluster);
                    if ((cluster == null)) {
                        // TODO: Warning!!! break;If
                    }
                    
                    this.listOfPushers.Add(new BumperPusher(cluster.Nodes.Concat(cluster.Clusters), this.nodeSeparation, new, [));
                    pushingCluster;
                }
                
            }
            
        }
        
        static DefaultClusterParent(n: GeomNode): Cluster {
            return n.ClusterParent;
        }
        
        RunPushers() {
            for (let i: number = 0; (i < this.listOfPushers.Count); i++) {
                let bumperPusher = this.listOfPushers[i];
                bumperPusher.PushNodes();
                let cluster = IncrementalDragger.DefaultClusterParent(bumperPusher.FirstPushingNode());
                if (((cluster == null) 
                            || (cluster == this.graph.RootCluster))) {
                    break;
                }
                
                let box = cluster.BoundaryCurve.BoundingBox;
                cluster.CalculateBoundsFromChildren(this.layoutSettings.ClusterMargin);
                Debug.Assert(cluster.Nodes.All(() => {  }, cluster.BoundingBox.Contains(n.BoundingBox)));
                let newBox = cluster.BoundaryCurve.BoundingBox;
                if ((newBox == box)) {
                    break;
                }
                
                this.listOfPushers[(i + 1)].UpdateRTreeByChangedNodeBox(cluster, box);
            }
            
        }
        

        ///  

        ///  <param name="delta"></param>
        public Drag(delta: Point) {
            if ((delta.Length > 0)) {
                for (let n in this.pushingNodesArray) {
                    n.Center = (n.Center + delta);
                    let cl = (<Cluster>(n));
                    if ((cl != null)) {
                        cl.DeepContentsTranslation(delta, true);
                    }
                    
                }
                
            }
            
            this.RunPushers();
            this.RouteChangedEdges();
        }
        
        RouteChangedEdges() {
            this.ChangedGraph = this.GetChangedFlatGraph();
            let changedClusteredGraph = LgInteractor.CreateClusteredSubgraphFromFlatGraph(this.ChangedGraph, this.graph);
            this.InitLabelFixtures(changedClusteredGraph);
            let router = new SplineRouter(changedClusteredGraph, this.layoutSettings.EdgeRoutingSettings.Padding, this.layoutSettings.EdgeRoutingSettings.PolylinePadding, this.layoutSettings.EdgeRoutingSettings.ConeAngle, this.layoutSettings.EdgeRoutingSettings.BundlingSettings);
            router.Run();
            this.PositionLabels(changedClusteredGraph);
        }
        
        PositionLabels(changedClusteredGraph: GeomGraph) {
            for (let edge in changedClusteredGraph.Edges) {
                this.PositionEdge(edge);
            }
            
        }
        
        PositionEdge(edge: Edge) {
            let lf: LabelFixture;
            if (!this.labelFixtures.TryGetValue(edge.GeomEdge, /* out */lf)) {
                return;
            }
            
            let curve = edge.Curve;
            let lenAtLabelAttachment = (curve.Length * lf.RelativeLengthOnCurve);
            let par = curve.GetParameterAtLength(lenAtLabelAttachment);
            let tang = curve.Derivative(par);
            let norm = (tang.Rotate90Cw().Normalize() * lf.NormalLength);
            // TODO: Warning!!!, inline IF is not supported ?
            lf.RightSide;
            tang.Rotate90Ccw();
            edge.Label.Center = (curve[par] + norm);
        }
        
        InitLabelFixtures(changedClusteredGraph: GeomGraph) {
            for (let edge in changedClusteredGraph.Edges) {
                this.InitLabelFixture(edge);
            }
            
        }
        
        InitLabelFixture(edge: Edge) {
            if ((edge.Label == null)) {
                return;
            }
            
            if (this.labelFixtures.ContainsKey(edge.GeomEdge)) {
                return;
            }
            
            let attachmentPar = edge.Curve.ClosestParameter(edge.Label.Center);
            let curve = edge.Curve;
            let tang = curve.Derivative(attachmentPar);
            let normal = tang.Rotate90Cw();
            let fromCurveToLabel = (edge.Label.Center - curve[attachmentPar]);
            let fixture = new LabelFixture();
            this.labelFixtures[edge.GeomEdge] = fixture;
        }
        
        GetChangedFlatGraph(): GeomGraph {
            let changedNodes = this.GetChangedNodes();
            let changedEdges = this.GetChangedEdges(changedNodes);
            for (let e in changedEdges) {
                changedNodes.Insert(e.Source);
                changedNodes.Insert(e.Target);
            }
            
            let changedGraph = [][
                    Nodes=newSimpleNodeCollection(changedNodesUnknown,
                    Edges=newSimpleEdgeCollection(changedEdgesUnknown];
            return changedGraph;
        }
        
        GetChangedEdges(changedNodes: Set<Node>): List<Edge> {
            let list = new List<Edge>();
            let box = Rectangle.CreateAnEmptyBox();
            for (let node in changedNodes) {
                box.Add(node.BoundaryCurve.BoundingBox);
            }
            
            let boxPoly = box.Perimeter();
            for (let e in this.graph.Edges) {
                if (this.EdgeNeedsRouting(/* ref */box, e, boxPoly, changedNodes)) {
                    list.Add(e);
                }
                
            }
            
            return list;
        }
        
        EdgeNeedsRouting(/* ref */box: Rectangle, edge: Edge, boxPolyline: Polyline, changedNodes: Set<Node>): boolean {
            if ((edge.Curve == null)) {
                return true;
            }
            
            if ((changedNodes.Contains(edge.Source) || changedNodes.Contains(edge.Target))) {
                return true;
            }
            
            if ((edge.Source.BoundaryCurve.BoundingBox.Intersects(box) || edge.Target.BoundaryCurve.BoundingBox.Intersects(box))) {
                return true;
            }
            
            if (!edge.BoundingBox.Intersects(box)) {
                return false;
            }
            
            return (Curve.CurveCurveIntersectionOne(boxPolyline, edge.Curve, false) != null);
        }
        
        GetChangedNodes(): Set<Node> {
            return new Set<Node>(this.listOfPushers.SelectMany(() => {  }, p.FixedNodes));
        }
    }