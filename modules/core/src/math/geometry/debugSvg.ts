// Browser/worker-safe DebugCurve SVG serializer (no fs/xml-writer).
// Mirrors the subset of the test-only SvgDebugWriter needed for CDT / obstacle / route dumps.

import {DebugCurve, DebugObject} from './debugCurve'
import {ICurve} from './icurve'
import {Curve} from './curve'
import {LineSegment} from './lineSegment'
import {BezierSeg} from './bezierSeg'
import {Polyline} from './polyline'
import {Ellipse} from './ellipse'
import {Point} from './point'
import {Rectangle} from './rectangle'

function d2s(d: number): string {
  return Math.abs(d) < 1e-11 ? '0' : d.toString()
}
function p2s(p: Point): string {
  return d2s(p.x) + ' ' + d2s(p.y)
}
function isFullEllipse(e: Ellipse): boolean {
  return e.parEnd === Math.PI * 2 && e.parStart === 0
}
function ellipseToString(e: Ellipse): string {
  const largeArc = Math.abs(e.parEnd - e.parStart) >= Math.PI ? '1' : '0'
  const sweep = e.orientedCounterclockwise() ? '1' : '0'
  return [
    'A',
    d2s(e.aAxis.length) + ',' + d2s(e.bAxis.length),
    d2s(Point.angle(new Point(1, 0), e.aAxis) / (Math.PI / 180)),
    largeArc,
    sweep,
    p2s(e.end),
  ].join(' ')
}
function segmentString(c: ICurve): string {
  if (c instanceof LineSegment) return 'L ' + p2s(c.end)
  if (c instanceof BezierSeg) return 'C' + [c.B(1), c.B(2), c.B(3)].map(p2s).join(' ')
  if (c instanceof Ellipse) return ellipseToString(c)
  throw new Error('unsupported segment')
}
function curvePath(c: ICurve): string {
  const out: string[] = ['M', p2s(c.start)]
  if (c instanceof Curve) {
    for (const s of c.segs) out.push(segmentString(s))
  } else if (c instanceof LineSegment) {
    out.push('L', p2s(c.end))
  } else if (c instanceof BezierSeg) {
    out.push(segmentString(c))
  } else if (c instanceof Polyline) {
    for (const p of c.skip(1)) out.push('L', p2s(p.point))
    if (c.closed) out.push('L', p2s(c.start))
  } else if (c instanceof Ellipse) {
    if (isFullEllipse(c)) {
      out.push(ellipseToString(new Ellipse(0, Math.PI, c.aAxis, c.bAxis, c.center)))
      out.push(ellipseToString(new Ellipse(Math.PI, Math.PI * 2, c.aAxis, c.bAxis, c.center)))
    } else {
      out.push(ellipseToString(c))
    }
  }
  return out.join(' ')
}

function boundingBox(curves: DebugCurve[]): Rectangle {
  const r = Rectangle.mkEmpty()
  for (const c of curves) r.addRecSelf(c.icurve.boundingBox)
  const s = Math.max(r.width, r.height)
  if (s > 0) r.pad(s / 20)
  return r
}

const namedColors: Record<string, string> = {}

function validColor(color: string): string {
  if (!color) return 'Black'
  if (DebugCurve.colors.includes(color)) return color
  if (namedColors[color]) return namedColors[color]
  return 'Black'
}
/** Serialize DebugCurves to an SVG string. Flips Y via an SVG transform so
 *  the geometric +Y points up (matches the test SvgDebugWriter output). */
export function debugCurvesToSvg(curves: DebugCurve[]): string {
  if (!curves || curves.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg"/>'
  const box = boundingBox(curves)
  const w = box.width
  const h = box.height
  // After Y-flip (y -> -y), original y-range [bottom, top] becomes [-top, -bottom].
  const viewY = -box.top
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${w}" height="${h}" viewBox="${box.left} ${viewY} ${w} ${h}">`,
  )
  parts.push(`<g transform="matrix(1 0 0 -1 0 0)">`)
  for (const c of curves) {
    const color = validColor(c.color)
    const fill = c.fillColor ? `fill="${validColor(c.fillColor)}"` : 'fill="none"'
    const fillOp = c.fillColor && c.transparency < 255 ? ` fill-opacity="${(c.transparency / 255).toFixed(3)}"` : ''
    const strokeOp = (c.transparency / 255).toFixed(3)
    const dash = c.dashArray ? ` stroke-dasharray="${c.dashArray.join(' ')}"` : ''
    parts.push(
      `<path ${fill}${fillOp} stroke="${color}" stroke-opacity="${strokeOp}" stroke-width="${c.width}"${dash} d="${curvePath(c.icurve)}"/>`,
    )
  }
  parts.push('</g></svg>')
  return parts.join('')
}

/** Browser-side installer for DebugObject.dumpDebugCurves:
 *  triggers a file download of the SVG. Use:
 *    import {installBrowserDebugCurvesDownloader} from '@msagl/core'
 *    installBrowserDebugCurvesDownloader()
 */
export function installBrowserDebugCurvesDownloader(): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return
  DebugObject.dumpDebugCurves = (fileName: string, curves: DebugCurve[]) => {
    const svg = debugCurvesToSvg(curves)
    const blob = new Blob([svg], {type: 'image/svg+xml'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.replace(/^\.?\//, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
