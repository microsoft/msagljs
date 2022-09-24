import {
  Edge,
  Ellipse,
  GeomEdge,
  GeomGraph,
  GeomNode,
  Graph,
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
} from 'msagl-js/drawing'
import TextMeasurer from './text-measurer'
import {String} from 'typescript-string-operations'
import {Entity} from '../../core/src/structs/entity'
import {default as svgPanZoom, PanZoom} from 'panzoom'
import {IntersectionCache} from 'msagl-js/src/routing/spline/bundling/IntersectionCache'
class SvgObject {
  /**  This is the field from the Graph. It is used to keep the connection with the underlying graph */
  entity: Entity
  bind() {
    if (this.entity) this.entity.setAttr(AttributeRegistry.ViewerIndex, this)
  }

  constructor(attrCont: Entity, svgData: SVGElement) {
    this.entity = attrCont
    this.svgData = svgData
    this.bind()
  }

  svgData: SVGElement
  isVisible: boolean
  MarkedForDragging: boolean
  MarkedForDraggingEvent: (sender: any, eventParameters: any) => void
  UnmarkedForDraggingEvent: (sender: any, eventParameters: any) => void
}

class SvgGraph extends SvgObject implements IViewerGraph {
  get graph(): Graph {
    return this.entity as Graph
  }
}
class SvgNode extends SvgObject implements IViewerNode {
  get node(): Node {
    return this.entity as Node
  }
  IsCollapsedChanged: EventHandler
}
class SvgEdge extends SvgObject implements IViewerEdge {
  SelectedForEditing: boolean
  get edge(): Edge {
    return this.entity as Edge
  }
  IsCollapsedChanged: (node: IViewerNode) => void
}
/** this class creates SVG content for a given Graph */
export class SvgCreator {
  private panZoom: PanZoom
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
    this.svg = createAndBindWithGraph(this.graph, 'svg') as SVGSVGElement
    this.svg.setAttribute('style', 'border: 1px solid black')
    this.geomGraph = GeomGraph.getGeom(this.graph)
    this.open()
    this.transformGroup = createAndBindWithGraph(null, 'g') as SVGSVGElement
    this.svg.appendChild(this.transformGroup)

    // After an y flip the top has moved to -top : need to translate to zero
    this.transformGroup.setAttribute('transform', String.Format('matrix(1,0,0,-1, {0},{1})', -this.geomGraph.left, this.geomGraph.top))
    for (const node of this.graph.deepNodes) {
      this.drawNode(node)
    }
    for (const edge of this.graph.deepEdges) {
      this.drawEdge(edge)
    }

    this.container.appendChild(this.svg)
    this.panZoom = svgPanZoom(this.svg)
  }
  /** gets transform from PanZoom */
  getTransform(): {x: number; y: number; scale: number} {
    return this.panZoom.getTransform()
  }

  private drawEdge(edge: Edge) {
    if ((GeomEdge.getGeom(edge) as GeomEdge).curve == null) return
    const edgeGroup = createAndBindWithGraph(edge, 'g')

    const path = document.createElementNS(svgns, 'path')
    edgeGroup.appendChild(path)
    path.setAttribute('fill', 'none')
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(edge)
    this.setStroke(path, de)
    const geometryEdge = <GeomEdge>GeomEdge.getGeom(edge)
    path.setAttribute('d', curveString(geometryEdge.curve))
    for (const a of this.AddArrows(edge)) {
      edgeGroup.appendChild(a)
    }
    this.DrawEdgeLabel(edge)
    this.transformGroup.appendChild(edgeGroup)
  }

  private DrawEdgeLabel(edge: Edge) {
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(edge)
    const geometryEdge = <GeomEdge>GeomEdge.getGeom(edge)
    const label = geometryEdge.label
    if (!label) return
    this.drawLabelAtXY(de, label.boundingBox)
  }
  private *AddArrows(edge: Edge): IterableIterator<SVGElement> {
    const geomEdge = <GeomEdge>GeomEdge.getGeom(edge)
    const curve = geomEdge.curve
    let a = this.AddArrowhead(edge, geomEdge.sourceArrowhead, curve.start)
    if (a) yield a
    a = this.AddArrowhead(edge, geomEdge.targetArrowhead, curve.end)
    if (a) yield a
  }
  private AddArrowhead(edge: Edge, arrowhead: Arrowhead, base: Point): SVGElement | null {
    if (!arrowhead) return

    const path = <SVGPathElement>createAndBindWithGraph(edge, 'polygon')
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
    const gn = GeomObject.getGeom(node) as GeomNode
    const boundaryCurve = gn.boundaryCurve
    if (!boundaryCurve) return
    this.drawNodeOnCurve(boundaryCurve, node)
  }
  private drawNodeOnCurve(boundaryCurve: ICurve, node: Node) {
    const dn = DrawingObject.getDrawingObj(node) as DrawingNode
    if (dn.shape != ShapeEnum.plaintext) {
      this.makePathOnCurve(node, dn, boundaryCurve)
      if (dn.shape == ShapeEnum.doublecircle) {
        let ellipse = boundaryCurve as Ellipse
        const r = ellipse.aAxis.length - 2 * dn.penwidth
        ellipse = CurveFactory.mkCircle(r, ellipse.center)
        this.makePathOnCurve(node, dn, ellipse)
      }
    }
    this.drawLabel(node, dn)
  }
  private makePathOnCurve(node: Node, dn: DrawingNode, boundaryCurve: ICurve) {
    const path = <SVGPathElement>createAndBindWithGraph(node, 'path')
    if (dn.styles.find((s) => s == StyleEnum.filled)) {
      const c = dn.fillColor ?? dn.color ?? DrawingNode.defaultFillColor
      path.setAttribute('fill', msaglToSvgColor(c))
    } else {
      path.setAttribute('fill', 'none')
    }
    path.setAttribute('d', curveString(boundaryCurve))
    path.setAttribute('stroke', msaglToSvgColor(dn.color))
    path.setAttribute('stroke-width', dn.penwidth.toString())

    this.transformGroup.appendChild(path)
  }

  private drawLabel(node: Node, dn: DrawingObject) {
    if (!dn) return
    if (!dn.labelText || dn.labelText.length == 0) return

    if (dn instanceof DrawingNode) {
      this.writeLabelText(node, dn.measuredTextSize)
    } else {
      throw new Error('not implemented')
    }
  }
  private writeLabelText(node: Node, measuredTextSize: Size) {
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
    this.drawLabelAtXY(drawingNode, rect)
  }

  private drawLabelAtXY(drawingObject: DrawingObject, rect: Rectangle) {
    const fontSize = drawingObject.fontsize
    const textEl = <SVGTextElement>createAndBindWithGraph(drawingObject.entity, 'text')
    textEl.setAttribute('text-anchor', 'middle')
    textEl.setAttribute('x', rect.center.x.toString())
    textEl.setAttribute('fill', msaglToSvgColor(drawingObject.fontColor))
    textEl.setAttribute('font-family', drawingObject.fontname)
    textEl.setAttribute('font-size', fontSize.toString() + 'px')
    textEl.setAttribute('transform', 'scale(1,-1)')

    this.createTspans(drawingObject.labelText, textEl, fontSize, rect)

    this.transformGroup.appendChild(textEl)
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
    this.svg.setAttribute('width', this.geomGraph.width.toString())
    this.svg.setAttribute('height', this.geomGraph.height.toString())
    this.geomGraph = GeomGraph.getGeom(this.graph)
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

function createAndBindWithGraph(entity: Entity, name: string): SVGElement {
  if (entity instanceof Graph) {
    const svgNode = document.createElementNS(svgns, name)
    new SvgGraph(entity, svgNode)
    return svgNode
  }
  if (entity instanceof Node) {
    const svgNode = document.createElementNS(svgns, name)
    new SvgNode(entity, svgNode)
    return svgNode
  }
  if (entity instanceof Edge) {
    const svgNode = document.createElementNS(svgns, name)
    new SvgEdge(entity, svgNode)
    return svgNode
  }

  {
    const svgNode = document.createElementNS(svgns, name)
    new SvgObject(entity, svgNode)
    return svgNode
  }
}
