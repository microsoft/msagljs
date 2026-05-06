import {Rectangle} from '../../math/geometry/rectangle'
import {GeomNode} from './geomNode'
import {Edge} from '../../structs/edge'
import {GeomLabel} from './geomLabel'
import {Point} from '../../math/geometry/point'
import {CurveClip, ArrowHeadData} from './tileMap'
import {Curve, ICurve} from '../../math/geometry'
import {Assert} from '../../utils/assert'

export type Bundle = {clip: ICurve; edges: Edge[]}

/** Quantizes a point to ~1e-6 layout-space units and serializes it. */
function pointKey(p: Point): string {
  return Math.round(p.x * 1e6) + ',' + Math.round(p.y * 1e6)
}

/** Returns a stable key for an unordered point pair: the two endpoint keys
 *  joined in lexicographic order so clips traversed in either direction map
 *  to the same bundle. */
function bundleKey(a: Point, b: Point): string {
  const ka = pointKey(a)
  const kb = pointKey(b)
  return ka <= kb ? ka + '|' + kb : kb + '|' + ka
}

/** keeps the data needed to render a tile, and some fields for optimizations */
export class Tile {
  /** Curve clips stored as bundles indexed by their lex-ordered endpoint
   *  pair: clips that enter and leave the tile at the same two points share a
   *  single geometry and accumulate their `edges` list. */
  private _clipBundles: Map<string, CurveClip> = new Map()

  /** Returns the bundled curve clips. Each entry is one rendered entity (one
   *  ICurve) carrying the list of edges that share that endpoint pair. */
  public get curveClips(): CurveClip[] {
    return Array.from(this._clipBundles.values())
  }

  /** Replaces all clips with the given list, rebuilding the bundle index. */
  public set curveClips(value: CurveClip[]) {
    this._clipBundles = new Map()
    for (const cc of value) this.addCurveClip(cc)
  }

  constructor(rect: Rectangle) {
    this.arrowheads = []
    this.nodes = []
    this.labels = []
    this.rect = rect
    this._clipBundles = new Map()
  }

  /** Adds `cc` to the tile, bundling it with any existing clip that shares
   *  the same lex-ordered endpoint pair: edges are merged, geometry is kept
   *  from the first occurrence. */
  addCurveClip(cc: CurveClip) {
    Assert.assert(!(cc.curve instanceof Curve), 'CurveClip.curve should not be a Curve!')
    const start = cc.curve.value(cc.startPar)
    const end = cc.curve.value(cc.endPar)
    const key = bundleKey(start, end)
    const existing = this._clipBundles.get(key)
    if (existing) {
      for (const e of cc.edges) {
        if (!existing.edges.includes(e)) existing.edges.push(e)
      }
      return
    }
    this._clipBundles.set(key, {curve: cc.curve, edges: cc.edges.slice(), startPar: cc.startPar, endPar: cc.endPar})
  }

  arrowheads: {tip: Point; edge: Edge; base: Point}[]
  nodes: GeomNode[]
  labels: GeomLabel[]
  rect: Rectangle

  isEmpty(): boolean {
    return this._clipBundles.size == 0 && this.arrowheads.length == 0 && this.nodes.length == 0 && this.labels.length == 0
  }

  initCurveClips() {
    this._clipBundles = new Map()
  }

  /** clears all arrays but does not touch this.rect */
  clear() {
    this.arrowheads = []
    this.nodes = []
    this.labels = []
    this._clipBundles = new Map()
  }

  /** returns the number of entities that will be rendered for a tile: each bundle is counted as one entity */
  get entityCount() {
    return this._clipBundles.size + this.arrowheads.length + this.labels.length + this.nodes.length
  }

  addElement(data: CurveClip | ArrowHeadData | GeomLabel | GeomNode) {
    if (data instanceof GeomNode) {
      this.nodes.push(data)
    } else if (data instanceof GeomLabel) {
      this.labels.push(data)
    } else if ('curve' in data) {
      if (data.curve instanceof Curve) {
        for (const seg of data.curve.segs) {
          this.addCurveClip({edges: data.edges, curve: seg, startPar: seg.parStart, endPar: seg.parEnd})
        }
      } else {
        this.addCurveClip(data)
      }
    } else {
      this.arrowheads.push(data)
    }
  }
}
