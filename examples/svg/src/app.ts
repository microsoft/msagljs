import {parseDot} from '@msagl/parser'
import {Edge, GeomEdge, GeomGraph, GeomNode, Graph, ICurve, layoutGraphWithSugiayma, Node, Rectangle} from 'msagl-js'
import {Color, DrawingEdge, DrawingGraph, DrawingNode, DrawingObject} from 'msagl-js/drawing'
import {GeomObject} from '../../../modules/core/src/layout/core/geomObject'
import {Curve, LineSegment, Point, Polyline} from '../../../modules/core/src/math/geometry'
import {BezierSeg} from '../../../modules/core/src/math/geometry/bezierSeg'
import {Ellipse} from '../../../modules/core/src/math/geometry/ellipse'
import {String} from 'typescript-string-operations'
import {Arrowhead} from '../../../modules/core/src/layout/core/arrowhead'
const graphString =
  'digraph abstract {\n' +
  'S1[color=blue fillcolor=salmon]' +
  'S24[color=deepskyblue]' +
  'S35[color=goldenrod]' +
  '	size="6,6";\n' +
  '  S24 -> 27;\n' +
  '  S24 -> 25;\n' +
  '  S1 -> 10;\n' +
  '  S1 -> 2;\n' +
  '  S35 -> 36;\n' +
  '  S35 -> 43;\n' +
  '  S30 -> 31;\n' +
  '  S30 -> 33;\n' +
  '  9 -> 42;\n' +
  '  9 -> T1;\n' +
  '  25 -> T1;\n' +
  '  25 -> 26;\n' +
  '  27 -> T24;\n' +
  '  2 -> 3;\n' +
  '  2 -> 16;\n' +
  '  2 -> 17;\n' +
  '  2 -> T1;\n' +
  '  2 -> 18;\n' +
  '  10 -> 11;\n' +
  '  10 -> 14;\n' +
  '  10 -> T1;\n' +
  '  10 -> 13;\n' +
  '  10 -> 12;\n' +
  '  31 -> T1;\n' +
  '  31 -> 32;\n' +
  '  33 -> T30;\n' +
  '  33 -> 34;\n' +
  '  42 -> 4;\n' +
  '  26 -> 4;\n' +
  '  3 -> 4 [color = "yellow"];\n' +
  '  16 -> 15;\n' +
  '  17 -> 19;\n' +
  '  18 -> 29;\n' +
  '  11 -> 4;\n' +
  '  14 -> 15;\n' +
  '  37 -> 39;\n' +
  '  37 -> 41;\n' +
  '  37 -> 38;\n' +
  '  37 -> 40;\n' +
  '  13 -> 19;\n' +
  '  12 -> 29;\n' +
  '  43 -> 38;\n' +
  '  43 -> 40;\n' +
  '  36 -> 19;\n' +
  '  32 -> 23;\n' +
  '  34 -> 29;\n' +
  '  39 -> 15;\n' +
  '  41 -> 29;\n' +
  '  38 -> 4;\n' +
  '  40 -> 19;\n' +
  '  4 -> 5;\n' +
  '  19 -> 21;\n' +
  '  19 -> 20;\n' +
  '  19 -> 28;\n' +
  '  5 -> 6;\n' +
  '  5 -> T35;\n' +
  '  5 -> 23;\n' +
  '  21 -> 22;\n' +
  '  20 -> 15;\n' +
  '  28 -> 29;\n' +
  '  6 -> 7;\n' +
  '  15 -> T1;\n' +
  '  22 -> 23;\n' +
  '  22 -> T35;\n' +
  '  29 -> T30;\n' +
  '  7 -> T8;\n' +
  '  23 -> T24;\n' +
  '  23 -> T1;\n' +
  '  23 [fillcolor = "#1000FF1F"]\n' +
  '  }\n'
const graph = parseDot(graphString)
const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
dg.createGeometry()
layoutGraphWithSugiayma(<GeomGraph>GeomGraph.getGeom(graph), null, false)

const svgns = 'http://www.w3.org/2000/svg'

/** this class creates SVG content for a given Graph */
class SvgCreator {
  static arrowAngle = 25
  svg: any
  graph: Graph
  geomGraph: GeomGraph
  transformRequired: boolean
  constructor(graph: Graph, transformRequired = false) {
    this.graph = graph
    this.transformRequired = transformRequired
  }
  createSvg(): any {
    this.svg = document.createElementNS(svgns, 'svg')

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
  drawEdge(edge: Edge) {
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
  DrawEdgeLabel(edge: Edge) {
    // throw new Error('Method not implemented.')
  }
  AddArrows(edge: Edge) {
    const geomEdge = <GeomEdge>GeomEdge.getGeom(edge)
    const curve = geomEdge.curve
    this.AddArrowhead(edge, geomEdge.sourceArrowhead, curve.start)

    this.AddArrowhead(edge, geomEdge.targetArrowhead, curve.end)
  }
  AddArrowhead(edge: Edge, arrowhead: Arrowhead, base: Point) {
    if (!arrowhead) return

    const path = document.createElementNS(svgns, 'polygon')
    const de = <DrawingEdge>DrawingEdge.getDrawingObj(edge)
    this.setStroke(path, de)
    const points = getArrowheadPoints(base, arrowhead.tipPosition)
    path.setAttribute('points', pointsToString(points))
    this.svg.appendChild(path)
  }

  setStroke(path: SVGPathElement, de: DrawingObject) {
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
    const path = document.createElementNS(svgns, 'path')
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
    const fontSize = drawingNode.fontsize
    const textEl = document.createElementNS(svgns, 'text')
    textEl.setAttribute('x', x.toString())
    textEl.setAttribute('y', y.toString())
    textEl.setAttribute('text-anchor', 'middle')
    textEl.setAttribute('alignment-baseline', 'middle')
    textEl.setAttribute('font-family', drawingNode.fontname)
    textEl.setAttribute('font-size', fontSize.toString())

    textEl.setAttribute('fill', msaglToSvgColor(drawingNode.fontColor))
    textEl.appendChild(document.createTextNode(drawingNode.labelText))
    this.svg.appendChild(textEl)
  }

  close() {
    if (this.transformRequired) {
      throw new Error('not implemented')
    }
  }
  open() {
    this.svg.setAttribute('width', this.geomGraph.width)
    this.svg.setAttribute('height', this.geomGraph.height)
    if (this.transformRequired) {
      throw new Error('not implemented')
    }
  }
}

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
        yield this.bezierSegToString(iCurve as BezierSeg)
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

const svgCreator = new SvgCreator(graph)

document.body.appendChild(svgCreator.createSvg())
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
