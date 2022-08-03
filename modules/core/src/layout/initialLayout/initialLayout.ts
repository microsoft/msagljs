import { Direction } from '../../math/geometry';
import { Edge } from '../../structs/edge';
import {Algorithm} from '../../utils/algorithm'
import { GeomGraph } from '../../'
import { FastIncrementalLayout } from '../incremental/fastIncrementalLayout';
import { FastIncrementalLayoutSettings } from '../incremental/fastIncrementalLayoutSettings';
import { MdsGraphLayout } from '../mds/mDSGraphLayout';
import { PivotMDS } from '../mds/pivotMDS';
import { IGeomGraph } from './iGeomGraph';
import { GeomConnectedComponent } from './geomConnectedComponent';
import { LayoutAlgorithmHelpers } from './layoutAlgorithmHelpers';
    ///  <summary>
    ///  Methods for obtaining an initial layout of a graph using various means.
    ///  </summary>
    export class InitialLayout extends Algorithm {
        
        private graph: GeomGraph;
        
        private settings: FastIncrementalLayoutSettings;
        
        private componentCount: number;
        
        ///  <summary>
        ///  Set to true if the graph specified is a single connected component with no clusters
        ///  </summary>
        SingleComponent: boolean 
        
        ///  <summary>
        ///  Static layout of graph by gradually adding constraints.
        ///  Uses PivotMds to find initial layout.
        ///  Breaks the graph into connected components (nodes of the same cluster are considered
        ///  connected whether or not there is an edge between them), then lays out each component
        ///  individually.  Finally, a simple packing is applied.
        ///  ratio as close as possible to the PackingAspectRatio property (not currently used).
        ///  </summary>
        public constructor (graph: GeomGraph, settings: FastIncrementalLayoutSettings) {
            super(null)
            this.graph = graph;
            this.settings = FastIncrementalLayoutSettings.ctorClone(settings);
            this.settings.ApplyForces = true;
            this.settings.InterComponentForces = true;
            this.settings.RungeKuttaIntegration = false;
            this.settings.RespectEdgePorts = false;
        }
        
        ///  <summary>
        ///  The actual layout process
        ///  </summary>
        run() {
            if (this.SingleComponent) {
                this.componentCount = 1;
                this.LayoutComponent(this.graph);
            }
            else {
                for (let c of this.graph.subgraphs()) {
                    if (c .RectangularBoundary == null) {
                        continue
                    }
                    
                    c.RectangularBoundary.GenerateFixedConstraints = false;
                }
                
                let components = Array.from(this.graph.graph.getClusteredConnectedComponents()).map(topNodes=>new GeomConnectedComponent(topNodes))
                this.componentCount = components.length
                for (let component of components) {
                    this.LayoutComponent(component);
                }
                
                this.graph.boundingBox = MdsGraphLayout.PackGraphs(components, this.settings);
                
                // for (let c of this.graph.subgraphs()) {
                //     let copy = (<GraphConnectedComponents.AlgorithmDataNodeWrap>(c.AlgorithmData));
                //     let copyCluster = (<Cluster>(copy.node));
                //     Debug.Assert((copyCluster != null));
                //     c.RectangularBoundary = copyCluster.RectangularBoundary;
                //     c.RectangularBoundary.GenerateFixedConstraints = c.RectangularBoundary.GenerateFixedConstraintsDefault;
                //     c.BoundingBox = c.RectangularBoundary.Rect;
                //     c.RaiseLayoutDoneEvent();
                // }
                
            }
            
        }
        
        private LayoutComponent(component:IGeomGraph) {
            if (component.shallowNodeCount > 1 ) {
                //  for small graphs (below 100 nodes) do extra iterations
                this.settings.MaxIterations = LayoutAlgorithmHelpers.NegativeLinearInterpolation(component.shallowNodeCount, 50, 500, 5, 10);
                this.settings.MinorIterations = LayoutAlgorithmHelpers.NegativeLinearInterpolation(component.shallowNodeCount, 50, 500, 3, 20);
                if ((this.settings.MinConstraintLevel == 0)) {
                    //  run PivotMDS with a largish Scale so that the layout comes back oversized.
                    //  subsequent incremental iterations do a better job of untangling when they're pulling it in
                    //  rather than pushing it apart.
                    let pivotMDS: PivotMDS = new PivotMDS(component);
                    this.RunChildAlgorithm(pivotMDS, (0.5 / this.componentCount));
                }
                
                let fil: FastIncrementalLayout = new FastIncrementalLayout(component, this.settings, this.settings.MinConstraintLevel, () => {  }, this.settings);
                Debug.Assert((this.settings.Iterations == 0));
                for (let level of this.GetConstraintLevels(component)) {
                    if ((level > this.settings.MaxConstraintLevel)) {
                        break;
                    }
                    
                    if ((level > this.settings.MinConstraintLevel)) {
                        fil.CurrentConstraintLevel = level;
                    }
                    
                    for (
                    ; !this.settings.IsDone; 
                    ) {
                        fil.Run();
                    }
                    
                }
                
            }
            
            //  Pad the graph with margins so the packing will be spaced out.
            component.Margins = this.settings.NodeSeparation;
            component.UpdateBoundingBox();
            //  Zero the graph
            component.Translate((component.BoundingBox.LeftBottom * -1));
        }
        
        ///  <summary>
        ///  Get the distinct ConstraintLevels that need to be applied to layout.
        ///  Used by InitialLayout.
        ///  Will only include ConstraintLevel == 1 if there are structural constraints
        ///  Will only include ConstraintLevel == 2 if AvoidOverlaps is on and there are fewer than 2000 nodes
        ///  </summary>
        ///  <returns>0, 1 or 2</returns>
        GetConstraintLevels(component: GeomGraph): IEnumerable<number> {
            let keys = from;
            c;
            this.settings.StructuralConstraints;
            let c.Level: select;
            ToList();
            keys.Add(0);
            if ((this.settings.IdealEdgeLength.Direction != Direction.None)) {
                keys.Add(1);
            }
            
            if ((this.settings.AvoidOverlaps 
                        && (component.Nodes.Count < 2000))) {
                keys.Add(2);
            }
            
            return keys.Distinct();
        }
    }
}
