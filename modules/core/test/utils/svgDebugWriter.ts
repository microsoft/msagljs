import {String, StringBuilder} from 'typescript-string-operations'

import * as fs from 'fs'
// @ts-ignore
import xmlw from 'xml-writer'
import {Rectangle, Point, ICurve, GeomGraph, GeomEdge, Node} from '../../src'
import {LineSegment, Curve, Polyline} from '../../src/math/geometry'
import {BezierSeg} from '../../src/math/geometry/bezierSeg'
import {DebugCurve} from '../../src/math/geometry/debugCurve'
import {Ellipse} from '../../src/math/geometry/ellipse'
import {allVerticesOfParall} from '../../src/math/geometry/parallelogram'
import {PlaneTransformation} from '../../src/math/geometry/planeTransformation'
import {DrawingObject} from '../../src/drawing/drawingObject'
import {DrawingNode} from '../../src/drawing'
import {fontHeight} from './testUtils'
// @ts-check
export class SvgDebugWriter {
  // Here we import the File System module of node
  //  private fs = require('fs')
  //private xmlw = require('xml-writer')
  xw: any
  ws: any
  arrowAngle = 25

  constructor(svgFileName: string) {
    this.ws = fs.openSync(svgFileName, 'w', 0o666)
    this.xw = new xmlw(true, (string: string) => {
      fs.writeSync(this.ws, string)
    })
  }

  static getBoundingBox(dcurves: DebugCurve[]): Rectangle {
    const r = Rectangle.mkEmpty()
    for (const c of dcurves) {
      r.addRecSelf(c.icurve.boundingBox)
    }
    const s = Math.max(r.width, r.height)
    r.pad(s / 20)
    return r
  }

  writeBoundingBox(box: Rectangle) {
    this.xw.writeAttribute('width', box.width)

    this.xw.writeAttribute('version', '1.1')
    this.xw.startElement('g')
    this.xw.writeAttribute('transform', 'translate(' + -box.left + ',' + -box.bottom + ')')
  }

  open(box: Rectangle, transform = true) {
    this.xw.startElement('svg')
    this.xw.writeAttribute('xmlns:svg', 'http://www.w3.org/2000/svg')
    this.xw.writeAttribute('xmlns', 'http://www.w3.org/2000/svg')
    this.xw.writeAttribute('version', '1.1')
    if (!box) return
    if (transform) {
      this.xw.writeAttribute('width', box.width)
      this.xw.writeAttribute('height', box.height)
      this.xw.startElement('g')
      this.xw.writeAttribute('transform', 'translate(' + -box.left + ',' + -box.bottom + ')')
    }
  }

  static pointToString(start: Point) {
    return SvgDebugWriter.doubleToString(start.x) + ' ' + SvgDebugWriter.doubleToString(start.y)
  }

  static doubleToString(d: number) {
    return Math.abs(d) < 1e-11 ? '0' : d.toString() //formatForDoubleString, CultureInfo.InvariantCulture);
  }

  static segmentString(c: ICurve): string {
    const isls = c instanceof LineSegment
    if (isls) return this.lineSegmentString(c as LineSegment)

    const iscubic = c instanceof BezierSeg
    if (iscubic) return this.bezierSegToString(c as BezierSeg)

    const isell = c instanceof Ellipse
    if (isell) return this.ellipseToString(c as Ellipse)

    throw new Error('NotImplementedException')
  }

  static lineSegmentString(ls: LineSegment): string {
    return 'L ' + SvgDebugWriter.pointToString(ls.end)
  }

  static pointsToString(points: Point[]) {
    return String.Join(
      ' ',
      points.map((p) => SvgDebugWriter.pointToString(p)),
    )
  }

  static bezierSegToString(cubic: BezierSeg): string {
    return 'C' + this.pointsToString([cubic.B(1), cubic.B(2), cubic.B(3)])
  }

  static isFullEllipse(ell: Ellipse): boolean {
    return ell.parEnd == Math.PI * 2 && ell.parStart == 0
  }

  static ellipseToString(ellipse: Ellipse): string {
    const largeArc = Math.abs(ellipse.parEnd - ellipse.parStart) >= Math.PI ? '1' : '0'
    const sweepFlag = ellipse.orientedCounterclockwise() ? '1' : '0'

    return String.Join(
      ' ',
      'A',
      this.ellipseRadiuses(ellipse),
      SvgDebugWriter.doubleToString(Point.angle(new Point(1, 0), ellipse.aAxis) / (Math.PI / 180.0)),
      largeArc,
      sweepFlag,
      SvgDebugWriter.pointToString(ellipse.end),
    )
  }
  static ellipseRadiuses(ellipse: Ellipse): string {
    return SvgDebugWriter.doubleToString(ellipse.aAxis.length) + ',' + SvgDebugWriter.doubleToString(ellipse.bAxis.length)
  }

  static curveString(iCurve: ICurve): string {
    return String.Join(' ', Array.from(SvgDebugWriter.curveStringTokens(iCurve)))
  }

  static *curveStringTokens(iCurve: ICurve): IterableIterator<string> {
    yield 'M'
    yield SvgDebugWriter.pointToString(iCurve.start)
    const iscurve = iCurve instanceof Curve
    if (iscurve) for (const segment of (iCurve as Curve).segs) yield SvgDebugWriter.segmentString(segment)
    else {
      const islineSeg = iCurve instanceof LineSegment
      if (islineSeg) {
        yield 'L'
        yield SvgDebugWriter.pointToString(iCurve.end)
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
              yield SvgDebugWriter.pointToString(p.point)
            }
            if (poly.closed) {
              yield 'L'
              yield SvgDebugWriter.pointToString(poly.start)
            }
          } else {
            const isellipse = iCurve instanceof Ellipse
            if (isellipse) {
              const ellipse = iCurve as Ellipse
              if (SvgDebugWriter.isFullEllipse(ellipse)) {
                yield this.ellipseToString(new Ellipse(0, Math.PI, ellipse.aAxis, ellipse.bAxis, ellipse.center))
                yield this.ellipseToString(new Ellipse(Math.PI, Math.PI * 2, ellipse.aAxis, ellipse.bAxis, ellipse.center))
              } else yield this.ellipseToString(ellipse)
            }
          }
        }
      }
    }
  }

  writeStroke(c: DebugCurve, div = 1) {
    const color = SvgDebugWriter.validColor(c.color)
    this.xw.writeAttribute('stroke', color)
    this.xw.writeAttribute('stroke-opacity', c.transparency / 255.0 / div)
    this.xw.writeAttribute('stroke-width', c.width / div)
  }

  static validColor(color: string) {
    if (DebugCurve.colors.includes(color)) return color
    return 'Black'
  }

  dashArrayString(da: number[]): string {
    const stringBuilder = new StringBuilder('stroke-dasharray:')
    for (let i = 0; ; ) {
      stringBuilder.Append(da[i].toString())
      i++
      if (i < da.length) stringBuilder.Append(' ')
      else {
        stringBuilder.Append(';')
        break
      }
    }
    return stringBuilder.ToString()
  }

  writeDebugCurve(c: DebugCurve) {
    this.xw.startElement('path')
    this.xw.writeAttribute('fill', 'none')
    const iCurve = c.icurve
    this.writeStroke(c)
    this.xw.writeAttribute('d', SvgDebugWriter.curveString(iCurve))
    if (c.dashArray != null) this.xw.writeAttribute('style', this.dashArrayString(c.dashArray))
    this.xw.endElement()

    // parallelogram node
    if (c.drawPN) {
      this.xw.startElement('path')
      this.xw.writeAttribute('fill', 'none')
      const poly = new Polyline()
      const pn = c.icurve.pNodeOverICurve()
      for (const p of allVerticesOfParall(pn.parallelogram)) {
        poly.addPoint(p)
      }
      poly.closed = true
      this.writeStroke(c, 2)
      this.xw.writeAttribute('d', SvgDebugWriter.curveString(poly))
      if (c.dashArray != null) this.xw.writeAttribute('style', this.dashArrayString(c.dashArray))
      this.xw.endElement()
    }
  }

  writeDebugCurves(dcurves: DebugCurve[], flip = true) {
    if (flip) flipDebugCurvesByY(dcurves)
    this.open(SvgDebugWriter.getBoundingBox(dcurves), true)
    for (const c of dcurves) {
      this.writeDebugCurve(c)
    }
    this.close(false)
  }

  close(transform = true) {
    if (transform) this.xw.endElement('g')
    this.xw.endDocument()
    this.xw.flush()
    fs.close(this.ws)
  }

  static dumpICurves(fileName: string, icurves: ICurve[]) {
    const w = new SvgDebugWriter(fileName)
    const dcs = icurves.map((c) => DebugCurve.mkDebugCurveI(c))
    w.writeDebugCurves(dcs, false)
    w.close()
  }
  static dumpDebugCurves(fileName: string, debugCurves: DebugCurve[]) {
    const w = new SvgDebugWriter(fileName)
    w.writeDebugCurves(debugCurves)

    w.close()
  }

  writeGeomGraph(g: GeomGraph) {
    g.updateBoundingBox()
    this.open(g.boundingBox)
    for (const n of g.deepNodes()) {
      if (!n.boundaryCurve) continue
      this.writeDebugCurve(DebugCurve.mkDebugCurveI(n.boundaryCurve))
      let box = n.boundingBox
      if (n instanceof GeomGraph) {
        box = n.boundaryCurve.boundingBox
        const gg = <GeomGraph>n
        if (gg.labelSize) {
          // we are in the flipped world
          const labelBox = Rectangle.mkSizeCenter(gg.labelSize, new Point(box.center.x, box.bottom + gg.labelSize.height / 2 + 2))
          this.writeLabel(n.node, labelBox)
        }
      } else {
        this.writeLabel(n.node, box)
      }
      for (const e of n.inEdges()) {
        this.writeEdge(e)
      }
      for (const e of n.selfEdges()) {
        this.writeEdge(e)
      }
    }
    this.close()
  }

  writeLabelText(text: string, xContainer: number, dy = 0) {
    this.xw.startElement('tspan')
    this.xw.writeAttribute('x', xContainer)
    this.xw.writeAttribute('dy', dy)

    this.xw.writeRaw(this.myEscape(text))
    this.xw.endElement()
  }
  myEscape(text: string): string {
    const chars = Array.from(text)
    const ret = chars.map((a) => (a == '<' ? '&lt;' : a == '>' ? '&gt;' : a))
    return ret.join('')
  }
  writeLabel(node: Node, label: Rectangle) {
    const drawingNode = <DrawingNode>DrawingObject.getDrawingObj(node)
    const text = drawingNode ? drawingNode.labelText ?? node.id : node.id
    const margin = drawingNode ? drawingNode.LabelMargin : 2

    this.writeLabelTextWithMargin(label, margin, text)
  }

  private writeLabelTextWithMargin(label: Rectangle, margin: number, text: string) {
    const x = label.center.x
    const y = label.center.y
    const fontSize = 16
    this.xw.startElement('text')
    this.xw.writeAttribute('x', x)
    this.xw.writeAttribute('y', y)
    this.xw.writeAttribute('text-anchor', 'middle')
    this.xw.writeAttribute('alignment-baseline', 'middle')
    this.xw.writeAttribute('font-family', 'Arial')
    this.xw.writeAttribute('font-size', fontSize)
    this.xw.writeAttribute('fill', 'Black')
    this.writeLabelText(text, x, fontHeight / 2)
    this.xw.endElement()
  }

  private writeEdge(edge: GeomEdge) {
    const icurve = edge.curve // mkFromeSmothPolyline(edge.underlyingPolyline)
    if (icurve == null) return
    this.xw.startElement('path')
    this.xw.writeAttribute('fill', 'none')
    this.xw.writeAttribute('stroke', 'Black')
    this.xw.writeAttribute('stroke-width', edge.lineWidth)
    this.xw.writeAttribute('d', SvgDebugWriter.curveString(icurve))
    this.xw.endElement()
    if (edge != null && edge.sourceArrowhead != null) this.addArrow(icurve.start, edge.sourceArrowhead.tipPosition)
    if (edge != null && edge.targetArrowhead != null) this.addArrow(icurve.end, edge.targetArrowhead.tipPosition)
    if (edge.label != null) {
      this.writeLabelTextWithMargin(edge.label.boundingBox, 1, edge.label.label.text)
    }
  }

  // writeLabel(label: GeomLabel) {
  //   const dc = DebugCurve.mkDebugCurveI(label.boundingBox.perimeter())
  //   dc.transparency = 124
  //   dc.width /= 2
  //   this.writeDebugCurve(dc)
  // }

  addArrow(start: Point, end: Point) {
    let dir = end.sub(start)
    const l = dir.length
    dir = dir.div(l).rotate90Ccw()
    dir = dir.mul(l * Math.tan(this.arrowAngle * 0.5 * (Math.PI / 180.0)))
    this.drawArrowPolygon([start.add(dir), end, start.sub(dir)])
  }

  drawPolygon(points: Point[]) {
    this.xw.writeStartElement('polygon')
    this.xw.writeAttribute('stroke', 'Black')
    this.xw.writeAttribute('fill', 'none')
    this.xw.writeAttribute('points', SvgDebugWriter.pointsToString(points))
    this.xw.endElement()
  }

  drawArrowPolygon(points: Point[]) {
    this.xw.startElement('polygon')
    this.xw.writeAttribute('stroke', 'Black')
    this.xw.writeAttribute('fill', 'none')
    this.xw.writeAttribute('points', SvgDebugWriter.pointsToString(points))
    this.xw.endElement()
  }
}
function flipDebugCurvesByY(dcurves: DebugCurve[]) {
  const matrix = new PlaneTransformation(1, 0, 0, 0, -1, 0)
  for (const dc of dcurves) {
    dc.icurve = dc.icurve.transform(matrix)
  }
}
