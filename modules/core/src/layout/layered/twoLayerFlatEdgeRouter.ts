// import {ICurve, Curve, LineSegment, Point} from '../../math/geometry'
// import {CornerSite} from '../../math/geometry/cornerSite'
// import {SmoothedPolyline} from '../../math/geometry/smoothedPolyline'
// import {SolverShell} from '../../math/projectionSolver/SolverShell'
// import {InteractiveEdgeRouter} from '../../routing/interactiveEdgeRouter'
// import {BasicGraphOnEdges} from '../../structs/basicGraphOnEdges'
// import {Algorithm} from '../../utils/algorithm'
// import {IntPair} from '../../utils/IntPair'
// import {IntPairSet} from '../../utils/IntPairSet'
// import {FloatingPort} from '../core/floatingPort'
// import {GeomLabel} from '../core/geomLabel'
// import {Database} from './Database'
// import {LayerArrays} from './LayerArrays'
// import {PolyIntEdge} from './polyIntEdge'
// import {Routing} from './routing'
// import {SugiyamaLayoutSettings} from './sugiyamaLayoutSettings'
// export class TwoLayerFlatEdgeRouter extends Algorithm {
//   bottomLayer: number[]

//   interactiveEdgeRouter: InteractiveEdgeRouter

//   labelCenters: number[]

//   labelsToLabelObstacles: Map<GeomLabel, ICurve> = new Map<GeomLabel, ICurve>()

//   pairArray: IntPair[]

//   routing: Routing

//   topLayer: number[]

//   private settings: SugiyamaLayoutSettings

//   constructor(settings: SugiyamaLayoutSettings, routing: Routing, bottomLayer: number[], topLayer: number[]) {
//     super(null)
//     this.settings = settings
//     this.topLayer = topLayer
//     this.bottomLayer = bottomLayer
//     this.routing = routing
//     this.InitLabelsInfo()
//   }

//   get Database(): Database {
//     return this.routing.Database
//   }

//   get Layering(): number[] {
//     return this.routing.LayerArrays.y
//   }

//   get IntGraph(): BasicGraphOnEdges<PolyIntEdge> {
//     return this.routing.IntGraph
//   }

//   get LayerArrays(): LayerArrays {
//     return this.routing.LayerArrays
//   }

//   get PaddingForEdges(): number {
//     return this.settings.LayerSeparation / 8
//   }

//   InitLabelsInfo() {
//     const pairSet = new IntPairSet()
//     for (const v of this.bottomLayer) {
//       if (v < this.IntGraph.nodeCount) {
//         for (const edge of this.IntGraph.outEdges[v]) {
//           if (edge.source != edge.target)
//             if (this.Layering[edge.source] === this.Layering[edge.target]) {
//               pairSet.addNN(edge.source, edge.target)
//             }
//         }
//       }
//     }

//     this.pairArray = Array.from(pairSet.values())

//     this.labelCenters = new Array(this.pairArray.length)
//     let i = 0
//     for (const p of this.pairArray) {
//       let rightNode: number
//       let leftNode: number
//       if (this.LayerArrays.x[p.x] < this.LayerArrays.x[p.y]) {
//         leftNode = p.x
//         rightNode = p.y
//       } else {
//         leftNode = p.y
//         rightNode = p.x
//       }

//       this.labelCenters[i++] = (this.Database.Anchors[leftNode].right + this.Database.Anchors[rightNode].left) / 2
//       // labelCenters contains ideal position for nodes at the moment
//     }

//     this.InitLabelsToLabelObstacles()
//   }

//   InitLabelsToLabelObstacles() {
//     this.labelsToLabelObstacles = new Map<GeomLabel, ICurve>()
//     /* IEnumerable<GeomLabel> labels = from p in pairArray from label in PairLabels(p) select label;

//     */
//     const labels = []
//     for (const p of this.pairArray) {
//       for (const label of this.PairLabels(p)) labels.push(label)
//     }
//     for (const label of labels) {
//       this.labelsToLabelObstacles.set(label, TwoLayerFlatEdgeRouter.CreatObstaceOnLabel(label))
//     }
//   }

//   GetMaxLabelWidth(intPair: IntPair): number {
//     const multiEdgeLabels = Array.from(this.PairLabels(intPair))
//     if (multiEdgeLabels.length == 0) return 0
//     return Math.max(...multiEdgeLabels.map((l: GeomLabel) => l.width))
//   }

//   *PairLabels(intPair: IntPair): Generator<GeomLabel> {
//     for (const edge of this.Database.GetMultiedgeI(intPair)) {
//       const label = edge.edge.label
//       if (label) yield label
//     }
//   }

//   ///  <summary>
//   ///  Executes the algorithm.
//   ///  </summary>
//   run() {
//     if (this.pairArray.length > 0) {
//       this.PositionLabelsOfFlatEdges()
//       this.interactiveEdgeRouter = InteractiveEdgeRouter.constructorANNN(
//         Array.from(this.GetObstacles()),
//         this.PaddingForEdges,
//         this.PaddingForEdges / 3,
//         Math.PI / 6,
//       )
//       this.interactiveEdgeRouter.CalculateWholeTangentVisibilityGraph()
//       for (const intEdge of this.IntEdges()) {
//         this.RouteEdge(intEdge)
//       }
//     }
//   }

//   *GetObstacles(): Generator<ICurve> {
//     /*
//      return (from v in topLayer.Concat(bottomLayer)
//                     where v < routing.OriginalGraph.Nodes.Count
//                     select routing.IntGraph.Nodes[v].BoundaryCurve).Concat(LabelCurves());
//     */
//     for (const v of this.topLayer) {
//       if (v < this.routing.OriginalGraph.shallowNodeCount) {
//         yield this.routing.IntGraph.nodes[v].boundaryCurve
//       }
//     }
//     for (const v of this.bottomLayer) {
//       if (v < this.routing.OriginalGraph.shallowNodeCount) {
//         yield this.routing.IntGraph.nodes[v].boundaryCurve
//       }
//     }
//   }

//   LabelCurves(): IEnumerable<ICurve> {
//     return from
//     edge
//     this.IntEdges()
//     const label: let = edge.Edge.GeomLabel
//     let label: where
//     null
//     let CreatObstaceOnLabel: select
//   }

//   static CreatObstaceOnLabel(label: GeomLabel): ICurve {
//     const c = new Curve()
//     const obstacleBottom: number = label.Center.Y - label.Height / 4
//     c.addSegment(new LineSegment(new Point(label.BoundingBox.Left, obstacleBottom), new Point(label.BoundingBox.Right, obstacleBottom)))
//     Curve.continueWithLineSegmentP(c, label.BoundingBox.RightTop)
//     Curve.continueWithLineSegmentP(c, label.BoundingBox.LeftTop)
//     Curve.closeCurve(c)
//     return c
//   }

//   IntEdges(): IEnumerable<PolyIntEdge> {
//     return from
//     pair
//     let from: pairArray
//     edge
//     this.Database.GetMultiedge(pair)
//     let edge: select
//   }

//   RouteEdge(edge: PolyIntEdge) {
//     if (edge.hasLabel) {
//       this.RouteEdgeWithLabel(edge, edge.edge.GeomLabel)
//     } else {
//       this.RouteEdgeWithNoLabel(edge)
//     }
//   }

//   RouteEdgeWithLabel(intEdge: PolyIntEdge, label: GeomLabel) {
//     // we allow here for the edge to cross its own label
//     const sourceNode: Node = this.routing.IntGraph.nodes[intEdge.source]
//     const targetNode: Node = this.routing.IntGraph.nodes[intEdge.target]
//     const sourcePort = new FloatingPort(sourceNode.BoundaryCurve, sourceNode.Center)
//     const targetPort = new FloatingPort(targetNode.BoundaryCurve, targetNode.Center)
//     const labelObstacle: ICurve = this.labelsToLabelObstacles[label]
//     const labelPort = new FloatingPort(labelObstacle, label.Center)
//     let poly0: SmoothedPolyline
//     this.interactiveEdgeRouter.RouteSplineFromPortToPortWhenTheWholeGraphIsReady(sourcePort, labelPort, true, /* out */ poly0)
//     let poly1: SmoothedPolyline
//     this.interactiveEdgeRouter.RouteSplineFromPortToPortWhenTheWholeGraphIsReady(labelPort, targetPort, true, /* out */ poly1)
//     const site: CornerSite = poly1.headSite.Next
//     const lastSite: CornerSite = poly0.lastSite
//     lastSite.next = site
//     site.Previous = lastSite
//     const eg = intEdge.edge.EdgeGeometry
//     eg.SetSmoothedPolylineAndCurve(poly0)
//     Arrowheads.TrimSplineAndCalculateArrowheads(eg, intEdge.edge.Source.BoundaryCurve, intEdge.edge.Target.BoundaryCurve, eg.Curve, false)
//   }

//   RouteEdgeWithNoLabel(intEdge: PolyIntEdge) {
//     const sourceNode: Node = this.routing.IntGraph.nodes[intEdge.source]
//     const targetNode: Node = this.routing.IntGraph.nodes[intEdge.target]
//     const sourcePort = new FloatingPort(sourceNode.BoundaryCurve, sourceNode.Center)
//     const targetPort = new FloatingPort(targetNode.BoundaryCurve, targetNode.Center)
//     const eg = intEdge.edge.EdgeGeometry
//     let sp: SmoothedPolyline
//     eg.Curve = this.interactiveEdgeRouter.RouteSplineFromPortToPortWhenTheWholeGraphIsReady(sourcePort, targetPort, true, /* out */ sp)
//     Arrowheads.TrimSplineAndCalculateArrowheads(eg, intEdge.edge.Source.BoundaryCurve, intEdge.edge.Target.BoundaryCurve, eg.Curve, false)
//     intEdge.edge.EdgeGeometry = eg
//   }

//   PositionLabelsOfFlatEdges() {
//     if (this.labelCenters == null || this.labelCenters.length == 0) {
//       return
//     }

//     this.SortLabelsByX()
//     this.CalculateLabelsX()
//   }

//   CalculateLabelsX() {
//     let i: number
//     const solver = new SolverShell()
//     for (i = 0; i < this.pairArray.length; i++) {
//       solver.AddVariableWithIdealPositionNN(i, this.labelCenters[i], this.GetLabelWeight(this.pairArray[i]))
//     }

//     // add non overlapping constraints between to neighbor labels
//     const prevLabelWidth: number = this.GetMaxLabelWidth(this.pairArray[0])
//     for (i = 0; i < this.pairArray.length - 1; i++) {
//       solver.AddLeftRightSeparationConstraintNNN(
//         i,
//         i + 1,
//         (prevLabelWidth + this.GetMaxLabelWidth(this.pairArray[i + 1])) / 2 + this.settings.NodeSeparation,
//       )
//     }

//     for (i = 0; i < this.labelCenters.length; i++) {
//       let x: number
//       for (const label: GeomLabel in this.PairLabels(this.pairArray[i])) {
//         label.Center = new Point(x, label.Center.Y)
//       }
//     }
//   }

//   GetLabelWeight(intPair: IntPair): number {
//     return this.Database.GetMultiedge(intPair).Count
//   }

//   SortLabelsByX() {
//     Array.Sort(this.labelCenters, this.pairArray)
//   }
// }
