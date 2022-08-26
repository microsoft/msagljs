import {Direction} from '../../math/geometry'
import {Algorithm} from '../../utils/algorithm'
import {GeomGraph, MdsLayoutSettings} from '../../'
import {FastIncrementalLayout} from '../incremental/fastIncrementalLayout'
import {FastIncrementalLayoutSettings} from '../incremental/fastIncrementalLayoutSettings'
import {MdsGraphLayout} from '../mds/mDSGraphLayout'
import {PivotMDS} from '../mds/pivotMDS'
import {IGeomGraph} from './iGeomGraph'
import {GeomConnectedComponent} from './geomConnectedComponent'
import {LayoutAlgorithmHelpers} from './layoutAlgorithmHelpers'
import {Assert} from '../../utils/assert'
///  <summary>
///  Methods for obtaining an initial layout of a graph using various means.
///  </summary>
export class InitialLayout extends Algorithm {
  private graph: GeomGraph

  private settings: FastIncrementalLayoutSettings

  private componentCount: number

  ///  <summary>
  ///  Set to true if the graph specified is a single connected component with no clusters
  ///  </summary>
  SingleComponent = false

  ///  <summary>
  ///  Static layout of graph by gradually adding constraints.
  ///  Uses PivotMds to find initial layout.
  ///  Breaks the graph into connected components (nodes of the same cluster are considered
  ///  connected whether or not there is an edge between them), then lays out each component
  ///  individually.  Finally, a simple packing is applied.
  ///  ratio as close as possible to the PackingAspectRatio property (not currently used).
  ///  </summary>
  public constructor(graph: GeomGraph, settings: FastIncrementalLayoutSettings) {
    super(null)
    this.graph = graph
    this.settings = FastIncrementalLayoutSettings.ctorClone(settings)
    this.settings.ApplyForces = true
    this.settings.InterComponentForces = true
    this.settings.RungeKuttaIntegration = false
    this.settings.RespectEdgePorts = false
  }

  ///  <summary>
  ///  The actual layout process
  ///  </summary>
  run() {
    if (this.SingleComponent) {
      this.componentCount = 1
      this.LayoutComponent(this.graph)
    } else {
      const components = Array.from(this.graph.graph.getClusteredConnectedComponents()).map(
        (topNodes) => new GeomConnectedComponent(topNodes),
      )
      this.componentCount = components.length
      for (const component of components) {
        this.LayoutComponent(component)
      }

      this.graph.boundingBox = MdsGraphLayout.PackGraphs(components, this.settings.commonSettings)

      // for (let c of this.graph.subgraphs()) {
      //     let copy = (<GraphConnectedComponents.AlgorithmDataNodeWrap>(c.AlgorithmData));
      //     let copyCluster = (<Cluster>(copy.node));
      //     Assert.assert((copyCluster != null));
      //     c.RectangularBoundary = copyCluster.RectangularBoundary;
      //     c.RectangularBoundary.GenerateFixedConstraints = c.RectangularBoundary.GenerateFixedConstraintsDefault;
      //     c.BoundingBox = c.RectangularBoundary.Rect;
      //     c.RaiseLayoutDoneEvent();
      // }
    }
  }

  private LayoutComponent(component: IGeomGraph) {
    if (component.shallowNodeCount > 1) {
      //  for small graphs (below 100 nodes) do extra iterations
      this.settings.MaxIterations = LayoutAlgorithmHelpers.NegativeLinearInterpolation(component.shallowNodeCount, 50, 500, 5, 10)
      this.settings.MinorIterations = LayoutAlgorithmHelpers.NegativeLinearInterpolation(component.shallowNodeCount, 50, 500, 3, 20)
      if (this.settings.MinConstraintLevel == 0) {
        //  run PivotMDS with a largish Scale so that the layout comes back oversized.
        //  subsequent incremental iterations do a better job of untangling when they're pulling it in
        //  rather than pushing it apart.
        const mdsSettings = new MdsLayoutSettings()
        mdsSettings.removeOverlaps = false
        mdsSettings.IterationsWithMajorization = 0
        const pivotMDS = new PivotMDS(component, null, () => 1, new MdsLayoutSettings())
        pivotMDS.run()
      }

      const fil: FastIncrementalLayout = new FastIncrementalLayout(
        component,
        this.settings,
        this.settings.MinConstraintLevel,
        () => this.settings,
      )
      Assert.assert(this.settings.Iterations == 0)
      for (const level of this.GetConstraintLevels(component)) {
        if (level > this.settings.MaxConstraintLevel) {
          break
        }

        if (level > this.settings.MinConstraintLevel) {
          fil.setCurrentConstraintLevel(level)
        }

        do {
          fil.run()
        } while (!this.settings.IsDone)
      }
    }

    component.pumpTheBoxToTheGraphWithMargins()
    //  Pad the graph with margins so the packing will be spaced out.
    component.uniformMargins = this.settings.NodeSeparation
    //  Zero the graph
    component.translate(component.boundingBox.leftBottom.mul(-1))
  }

  ///  <summary>
  ///  Get the distinct ConstraintLevels that need to be applied to layout.
  ///  Used by InitialLayout.
  ///  Will only include ConstraintLevel == 1 if there are structural constraints
  ///  Will only include ConstraintLevel == 2 if AvoidOverlaps is on and there are fewer than 2000 nodes
  ///  </summary>
  ///  <returns>0, 1 or 2</returns>
  GetConstraintLevels(component: IGeomGraph): Iterable<number> {
    const keys = new Set<number>()
    for (const c of this.settings.StructuralConstraints) {
      keys.add(c.Level)
    }
    keys.add(0)
    if (this.settings.edgeConstrains.Direction != Direction.None) {
      keys.add(1)
    }
    if (this.settings.AvoidOverlaps && component.shallowNodeCount < 2000) {
      keys.add(2)
    }
    return keys
  }
}
