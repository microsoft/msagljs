import {RenderOptions} from '@msagl/renderer'
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
} from 'msagl-js'
import {DrawingEdge, DrawingObject, DrawingNode, DrawingGraph, Color} from 'msagl-js/drawing'
import {layoutDrawingGraph} from '../../../modules/renderer/src/layout'
import TextMeasurer from '../../../modules/renderer/src/text-measurer'
import {String} from 'typescript-string-operations'
import {Entity} from '../../../modules/core/src/structs/entity'

class SvgObject {
  static attachIndex = 2
  /**  This is the field from the Graph. It is used to keep the connection with the underlying graph */
  entity: Entity
  bind() {
    if (this.entity) this.entity.setAttr(SvgObject.attachIndex, this)
  }

  constructor(attrCont: Entity, svgData: any) {
    this.entity = attrCont
    this.svgData = svgData
    this.bind()
  }

  static getGeom(attrCont: Entity): GeomObject {
    return attrCont.getAttr(SvgObject.attachIndex)
  }
  svgData: any
}
/** this class creates SVG content for a given Graph */
export class SvgCreator {
  static arrowAngle = 25
  svg: any
  graph: Graph
  geomGraph: GeomGraph
  transformRequired: boolean
  _textMeasurer = new TextMeasurer()

  private _renderOptions: any
  public constructor(transformRequired = false) {
    this.transformRequired = transformRequired
  }
  private createAndBindWithGraph(entity: Entity, name: string) {
    const svgNode = document.createElementNS(svgns, name)
    new SvgObject(entity, svgNode)
    return svgNode
  }
  setGraph(graph: Graph, options: RenderOptions): any {
    this.graph = graph
    {
      this._renderOptions = options
      this._textMeasurer.setOptions(options.label || {})

      const drawingGraph = <DrawingGraph>DrawingGraph.getDrawingObj(graph) || new DrawingGraph(graph)
      drawingGraph.createGeometry(this._textMeasurer.measure)
      layoutDrawingGraph(drawingGraph, this._renderOptions, true)
    }

    this.svg = this.createAndBindWithGraph(this.graph, 'svg')
    this.svg.setAttribute('style', 'border: 1px solid black')
    this.geomGraph = <GeomGraph>GeomGraph.getGeom(this.graph)
    if (!this.geomGraph) return null
    this.geomGraph.updateBoundingBox()
    this.open()
    for (const node of this.graph.deepNodes) {
      this.drawNode(node)
    }
    for (const edge of this.graph.deepEdges()) {
      this.drawEdge(edge)
    }
    this.close()
    return this.svg
  }
  private drawEdge(edge: Edge) {
    const path = document.createElementNS(svgns, 'path')
    path.setAttribute('fill', 'none')
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(edge)
    this.setStroke(path, de)
    const geometryEdge = <GeomEdge>GeomEdge.getGeom(edge)
    path.setAttribute('d', curveString(geometryEdge.curve))
    this.AddArrows(edge)
    this.DrawEdgeLabel(edge)
    this.svg.appendChild(path)
    /*
      WriteStartElement("path");
      WriteAttribute("fill", "none");
      var geometryEdge = edge.GeometryEdge;
      var iCurve = geometryEdge.Curve;
      WriteStroke(edge.Attr);
      WriteAttribute("d", CurveString(iCurve));
      WriteEndElement();
      if (geometryEdge.EdgeGeometry != null && geometryEdge.EdgeGeometry.SourceArrowhead != null)
          AddArrow(iCurve.Start, geometryEdge.EdgeGeometry.SourceArrowhead.TipPosition, edge);
      if (geometryEdge.EdgeGeometry != null && geometryEdge.EdgeGeometry.TargetArrowhead != null)
          AddArrow(iCurve.End, geometryEdge.EdgeGeometry.TargetArrowhead.TipPosition, edge);
      if (edge.Label != null && edge.Label.GeometryLabel != null)
          WriteLabel(edge.Label);*/
  }
  private DrawEdgeLabel(edge: Edge) {
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(edge)
    const geometryEdge = <GeomEdge>GeomEdge.getGeom(edge)
    const label = geometryEdge.label
    if (!label) return
    this.drawLabelOnCenter(de, label.center.x, label.center.y)
  }
  private AddArrows(edge: Edge) {
    const geomEdge = <GeomEdge>GeomEdge.getGeom(edge)
    const curve = geomEdge.curve
    this.AddArrowhead(edge, geomEdge.sourceArrowhead, curve.start)

    this.AddArrowhead(edge, geomEdge.targetArrowhead, curve.end)
  }
  private AddArrowhead(edge: Edge, arrowhead: Arrowhead, base: Point) {
    if (!arrowhead) return

    const path = <SVGPathElement>(<unknown>this.createAndBindWithGraph(edge, 'polygon'))
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(edge)
    this.setStroke(path, de)
    const points = getArrowheadPoints(base, arrowhead.tipPosition)
    path.setAttribute('points', pointsToString(points))
    this.svg.appendChild(path)
  }

  private setStroke(path: SVGPathElement, de: DrawingObject) {
    path.setAttribute('stroke', msaglToSvgColor(de.color))
    path.setAttribute('stroke-opacity', (de.color.A / 255).toString())
    path.setAttribute('stroke-width', de.penwidth.toString())
    // if (attr.Styles.Any(style => style == Style.Dashed)) {
    //     WriteAttribute("stroke-dasharray", 5);
    // } else if (attr.Styles.Any(style => style == Style.Dotted)) {
    //     WriteAttribute("stroke-dasharray", 2);
    // }
  }
  drawNode(node: Node) {
    const gn = GeomObject.getGeom(node) as GeomNode
    const boundaryCurve = gn.boundaryCurve
    if (!boundaryCurve) return
    this.drawNodeOnCurve(boundaryCurve, node)
  }
  drawNodeOnCurve(boundaryCurve: ICurve, node: Node) {
    const dn = DrawingObject.getDrawingObj(node)
    const path = <SVGPathElement>(<unknown>this.createAndBindWithGraph(node, 'path'))
    if (dn.fillColor) {
      path.setAttribute('fill', msaglToSvgColor(dn.fillColor))
    } else {
      path.setAttribute('fill', msaglToSvgColor(DrawingNode.defaultFillColor))
    }
    path.setAttribute('d', curveString(boundaryCurve))
    path.setAttribute('stroke', msaglToSvgColor(dn.color))
    this.svg.appendChild(path)
    this.drawLabel(node, dn)
  }
  private drawLabel(node: Node, dn: DrawingObject) {
    if (!dn) return
    if (!dn.labelText || dn.labelText.length == 0) return

    if (dn instanceof DrawingNode) {
      this.writeLabelText(node)
    } else if (dn instanceof DrawingGraph) {
      throw new Error('not implemented')
    } else {
      throw new Error('not implemented')
    }
  }
  private writeLabelText(node: Node) {
    const geomNode = <GeomNode>GeomNode.getGeom(node)
    const labelBox = geomNode.boundingBox
    const x = labelBox.center.x
    const y = labelBox.center.y
    const drawingNode = <DrawingNode>DrawingObject.getDrawingObj(node)
    this.drawLabelOnCenter(drawingNode, x, y)
  }

  private drawLabelOnCenter(drawingObject: DrawingObject, x: number, y: number) {
    const fontSize = drawingObject.fontsize
    const textEl = <SVGTextElement>(<unknown>this.createAndBindWithGraph(drawingObject.attrCont, 'text'))
    textEl.setAttribute('x', x.toString())
    textEl.setAttribute('y', y.toString())
    textEl.setAttribute('text-anchor', 'middle')
    textEl.setAttribute('alignment-baseline', 'middle')
    textEl.setAttribute('font-family', drawingObject.fontname)
    textEl.setAttribute('font-size', fontSize.toString())

    textEl.setAttribute('fill', msaglToSvgColor(drawingObject.fontColor))
    textEl.appendChild(document.createTextNode(drawingObject.labelText))
    this.svg.appendChild(textEl)
  }

  private close() {
    if (this.transformRequired) {
      throw new Error('not implemented')
    }
  }
  private open() {
    this.svg.setAttribute('width', this.geomGraph.width)
    this.svg.setAttribute('height', this.geomGraph.height)
    if (this.transformRequired) {
      throw new Error('not implemented')
    }
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
            if (isFullEllipse(ellipse)) {
              yield this.ellipseToString(new Ellipse(0, Math.PI, ellipse.aAxis, ellipse.bAxis, ellipse.center))
              yield this.ellipseToString(new Ellipse(Math.PI, Math.PI * 2, ellipse.aAxis, ellipse.bAxis, ellipse.center))
            } else yield this.ellipseToString(ellipse)
          }
        }
      }
    }
  }
}
function isFullEllipse(ell: Ellipse): boolean {
  return ell.parEnd == Math.PI * 2 && ell.parStart == 0
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
export function pointsToString(points: Point[]) {
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

export function msaglToSvgColor(color: Color): string {
  if (!color) return 'Black'
  return 'rgba(' + color.R + ',' + color.G + ',' + color.B + ',' + color.A / 255.0 + ')'
}
export function getArrowheadPoints(start: Point, end: Point): Point[] {
  let dir = end.sub(start)
  const h = dir
  dir = dir.normalize()
  let s = new Point(-dir.y, dir.x)
  const mul = h.length * Math.tan(SvgCreator.arrowAngle * 0.5 * (Math.PI / 180.0))
  s = s.mul(mul)
  return [start.add(s), end, start.sub(s)]
}
