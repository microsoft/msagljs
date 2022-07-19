    
    ///  <summary>
    ///  Solver for structural separation constraints or non-overlap constraints in a single axis.
    ///  Wrapper round all the ProjectionSolver stuff.

import { Rectangle } from "../../math/geometry";
import { BorderInfo } from "../../math/geometry/overlapRemoval/borderInfo";
import { OverlapRemovalParameters } from "../../math/geometry/overlapRemoval/overlapRemovalParameters";
import { Solution } from "../../math/projectionSolver/Solution";
import { Solver } from "../../math/projectionSolver/Solver";
import { constructor } from "../../routing/ConstrainedDelaunayTriangulation/ThreeArray";
import { GeomGraph } from "../core";
import { LayoutSettings } from "../layered/SugiyamaLayoutSettings";
import { FiNode } from "./fiNode";
import { IConstraint } from "./iConstraint";

    ///  </summary>
export    class AxisSolver {
        
         structuralConstraints: Array<IConstraint> = new Array<IConstraint>();
        
         ConstraintLevel: number;
        
        ///  <summary>
        ///  true means this AxisSolver works horizontally
        ///  </summary>
         IsHorizontal: boolean
        
         OverlapRemovalParameters: OverlapRemovalParameters ;
        
        private avoidOverlaps: boolean;
        
        private nodes: Iterable<FiNode>;
        
        private clusterHierarchies: Iterable<GeomGraph>;
        
        private clusterSettings: (gg:GeomGraph)=> LayoutSettings
        
        
        ///  <summary>
        ///  Do we even need to do a solve?
        ///  </summary>
         get NeedSolve(): boolean {
            return ((this.avoidOverlaps 
                        && (this.ConstraintLevel >= 2)) 
                        || ((this.structuralConstraints.length > 0) 
                        && (this.ConstraintLevel >= 1)));
        }
        
        ///  <summary>
        ///  Have to reinstantiate if any of these parameters change
        ///  </summary>
        ///  <param name="isHorizontal"></param>
        ///  <param name="nodes"></param>
        ///  <param name="clusterHierarchies"></param>
        ///  <param name="avoidOverlaps"></param>
        ///  <param name="constraintLevel"></param>
        ///  <param name="clusterSettings"></param>
         constructor (isHorizontal: boolean, nodes: Iterable<FiNode>, clusterHierarchies: Iterable<GeomGraph>, avoidOverlaps: boolean, constraintLevel: number, clusterSettings: (gg:GeomGraph)=> LayoutSettings) {
            this.IsHorizontal = isHorizontal;
            this.nodes = nodes;
            this.clusterHierarchies = clusterHierarchies;
            this.avoidOverlaps = avoidOverlaps;
            this.ConstraintLevel = constraintLevel;
            this.clusterSettings = clusterSettings;
        }
        
        ///  <summary>
        ///  Add the constraint to this axis
        ///  </summary>
        ///  <param name="c"></param>
         AddStructuralConstraint(c: IConstraint) {
            this.structuralConstraints.push(c);
        }
        
        solver: Solver;
        
        cg: ConstraintGenerator;
        
        ///  <summary>
        ///  Create variables, generate non-overlap constraints.
        ///  </summary>
        ///  <param name="hPad">horizontal node padding</param>
        ///  <param name="vPad">vertical node padding</param>
        ///  <param name="cHPad">horizontal cluster padding</param>
        ///  <param name="cVPad">vertical cluster padding</param>
        ///  <param name="nodeCenter"></param>
         Initialize(hPad: number, vPad: number, cHPad: number, cVPad: number, nodeCenter: InitialCenterDelegateType) {
            //  For the Vertical ConstraintGenerator, Padding is vPad and PadddingP(erpendicular) is hPad.
            this.cg = new ConstraintGenerator(this.IsHorizontal, this.IsHorizontal);
            // TODO: Warning!!!, inline IF is not supported ?
            // TODO: Warning!!!! NULL EXPRESSION DETECTED...
            ;
            this.solver = new Solver();
            for (let filNode in this.nodes) {
                filNode.SetOlapNode(this.IsHorizontal, null);
            }
            
            //  Calculate horizontal non-Overlap constraints.  
            if ((this.avoidOverlaps 
                        && (this.clusterHierarchies != null))) {
                for (let c in this.clusterHierarchies) {
                    this.AddOlapClusters(this.cg, null, c, nodeCenter);
                }
                
            }
            
            for (let filNode in this.nodes) {
                if ((filNode.getOlapNode(this.IsHorizontal) == null)) {
                    this.AddOlapNode(this.cg, this.cg.DefaultClusterHierarchy, filNode, nodeCenter);
                }
                
                filNode.getOlapNode(this.IsHorizontal).CreateVariable(this.solver);
            }
            
            if ((this.avoidOverlaps 
                        && (this.ConstraintLevel >= 2))) {
                this.cg.Generate(this.solver, this.OverlapRemovalParameters);
            }
            
            this.AddStructuralConstraints();
        }
        
        ///  <summary>
        ///  Do it!
        ///  </summary>
        ///  <returns></returns>
         Solve(): Solution {
            //  This updates the mOlapNode and clears the mOlapNode.Variable property.
            //  We do just one solve over all the cluster constraints for the whole hierarchy.
            //  It returns a list of lists of unsatisfiable constraints, or NULL.
            let solution: Solution = this.cg.Solve(this.solver, null, false);
            //  Update the positions.
            if ((this.avoidOverlaps 
                        && (this.clusterHierarchies != null))) {
                for (let c in this.clusterHierarchies) {
                    //  Don't update the root cluster of the hierarachy as it doesn't have borders.
                    this.UpdateOlapClusters(c.Clusters);
                }
                
            }
            
            for (let v: FiNode in this.nodes) {
                //  Set the position from the constraint solution on this axis.
                v.UpdatePos(this.IsHorizontal);
            }
            
            this.DebugVerifyClusterHierarchy(solution);
            return solution;
        }
        
        ///  <summary>
        ///  Must be called before Solve if the caller has updated Variable Initial Positions
        ///  </summary>
         SetDesiredPositions() {
            for (let v in this.nodes) {
                v.SetVariableDesiredPos(this.IsHorizontal);
            }
            
            this.solver.UpdateVariables();
        }
        
        private AddStructuralConstraints() {
            //  Add the vertical structural constraints to the auto-generated ones. 
            for (let c in this.structuralConstraints) {
                if ((this.ConstraintLevel >= c.Level)) {
                    let hc = (<HorizontalSeparationConstraint>(c));
                    if (((hc != null) 
                                && this.IsHorizontal)) {
                        let u: FiNode;
                        let v: FiNode;
                        this.solver.AddConstraint(u.getOlapNode(this.IsHorizontal).Variable, v.getOlapNode(this.IsHorizontal).Variable, hc.Separation, hc.IsEquality);
                    }
                    
                    let vc = (<VerticalSeparationConstraint>(c));
                    if (((vc != null) 
                                && !this.IsHorizontal)) {
                        let u: FiNode;
                        let v: FiNode;
                        this.solver.AddConstraint(u.getOlapNode(this.IsHorizontal).Variable, v.getOlapNode(this.IsHorizontal).Variable, vc.Separation, vc.IsEquality);
                    }
                    
                }
                
            }
            
        }
        
        private AddOlapClusters(generator: ConstraintGenerator, olapParentCluster: OverlapRemovalCluster, incClus: GeomGraph, nodeCenter: InitialCenterDelegateType) {
            let settings: LayoutSettings = clusterSettings(incClus);
            let nodeSeparationH: number = settings.NodeSeparation;
            let nodeSeparationV: number = (settings.NodeSeparation + 0.0001);
            let innerPaddingH: number = settings.ClusterMargin;
            let innerPaddingV: number = (settings.ClusterMargin + 0.0001);
            //  Creates the OverlapRemoval (Olap) GeomGraph/Node objects for our FastIncrementalLayout (FIL) objects.
            //  If !isHorizontal this overwrites the Olap members of the Incremental.Clusters and Msagl.Nodes.
            //  First create the olapCluster for the current incCluster.  If olapParentCluster is null, then
            //  incCluster is the root of a new hierarchy.
            let rb: RectangularClusterBoundary = incClus.RectangularBoundary;
            if (this.IsHorizontal) {
                rb.olapCluster = generator.AddCluster(olapParentCluster, incClus, rb.MinWidth, rb.MinHeight, rb.LeftBorderInfo, rb.RightBorderInfo, rb.BottomBorderInfo, rb.TopBorderInfo);
                rb.olapCluster.NodePadding = nodeSeparationH;
                rb.olapCluster.NodePaddingP = nodeSeparationV;
                rb.olapCluster.ClusterPadding = innerPaddingH;
                rb.olapCluster.ClusterPaddingP = innerPaddingV;
            }
            else {
                let postXLeftBorderInfo = new BorderInfo(rb.LeftBorderInfo.InnerMargin, rb.Rect.Left, rb.LeftBorderInfo.Weight);
                let postXRightBorderInfo = new BorderInfo(rb.RightBorderInfo.InnerMargin, rb.Rect.Right, rb.RightBorderInfo.Weight);
                rb.olapCluster = generator.AddCluster(olapParentCluster, incClus, rb.MinHeight, rb.MinWidth, rb.BottomBorderInfo, rb.TopBorderInfo, postXLeftBorderInfo, postXRightBorderInfo);
                rb.olapCluster.NodePadding = nodeSeparationV;
                rb.olapCluster.NodePaddingP = nodeSeparationH;
                rb.olapCluster.ClusterPadding = innerPaddingV;
                rb.olapCluster.ClusterPaddingP = innerPaddingH;
            }
            
            rb.olapCluster.TranslateChildren = rb.GenerateFixedConstraints;
            //  Note: Incremental.GeomGraph always creates child Array<GeomGraph|Node> so we don't have to check for null here.
            //  Add our child nodes.
            for (let filNode in incClus.Nodes) {
                this.AddOlapNode(generator, rb.olapCluster, (<FiNode>(filNode.AlgorithmData)), nodeCenter);
            }
            
            //  Now recurse through all child clusters.
            for (let incChildClus in incClus.Clusters) {
                this.AddOlapClusters(generator, rb.olapCluster, incChildClus, nodeCenter);
            }
            
        }
        
        private AddOlapNode(generator: ConstraintGenerator, olapParentCluster: OverlapRemovalCluster, filNode: FiNode, nodeCenter: InitialCenterDelegateType) {
            //  If the node already has an mOlapNode, it's already in a cluster (in a different
            //  hierarchy); we just add it to the new cluster.
            if ((null != filNode.getOlapNode(this.IsHorizontal))) {
                generator.AddNodeToCluster(olapParentCluster, filNode.getOlapNode(this.IsHorizontal));
                return;
            }
            
            let center = nodeCenter(filNode);
            //  We need to create a new Node in the Generator.
            if (this.IsHorizontal) {
                //  Add the Generator node with the X-axis coords primary, Y-axis secondary.
                filNode.mOlapNodeX = generator.AddNode(olapParentCluster, filNode, center.X, center.Y, filNode.Width, filNode.Height, filNode.stayWeight);
            }
            else {
                //  Add the Generator node with the Y-axis coords primary, X-axis secondary.
                filNode.mOlapNodeY = generator.AddNode(olapParentCluster, filNode, center.Y, center.X, filNode.Height, filNode.Width, filNode.stayWeight);
            }
            
        }
        
        private UpdateOlapClusters(incClusters: Iterable<GeomGraph>) {
            for (let incClus in incClusters) {
                let rb: RectangularClusterBoundary = incClus.RectangularBoundary;
                //  Because two heavily-weighted nodes can force each other to move, we have to update
                //  any BorderInfos that are IsFixedPosition to reflect this possible movement; for example,
                //  a fixed border and a node being dragged will both have heavy weights.
                if (this.IsHorizontal) {
                    rb.rectangle.Left = (rb.olapCluster.Position 
                                - (rb.olapCluster.Size / 2));
                    rb.rectangle.Right = (rb.olapCluster.Position 
                                + (rb.olapCluster.Size / 2));
                    if (rb.LeftBorderInfo.IsFixedPosition) {
                        rb.LeftBorderInfo = new BorderInfo(rb.LeftBorderInfo.InnerMargin, rb.rectangle.Left, rb.LeftBorderInfo.Weight);
                    }
                    
                    if (rb.RightBorderInfo.IsFixedPosition) {
                        rb.RightBorderInfo = new BorderInfo(rb.RightBorderInfo.InnerMargin, rb.rectangle.Right, rb.RightBorderInfo.Weight);
                    }
                    
                }
                else {
                    rb.rectangle.Bottom = (rb.olapCluster.Position 
                                - (rb.olapCluster.Size / 2));
                    rb.rectangle.Top = (rb.olapCluster.Position 
                                + (rb.olapCluster.Size / 2));
                    if (rb.TopBorderInfo.IsFixedPosition) {
                        rb.TopBorderInfo = new BorderInfo(rb.TopBorderInfo.InnerMargin, rb.rectangle.Top, rb.TopBorderInfo.Weight);
                    }
                    
                    if (rb.BottomBorderInfo.IsFixedPosition) {
                        rb.BottomBorderInfo = new BorderInfo(rb.BottomBorderInfo.InnerMargin, rb.rectangle.Bottom, rb.BottomBorderInfo.Weight);
                    }
                    
                }
                
                //  We don't use this anymore now that we've transferred the position and size
                //  so clean it up as the Gen/Solver will be going out of scope.
                rb.olapCluster = null;
                //  Recurse.
                this.UpdateOlapClusters(incClus.Clusters);
            }
            
        }
        
        @Conditional("VERIFY")
        private DebugVerifyClusterHierarchy(solution: Solution) {
            if ((this.avoidOverlaps 
                        && ((null != this.clusterHierarchies) && (0 != solution.NumberOfUnsatisfiableConstraints)))) {
                for (let c in this.clusterHierarchies) {
                    this.DebugVerifyClusters(this.cg, c, c);
                }
                
            }
            
        }
        
        //  This is initially called with Clusters that live at the root level; verify their nodes
        //  are within their boundaries, then recurse.
        @System.Diagnostics.CodeAnalysis.SuppressMessage("Microsoft.Performance", "CA1804:RemoveUnusedLocals", MessageId="jjNodeRect")
        @System.Diagnostics.CodeAnalysis.SuppressMessage("Microsoft.Performance", "CA1804:RemoveUnusedLocals", MessageId="jjClusRect")
        @System.Diagnostics.CodeAnalysis.SuppressMessage("Microsoft.Performance", "CA1804:RemoveUnusedLocals", MessageId="incClusComp")
        @Conditional("VERIFY")
        private DebugVerifyClusters(generator: ConstraintGenerator, incCluster: GeomGraph, root: GeomGraph) {
            let dblEpsilon: number = 0.0001;
            //  First verify that all nodes are within the cluster.
            let clusRect: Rectangle = incCluster.RectangularBoundary.rectangle;
            for (let v in incCluster.Nodes) {
                let iiFilNode: FiNode = (<FiNode>(v.AlgorithmData));
                let iiNodeRect: Rectangle = iiFilNode.mNode.BoundaryCurve.BoundingBox;
                if (this.IsHorizontal) {
                    //  Don't check containment for the root ClusterHierarchy as there is no border for it.
                    if ((incCluster != root)) {
                        //  This is horizontal so we've not yet calculated the Y-axis stuff.  The only thing we
                        //  can do is verify we're within cluster X bounds.  If *Space is negative, there's overlap.
                        //  Generator primary axis is horizontal so use its Padding.
                        let dblLboundSpace: number = (iiNodeRect.Left 
                                    - (clusRect.Left - generator.Padding));
                        let dblRboundSpace: number = (clusRect.Right 
                                    - (iiNodeRect.Right - generator.Padding));
                        Debug.Assert(((dblLboundSpace 
                                        >= (dblEpsilon * -1)) 
                                        && (dblRboundSpace 
                                        >= (dblEpsilon * -1))), "Node is not within parent GeomGraph");
                    }
                    
                }
                else {
                    //  Don't check containment for the root ClusterHierarchy as there is no border for it.
                    if ((incCluster != root)) {
                        //  This is vertical so we've calculated the Y-axis stuff and horizontal is Perpendicular.
                        AxisSolver.DebugVerifyRectContains(clusRect, iiNodeRect, generator.PaddingP, generator.Padding, dblEpsilon);
                    }
                    
                    //  Make sure the node doesn't intersect any following nodes, or any clusters.
                    for (let u in incCluster.Nodes) {
                        if ((u == v)) {
                            // TODO: Warning!!! continue If
                        }
                        
                        let jjFilNode: FiNode = (<FiNode>(u.AlgorithmData));
                        let jjNodeRect: Rectangle = jjFilNode.mNode.BoundaryCurve.BoundingBox;
                        //  We've already added the padding for the node so don't add it for the jjNode/GeomGraph.
                        AxisSolver.DebugVerifyRectsDisjoint(iiNodeRect, jjNodeRect, generator.PaddingP, generator.Padding, dblEpsilon);
                    }
                    
                    for (let incClusComp: GeomGraph in incCluster.Clusters) {
                        AxisSolver.DebugVerifyRectsDisjoint(iiNodeRect, incClusComp.RectangularBoundary.rectangle, generator.PaddingP, generator.Padding, dblEpsilon);
                    }
                    
                }
                
                //  endif isHorizontal
            }
            
            //  endfor iiNode
            //  Now verify the clusters are contained and don't overlap.
            for (let iiIncClus in incCluster.Clusters) {
                let iiClusRect: Rectangle = iiIncClus.RectangularBoundary.rectangle;
                if (this.IsHorizontal) {
                    //  Don't check containment for the root ClusterHierarchy as there is no border for it.
                    if ((incCluster != root)) {
                        //  This is horizontal so we've not yet calculated the Y-axis stuff.  The only thing we
                        //  can do is verify we're within cluster X bounds.  If *Space is negative, there's overlap.
                        //  Generator primary axis is horizontal so use its Padding.
                        let dblLboundSpace: number = (iiClusRect.Left 
                                    - (clusRect.Left - generator.Padding));
                        let dblRboundSpace: number = (clusRect.Right 
                                    - (iiClusRect.Right - generator.Padding));
                        Debug.Assert(((dblLboundSpace 
                                        >= (dblEpsilon * -1)) 
                                        && (dblRboundSpace 
                                        >= (dblEpsilon * -1))), "GeomGraph is not within parent GeomGraph");
                    }
                    
                }
                else {
                    //  Don't check containment for the root ClusterHierarchy as there is no border for it.
                    if ((incCluster != root)) {
                        //  This is vertical so we've calculated the Y-axis stuff and horizontal is Perpendicular.
                        AxisSolver.DebugVerifyRectContains(clusRect, iiClusRect, generator.PaddingP, generator.Padding, dblEpsilon);
                    }
                    
                    //  Make sure the cluster doesn't intersect any following clusters.
                    for (let jjIncClus in incCluster.Clusters) {
                        if ((jjIncClus == iiIncClus)) {
                            // TODO: Warning!!! continue If
                        }
                        
                        let jjClusRect: Rectangle = jjIncClus.RectangularBoundary.rectangle;
                        AxisSolver.DebugVerifyRectsDisjoint(iiClusRect, jjClusRect, generator.PaddingP, generator.Padding, dblEpsilon);
                    }
                    
                }
                
                //  endif isHorizontal
                //  Now recurse.
                this.DebugVerifyClusters(generator, iiIncClus, root);
            }
            
            //  endfor iiCluster
        }
        
        @Conditional("VERIFY")
        static DebugVerifyRectContains(rectOuter: Rectangle, rectInner: Rectangle, dblPaddingX: number, dblPaddingY: number, dblEpsilon: number) {
            rectInner.PadWidth(((dblPaddingX / 2) 
                            - dblEpsilon));
            rectInner.PadHeight(((dblPaddingY / 2) 
                            - dblEpsilon));
            Debug.Assert(rectOuter.Contains(rectInner), "Inner Node/GeomGraph rectangle is not contained within outer GeomGraph");
        }
        
        @Conditional("VERIFY")
        static DebugVerifyRectsDisjoint(rect1: Rectangle, rect2: Rectangle, dblPaddingX: number, dblPaddingY: number, dblEpsilon: number) {
            rect1.PadWidth(((dblPaddingX / 2) 
                            - dblEpsilon));
            rect1.PadHeight(((dblPaddingY / 2) 
                            - dblEpsilon));
            rect2.PadWidth(((dblPaddingX / 2) 
                            - dblEpsilon));
            rect2.PadHeight(((dblPaddingY / 2) 
                            - dblEpsilon));
            Debug.Assert(!rect1.Intersects(rect2));
        }
    }
}
//  end namespace Microsoft.Msagl.Incremental