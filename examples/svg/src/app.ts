import {parseDot} from '@msagl/parser'
import {GeomGraph, GeomNode, Graph, ICurve, layoutGraphWithSugiayma, Node, Rectangle} from 'msagl-js'
import {DrawingGraph, DrawingNode, DrawingObject} from 'msagl-js/drawing'
import {GeomObject} from '../../../modules/core/src/layout/core/geomObject'
import {Curve, LineSegment, Point, Polyline} from '../../../modules/core/src/math/geometry'
import {BezierSeg} from '../../../modules/core/src/math/geometry/bezierSeg'
import {Ellipse} from '../../../modules/core/src/math/geometry/ellipse'
import {String, StringBuilder} from 'typescript-string-operations'
const graphString = 'digraph G {\n' + 'a -> b\n' + 'a -> b}'
const graph = parseDot(graphString)
const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
dg.createGeometry()
layoutGraphWithSugiayma(<GeomGraph>GeomGraph.getGeom(graph), null, false)

const svgns = 'http://www.w3.org/2000/svg'

class SvgCreator {
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

      /*const newRect = document.createElementNS(svgns, 'rect')
      newRect.setAttribute('x', gn.boundingBox.left.toString())
      newRect.setAttribute('y', gn.boundingBox.bottom.toString())
      newRect.setAttribute('width', gn.boundingBox.width.toString())
      newRect.setAttribute('height', gn.boundingBox.height.toString())
      newRect.setAttribute('fill', '#5cceee')
      this.svg.appendChild(newRect)*/
    }
    this.close()
    return this.svg
  }
  drawNode(node: Node) {
    const gn = GeomObject.getGeom(node) as GeomNode
    const boundaryCurve = gn.boundaryCurve
    if (!boundaryCurve) return
    this.drawNodeOnCurve(boundaryCurve, node)
  }
  drawNodeOnCurve(boundaryCurve: ICurve, node: Node) {
    const path = document.createElementNS(svgns, 'path')
    path.setAttribute('fill', 'none')
    path.setAttribute('d', curveString(boundaryCurve))
    path.setAttribute('stroke', 'Green')
    this.svg.appendChild(path)
    const dn = DrawingObject.getDrawingObj(node)
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

    textEl.setAttribute('fill', drawingNode.fontColor ? drawingNode.fontColor.toString() : 'Black')
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
