import {DrawingEdge} from '.'
import {CurveFactory, Edge, GeomEdge, GeomGraph, GeomLabel, GeomNode, ICurve, Point, Rectangle, Size, SugiyamaLayoutSettings} from '..'
import {Graph, Node} from '..'
import {Ellipse} from '../math/geometry/ellipse'
import {DrawingNode} from './drawingNode'
import {DrawingObject} from './drawingObject'
import {ShapeEnum} from './shapeEnum'

type GraphVisData = {
  sameRanks: string[][]
  minRanks: string[]
  maxRanks: string[]
  sourceRanks: string[]
  sinkRanks: string[]
}
/** DrawingGraph meant to be an attribute on Graph. It facilitates the geometry creation, mostly for the bounding curves of the nodes, from drawing attributes and labels  */
export class DrawingGraph extends DrawingNode {
  /** this node does not belong to the graph,
   but rather serves as a template for the other node's attributes (like filledColor, style, etc.) */
  defaultNode: DrawingNode
  graphVisData: GraphVisData = {
    sameRanks: new Array<string[]>(),
    minRanks: new Array<string>(),
    maxRanks: new Array<string>(),
    sourceRanks: new Array<string>(),
    sinkRanks: new Array<string>(),
  }
  get graph(): Graph {
    return this.attrCont as Graph
  }

  findNode(id: string): DrawingNode {
    const gr = this.graph
    const n = gr.findNode(id)
    if (n == null) return null
    return DrawingObject.getDrawingObj(n) as DrawingNode
  }

  hasDirectedEdge(): boolean {
    for (const e of this.graph.edges) {
      const drawingEdge = <DrawingEdge>DrawingObject.getDrawingObj(e)
      if (drawingEdge.directed) {
        return true
      }
    }
    return false
  }

  createGeometry(
    textMeasure: (label: string) => Size = (str: string) => {
      if (!str) return null
      return new Size(str.length * 8 + 8, 20)
    },
  ): void {
    const geomGraph = new GeomGraph(this.graph)
    geomGraph.labelSize = textMeasure(this.labelText)
    for (const n of this.graph.deepNodes) {
      this.createNodeGeometry(n, textMeasure)
    }
    for (const e of this.graph.edges) {
      this.createEdgeGeometry(e, textMeasure)
    }
  }
  createEdgeGeometry(e: Edge, textMeasure: (label: string) => Size) {
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(e)
    const ge = new GeomEdge(e)
    if (de.directed == false) {
      ge.targetArrowhead = null
    }
    if (e.label) {
      const size = textMeasure(e.label.text)
      ge.label = new GeomLabel(Rectangle.mkPP(new Point(0, 0), new Point(size.width, size.height)), e.label)
    }
  }

  curveByShape(width: number, height: number, center: Point, shape: ShapeEnum, drawingNode: DrawingNode): ICurve {
    let curve: ICurve
    switch (shape) {
      case ShapeEnum.diamond:
        curve = CurveFactory.CreateDiamond(width, height, center)
        break
      case ShapeEnum.ellipse:
        break
      case ShapeEnum.box:
        curve = CurveFactory.mkRectangleWithRoundedCorners(width, height, drawingNode.XRadius, drawingNode.YRadius, center)
        break
      case ShapeEnum.circle:
        curve = CurveFactory.mkCircle(width / 2, center)
        break
      case ShapeEnum.record:
        break
      case ShapeEnum.plaintext:
        break
      case ShapeEnum.point:
        break
      case ShapeEnum.mdiamond:
        break
      case ShapeEnum.msquare:
        break
      case ShapeEnum.polygon:
        break
      case ShapeEnum.doublecircle:
        curve = CurveFactory.mkCircle(width / 2, center)
        break
      case ShapeEnum.house:
        curve = CurveFactory.createHouse(width, height, center)
        break
      case ShapeEnum.invhouse:
        curve = CurveFactory.createInvertedHouse(width, height, center)
        break
      case ShapeEnum.parallelogram:
        break
      case ShapeEnum.octagon:
        curve = CurveFactory.createOctagon(width, height, center)
        break
      case ShapeEnum.tripleoctagon:
        break
      case ShapeEnum.triangle:
        break
      case ShapeEnum.trapezium:
        break
      case ShapeEnum.drawfromgeometry:
        break
      case ShapeEnum.hexagon:
        curve = CurveFactory.createHexagon(width, height, center)
        break
    }
    return curve ?? Ellipse.mkFullEllipseNNP(width / 2, height / 2, center)
  }

  createNodeGeometry(n: Node, textMeasure: (label: string) => Size): void {
    if (n instanceof Graph) {
      const subDg = <DrawingGraph>DrawingObject.getDrawingObj(n)
      subDg.createGeometry(textMeasure)
    } else {
      const drawingNode = <DrawingNode>DrawingNode.getDrawingObj(n)
      let textSize = new Size(1, 1)
      if (drawingNode.labelText) {
        textSize = textMeasure(drawingNode.labelText)
      }
      const width = textSize.width + drawingNode.LabelMargin * 2
      const height = textSize.height + drawingNode.LabelMargin * 2
      const center = new Point(0, 0)
      const geomNode = new GeomNode(n)
      geomNode.boundaryCurve = this.curveByShape(width, height, center, drawingNode.shape, drawingNode)
    }
  }
}
