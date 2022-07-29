import {DrawingEdge} from '.'
import {CurveFactory, Edge, GeomEdge, GeomGraph, GeomLabel, GeomNode, ICurve, Point, Rectangle, Size} from '..'
import {Graph, Node} from '..'
import {TextMeasurerOptions} from '.'
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
/**
 * DrawingGraph is an attribute on Graph.
 * It keeps the attributes for nodes and edges rendering.
 *  It facilitates the geometry creation, mostly for the bounding curves of the nodes, from drawing attributes and labels
 * */
export class DrawingGraph extends DrawingNode {
  private _defaultNodeObject: DrawingObject
  public get defaultNodeObject(): DrawingObject {
    return this._defaultNodeObject
  }
  public set defaultNodeObject(value: DrawingObject) {
    this._defaultNodeObject = value
  }
  defaultEdgeObject: DrawingObject
  static getDrawingGraph(g: Graph): DrawingGraph {
    return DrawingObject.getDrawingObj(g) as DrawingGraph
  }
  /** this node does not belong to the graph,
   but rather serves as a template for the other node's attributes (like filledColor, style, etc.) */
  graphVisData: GraphVisData = {
    sameRanks: new Array<string[]>(),
    minRanks: new Array<string>(),
    maxRanks: new Array<string>(),
    sourceRanks: new Array<string>(),
    sinkRanks: new Array<string>(),
  }
  get graph(): Graph {
    return this.entity as Graph
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

  textMeasure: (text: string, opts: Partial<TextMeasurerOptions>) => Size
  createGeometry(
    textMeasure: (label: string, opts: Partial<TextMeasurerOptions>) => Size = (str: string) => {
      if (!str) return null
      return new Size(str.length * 8 + 8, 20)
    },
  ): GeomGraph {
    const geomGraph = new GeomGraph(this.graph)
    this.textMeasure = textMeasure
    const opts: Partial<TextMeasurerOptions> = {fontFamily: this.fontname, fontSize: this.fontsize, fontStyle: 'normal'}
    geomGraph.labelSize = textMeasure(this.labelText, opts)
    for (const n of this.graph.deepNodes) {
      this.createNodeGeometry(n)
    }
    for (const e of this.graph.deepEdges) {
      this.createEdgeGeometry(e)
    }
    return geomGraph
  }
  private createEdgeGeometry(e: Edge) {
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(e)
    const ge = new GeomEdge(e)
    if (de.directed === false) {
      ge.targetArrowhead = null
    }
    if (de.labelText) {
      const size = this.textMeasure(de.labelText, {fontSize: de.fontsize, fontFamily: de.fontname, fontStyle: 'normal'})
      ge.label = new GeomLabel(Rectangle.mkPP(new Point(0, 0), new Point(size.width, size.height)), ge)
      de.measuredTextSize = size
    }
    if (de.penwidth) {
      ge.lineWidth = de.penwidth
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
      case ShapeEnum.record:
      case ShapeEnum.box:
        curve = CurveFactory.mkRectangleWithRoundedCorners(width, height, drawingNode.XRadius, drawingNode.YRadius, center)
        break
      case ShapeEnum.circle:
        curve = CurveFactory.mkCircle(Math.sqrt(width * width + height * height), center)
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
        curve = CurveFactory.mkCircle(Math.sqrt(width * width + height * height) + 2 * drawingNode.penwidth, center)
        break
      case ShapeEnum.house:
        curve = CurveFactory.createHouse(width, height, center)
        break
      case ShapeEnum.invhouse:
        curve = CurveFactory.createInvertedHouse(width, height, center)
        break
      case ShapeEnum.parallelogram:
        curve = CurveFactory.createParallelogram(width, height, center)
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
      case ShapeEnum.drawFromGeometry:
        break
      case ShapeEnum.hexagon:
        curve = CurveFactory.createHexagon(width, height, center)
        break
    }
    return curve ?? CurveFactory.mkRectangleWithRoundedCorners(width, height, drawingNode.XRadius, drawingNode.YRadius, center)
  }

  private createNodeGeometry(n: Node): void {
    if (n instanceof Graph) {
      const subDg = <DrawingGraph>DrawingObject.getDrawingObj(n)
      const geomGraph = new GeomGraph(n)
      if (subDg.labelText) {
        geomGraph.labelSize = subDg.measuredTextSize = measureTextSize(subDg, this.textMeasure)
      }
    } else {
      const drawingNode = <DrawingNode>DrawingNode.getDrawingObj(n)
      let textSize = new Size(1, 1)
      if (drawingNode.labelText) {
        textSize = measureTextSize(drawingNode, this.textMeasure)
      }
      drawingNode.measuredTextSize = textSize
      const center = new Point(0, 0)
      const geomNode = new GeomNode(n)
      const width = textSize.width + drawingNode.LabelMargin * 2
      const height = textSize.height + drawingNode.LabelMargin * 2
      geomNode.boundaryCurve = this.curveByShape(width, height, center, drawingNode.shape, drawingNode)
    }
  }
  measureLabelSizes(textMeasure: (text: string, opts: Partial<TextMeasurerOptions>) => Size) {
    for (const n of this.graph.deepNodes) {
      const dn = DrawingNode.getDrawingObj(n) as DrawingNode
      dn.measuredTextSize = measureTextSize(dn, textMeasure) ?? new Size(1, 1)
    }
  }
}

function measureTextSize(drawingNode: DrawingNode, textMeasure: (text: string, opts: Partial<TextMeasurerOptions>) => Size): Size {
  if (drawingNode.labelText) {
    return textMeasure(drawingNode.labelText, {
      fontSize: drawingNode.fontsize,
      fontFamily: drawingNode.fontname,
      fontStyle: 'normal', // TODO: find in styles?
    })
  }
  return null
}
