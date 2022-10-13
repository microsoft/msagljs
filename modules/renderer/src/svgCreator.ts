import {
  Edge,
  Ellipse,
  GeomEdge,
  GeomGraph,
  GeomNode,
  Graph,
  Label,
  ICurve,
  Point,
  Node,
  Curve,
  BezierSeg,
  LineSegment,
  Polyline,
  GeomObject,
  Arrowhead,
  Rectangle,
  Size,
  CurveFactory,
  AttributeRegistry,
  EventHandler,
  PlaneTransformation,
} from 'msagl-js'
import {
  DrawingEdge,
  DrawingObject,
  DrawingNode,
  Color,
  StyleEnum,
  ShapeEnum,
  IViewerGraph,
  IViewerNode,
  IViewerEdge,
  IViewerObject,
} from 'msagl-js/drawing'
import TextMeasurer from './text-measurer'
import {String} from 'typescript-string-operations'
import {Entity} from '../../core/src/structs/entity'
import {Attribute} from 'msagl-js/src/structs/attribute'

class SvgViewerObject extends Attribute {
  clone(): Attribute {
    throw new Error('not implemented')
  }
  rebind(e: Entity): void {
    this.entity = e
    this.bind(AttributeRegistry.ViewerIndex)
  }
  /**  This is the field from the Graph. It is used to keep the connection with the underlying graph */

  constructor(attrCont: Entity, svgData: SVGElement) {
    super(attrCont, AttributeRegistry.ViewerIndex)
    this.svgData = svgData
  }

  svgData: SVGElement
  isVisible = true
  MarkedForDragging = false
  MarkedForDraggingEvent: (sender: any, eventParameters: any) => void
  UnmarkedForDraggingEvent: (sender: any, eventParameters: any) => void
}

class SvgViewerGraph extends SvgViewerObject implements IViewerGraph {
  get graph(): Graph {
    return this.entity as Graph
  }
}
class SvgViewerNode extends SvgViewerObject implements IViewerNode {
  get node(): Node {
    return this.entity as Node
  }
  IsCollapsedChanged: EventHandler
}
class SvgViewerLabel extends SvgViewerObject implements IViewerObject {}
class SvgViewerEdge extends SvgViewerObject implements IViewerEdge {
  RadiusOfPolylineCorner: number
  SelectedForEditing: boolean
  get edge(): Edge {
    return this.entity as Edge
  }
  IsCollapsedChanged: (node: IViewerNode) => void
}
/** this class creates SVG content for a given Graph */
export class SvgCreator {
  invalidate(objectToInvalidate: IViewerObject) {
    const svgViewerObj = objectToInvalidate as SvgViewerObject
    const svgElem = svgViewerObj.svgData as Element
    svgElem.parentElement.removeChild(svgElem)
    const entity = svgViewerObj.entity
    if (entity instanceof Node) {
      this.drawNode(entity)
    } else if (entity instanceof Edge) {
      this.drawEdge(entity)
    } else if (entity instanceof Label) {
      this.drawEdgeLabel(entity)
    } else {
      throw new Error('not implemented')
    }
  }

  getSvgString(): string {
    if (this.svg == null) return null
    return new XMLSerializer().serializeToString(this.svg)
  }
  static arrowAngle = 25
  svg: SVGElement
  transformGroup: SVGSVGElement
  graph: Graph
  geomGraph: GeomGraph
  _textMeasurer = new TextMeasurer()

  private container: HTMLElement
  public constructor(container: HTMLElement) {
    this.container = container
  }

  private clearContainer() {
    while (this.container.childNodes.length > 0) this.container.removeChild(this.container.firstChild)
  }

  /** It cleans the current SVG content
   * and creates the new one corresponding to the graph
   * */
  setGraph(graph: Graph): void {
    this.clearContainer()
    this.graph = graph
    this.svg = this.createAndBindWithGraph(this.graph, 'svg') as SVGSVGElement
    this.svg.setAttribute('style', 'border: 1px solid black')
    this.geomGraph = GeomGraph.getGeom(this.graph)
    this.open()
    this.transformGroup = this.createAndBindWithGraph(null, 'g') as SVGSVGElement
    this.svg.appendChild(this.transformGroup)

    // After the y flip the top has moved to -top : translating it to zero
    this.transformGroup.setAttribute('transform', String.Format('matrix(1,0,0,-1, {0},{1})', -this.geomGraph.left, this.geomGraph.top))
    for (const node of this.graph.deepNodes) {
      this.drawNode(node)
    }
    for (const edge of this.graph.deepEdges) {
      this.drawEdge(edge)
      this.drawEdgeLabel(edge.label)
    }

    this.container.appendChild(this.svg)
  }
  /** gets transform from svg to the client window coordinates */
  getTransform(): PlaneTransformation {
    const tr = (this.svg as SVGGraphicsElement).getScreenCTM()
    const m = new PlaneTransformation(tr.a, tr.b, tr.e, tr.c, tr.d, tr.f)
    const flip = new PlaneTransformation(1, 0, -this.geomGraph.left, 0, -1, this.geomGraph.top)
    // first we apply flip then m
    return m.multiply(flip)
  }

  getScale(): number {
    return (this.svg as SVGGraphicsElement).getScreenCTM().a
  }

  private drawEdge(edge: Edge) {
    if ((GeomEdge.getGeom(edge) as GeomEdge).curve == null) return
    const edgeGroup = this.createAndBindWithGraph(edge, 'g')
    this.transformGroup.appendChild(edgeGroup)
    const path = document.createElementNS(svgns, 'path')
    edgeGroup.appendChild(path)
    path.setAttribute('fill', 'none')
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(edge)
    this.setStroke(path, de)
    const geometryEdge = <GeomEdge>GeomEdge.getGeom(edge)
    path.setAttribute('d', curveString(geometryEdge.curve))
    this.AddArrows(edge, edgeGroup)
  }

  private drawEdgeLabel(edgeLabel: Label) {
    if (edgeLabel == null) return
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(edgeLabel.parent)
    const geomLabel = edgeLabel.getAttr(AttributeRegistry.GeomObjectIndex)
    if (!geomLabel) return
    this.drawLabelAtXY(edgeLabel, de, geomLabel.boundingBox, this.transformGroup)
  }
  private AddArrows(edge: Edge, group: SVGElement) {
    const geomEdge = <GeomEdge>GeomEdge.getGeom(edge)
    const curve = geomEdge.curve
    let a = this.AddArrowhead(edge, geomEdge.sourceArrowhead, curve.start, group)
    if (a) {
      group.appendChild(a)
    }
    a = this.AddArrowhead(edge, geomEdge.targetArrowhead, curve.end, group)
    if (a) {
      group.appendChild(a)
    }
  }
  private AddArrowhead(edge: Edge, arrowhead: Arrowhead, base: Point, group: SVGElement): SVGElement | null {
    if (!arrowhead) return

    const path = document.createElementNS(svgns, 'polygon')
    group.appendChild(path)
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(edge)
    this.setStroke(path, de)
    const points = getArrowheadPoints(base, arrowhead.tipPosition)
    path.setAttribute('points', pointsToString(points))
    return path
  }

  private setStroke(path: SVGPathElement, de: DrawingObject) {
    const msaglColor = msaglToSvgColor(de.color)
    path.setAttribute('stroke', msaglColor)
    path.setAttribute('stroke-opacity', (de.color ? de.color.A / 255 : 1).toString())
    path.setAttribute('stroke-width', de.penwidth.toString())
    if (de.styles && de.styles.length) {
      for (const style of de.styles) {
        this.attachStyleToPath(path, style)
      }
    }
  }
  attachStyleToPath(path: SVGPathElement, style: StyleEnum) {
    switch (style) {
      case StyleEnum.dashed:
        path.setAttribute('stroke-dasharray', '5')
        break
      case StyleEnum.dotted:
        path.setAttribute('stroke-dasharray', '2')
        break
      default:
        //todo: support more styles
        break
    }
  }
  private drawNode(node: Node) {
    const nodeGroupSvg = this.createAndBindWithGraph(node, 'g')
    this.transformGroup.appendChild(nodeGroupSvg)
    const gn = GeomObject.getGeom(node) as GeomNode

    const boundaryCurve = gn.boundaryCurve
    if (!boundaryCurve) return
    this.drawNodeOnCurve(boundaryCurve, node, nodeGroupSvg)
  }
  private drawNodeOnCurve(boundaryCurve: ICurve, node: Node, nodeGroup: SVGElement) {
    const dn = DrawingObject.getDrawingObj(node) as DrawingNode
    if (dn.shape != ShapeEnum.plaintext) {
      this.makePathOnCurve(node, dn, boundaryCurve, nodeGroup)
      if (dn.shape == ShapeEnum.doublecircle) {
        let ellipse = boundaryCurve as Ellipse
        const r = ellipse.aAxis.length - 2 * dn.penwidth
        ellipse = CurveFactory.mkCircle(r, ellipse.center)
        this.makePathOnCurve(node, dn, ellipse, nodeGroup)
      }
    }
    this.drawLabel(node, dn, nodeGroup)
  }
  private makePathOnCurve(node: Node, dn: DrawingNode, boundaryCurve: ICurve, nodeGroup: SVGElement) {
    const path = document.createElementNS(svgns, 'path')
    nodeGroup.appendChild(path)
    if (dn.styles.find((s) => s == StyleEnum.filled)) {
      const c = dn.fillColor ?? dn.color ?? DrawingNode.defaultFillColor
      path.setAttribute('fill', msaglToSvgColor(c))
    } else {
      path.setAttribute('fill', 'none')
    }
    path.setAttribute('d', curveString(boundaryCurve))
    path.setAttribute('stroke', msaglToSvgColor(dn.color))
    path.setAttribute('stroke-width', dn.penwidth.toString())
  }

  private drawLabel(node: Node, dn: DrawingObject, nodeGroup: SVGElement) {
    if (!dn) return
    if (!dn.labelText || dn.labelText.length == 0) return

    if (dn instanceof DrawingNode) {
      this.writeLabelText(node, dn.measuredTextSize, nodeGroup)
    } else {
      throw new Error('not implemented')
    }
  }
  private writeLabelText(node: Node, measuredTextSize: Size, nodeGroup: SVGElement) {
    const geomNode = <GeomNode>GeomNode.getGeom(node)
    const drawingNode = <DrawingNode>DrawingObject.getDrawingObj(node)
    const isGraph = node instanceof Graph
    const rect = isGraph
      ? Rectangle.creatRectangleWithSize(
          measuredTextSize,
          new Point(
            geomNode.boundaryCurve.boundingBox.center.x,
            geomNode.boundaryCurve.boundingBox.top - (measuredTextSize.height / 2 + drawingNode.LabelMargin),
          ),
        )
      : Rectangle.creatRectangleWithSize(measuredTextSize, geomNode.center)
    this.drawLabelAtXY(null, drawingNode, rect, nodeGroup)
  }

  private drawLabelAtXY(label: Label, drawingObject: DrawingObject, rect: Rectangle, group: SVGElement) {
    const fontSize = drawingObject.fontsize

    const textEl = this.createAndBindWithGraph(label, 'text') as SVGTextElement
    textEl.setAttribute('text-anchor', 'middle')
    textEl.setAttribute('x', rect.center.x.toString())
    textEl.setAttribute('fill', msaglToSvgColor(drawingObject.fontColor))
    textEl.setAttribute('font-family', drawingObject.fontname)
    textEl.setAttribute('font-size', fontSize.toString() + 'px')
    textEl.setAttribute('transform', 'scale(1,-1)')

    this.createTspans(drawingObject.labelText, textEl, fontSize, rect)

    group.appendChild(textEl)
  }

  createTspans(text: string, textEl: SVGTextElement, fontSize: number, rect: Rectangle) {
    const endOfLine = '\n'
    const textLines = text.split(endOfLine)
    if (textLines.length == 1) {
      const tspan = document.createElementNS(svgns, 'tspan')
      textEl.appendChild(tspan)
      tspan.textContent = text
      tspan.setAttribute('text-anchor', 'middle')
      tspan.setAttribute('x', rect.center.x.toString())
      tspan.setAttribute('alignment-baseline', 'middle')
      tspan.setAttribute('y', (-rect.center.y).toString())
    } else {
      let y = rect.top - 1
      for (let i = 0; i < textLines.length; i++) {
        const tspan = document.createElementNS(svgns, 'tspan')
        textEl.appendChild(tspan)
        tspan.textContent = textLines[i]
        tspan.setAttribute('text-anchor', 'middle')
        tspan.setAttribute('x', rect.center.x.toString())
        tspan.setAttribute('alignment-baseline', 'hanging')
        tspan.setAttribute('y', (-y).toString())
        y -= 1.21 * fontSize
      }
    }
  }

  private open() {
    this.setGraphWidthAndHightAttributes()
    this.geomGraph = GeomGraph.getGeom(this.graph)
  }

  setGraphWidthAndHightAttributes() {
    this.svg.setAttribute('width', this.geomGraph.width.toString())
    this.svg.setAttribute('height', this.geomGraph.height.toString())
  }

  createAndBindWithGraph(entity: Entity, name: string): SVGElement {
    const svgElement = document.createElementNS(svgns, name)
    const existingViewerObj = entity ? (entity.getAttr(AttributeRegistry.ViewerIndex) as SvgViewerObject) : null
    if (existingViewerObj) {
      existingViewerObj.svgData = svgElement
    } else if (entity instanceof Graph) {
      new SvgViewerGraph(entity, svgElement)
    } else if (entity instanceof Node) {
      new SvgViewerNode(entity, svgElement)
    } else if (entity instanceof Edge) {
      new SvgViewerEdge(entity, svgElement)
    } else if (entity instanceof Label) {
      new SvgViewerLabel(entity, svgElement)
    }

    return svgElement
  }
}
const svgns = 'http://www.w3.org/2000/svg'

function curveString(iCurve: ICurve): string {
  return String.Join(' ', Array.from(curveStringTokens(iCurve)))
}

function* curveStringTokens(iCurve: ICurve): IterableIterator<string> {
  yield 'M'
  yield pointToString(iCurve.start)
  const iscurve = iCurve instanceof Curve
  if (iscurve) for (const segment of (iCurve as Curve).segs) yield segmentString(segment)
  else {
    const islineSeg = iCurve instanceof LineSegment
    if (islineSeg) {
      yield 'L'
      yield pointToString(iCurve.end)
    } else {
      const isbezier = iCurve instanceof BezierSeg
      if (isbezier) {
        yield bezierSegToString(iCurve as BezierSeg)
      } else {
        const ispoly = iCurve instanceof Polyline
        if (ispoly) {
          const poly = iCurve as Polyline
          for (const p of poly.skip(1)) {
            yield 'L'
            yield pointToString(p.point)
          }
          if (poly.closed) {
            yield 'L'
            yield pointToString(poly.start)
          }
        } else {
          const isellipse = iCurve instanceof Ellipse
          if (isellipse) {
            const ellipse = iCurve as Ellipse
            if (ellipse.isFullEllipse()) {
              yield ellipseToString(new Ellipse(0, Math.PI, ellipse.aAxis, ellipse.bAxis, ellipse.center))
              yield ellipseToString(new Ellipse(Math.PI, Math.PI * 2, ellipse.aAxis, ellipse.bAxis, ellipse.center))
            } else this.ellipseToString(ellipse)
          }
        }
      }
    }
  }
}

function pointToString(start: Point) {
  return doubleToString(start.x) + ' ' + doubleToString(start.y)
}

function doubleToString(d: number) {
  return Math.abs(d) < 1e-11 ? '0' : d.toString() //formatForDoubleString, CultureInfo.InvariantCulture);
}

function bezierSegToString(cubic: BezierSeg): string {
  return 'C' + pointsToString([cubic.B(1), cubic.B(2), cubic.B(3)])
}

function ellipseToString(ellipse: Ellipse): string {
  const largeArc = Math.abs(ellipse.parEnd - ellipse.parStart) >= Math.PI ? '1' : '0'
  const sweepFlag = ellipse.orientedCounterclockwise() ? '1' : '0'

  return String.Join(
    ' ',
    'A',
    ellipseRadiuses(ellipse),
    doubleToString(Point.angle(new Point(1, 0), ellipse.aAxis) / (Math.PI / 180.0)),
    largeArc,
    sweepFlag,
    pointToString(ellipse.end),
  )
}
function ellipseRadiuses(ellipse: Ellipse): string {
  return doubleToString(ellipse.aAxis.length) + ',' + doubleToString(ellipse.bAxis.length)
}
function pointsToString(points: Point[]) {
  return String.Join(
    ' ',
    points.map((p) => pointToString(p)),
  )
}
function segmentString(c: ICurve): string {
  const isls = c instanceof LineSegment
  if (isls) return lineSegmentString(c as LineSegment)

  const iscubic = c instanceof BezierSeg
  if (iscubic) return bezierSegToString(c as BezierSeg)

  const isell = c instanceof Ellipse
  if (isell) return ellipseToString(c as Ellipse)

  throw new Error('NotImplementedException')
}

function lineSegmentString(ls: LineSegment): string {
  return 'L ' + pointToString(ls.end)
}

function msaglToSvgColor(color: Color): string {
  if (!color) return 'Black'
  return 'rgba(' + color.R + ',' + color.G + ',' + color.B + ',' + color.A / 255.0 + ')'
}
function getArrowheadPoints(start: Point, end: Point): Point[] {
  let dir = end.sub(start)
  const h = dir
  dir = dir.normalize()
  let s = new Point(-dir.y, dir.x)
  const mul = h.length * Math.tan(SvgCreator.arrowAngle * 0.5 * (Math.PI / 180.0))
  s = s.mul(mul)
  return [start.add(s), end, start.sub(s)]
}
