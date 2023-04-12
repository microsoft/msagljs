import {Rectangle} from '../../math/geometry/rectangle'
import {GeomNode} from './geomNode'
import {GeomEdge} from './geomEdge'
import {Edge} from '../../structs/edge'
import {GeomLabel} from './geomLabel'
import {Point} from '../../math/geometry/point'
import {Entity} from '../../structs/entity'
import {CurveClip, ArrowHeadData} from './tileMap'
import {Curve, ICurve} from '../../math/geometry'
import {PointPairMap} from '../../utils/pointPairMap'
import {PointPair} from '../../math/geometry/pointPair'
import {Assert} from '../../utils/assert'

/** keeps all the data needed to render a tile */
export class Tile {
  static mkWithCachedClips(tileRect: Rectangle) {
    const t = new Tile(tileRect)
    t.initCachedClips()
    return t
  }
  get cachedClipsLength() {
    return this.cachedClips ? this.cachedClips.size : 0
  }
  constructor(rect: Rectangle) {
    this.curveClips = []
    this.arrowheads = []
    this.nodes = []
    this.labels = []
    this.rect = rect
  }
  addCachedClip(curve: ICurve) {
    Assert.assert(!(curve instanceof Curve), 'CurveClip.curve is not a Curve')
    if (this.cachedClips) {
      this.cachedClips.set(new PointPair(curve.start, curve.end), curve)
    }
  }
  findCachedClip(p0: Point, p1: Point): ICurve {
    return this.cachedClips.get(new PointPair(p0, p1))
  }
  addCurveClip(cc: CurveClip) {
    Assert.assert(!(cc.curve instanceof Curve), 'CurveClip.curve is not a Curve')
    this.curveClips.push(cc)
  }
  private curveClips: CurveClip[]
  arrowheads: {tip: Point; edge: Edge; base: Point}[]
  nodes: GeomNode[]
  labels: GeomLabel[]
  rect: Rectangle
  // for each pair of points, we keep a cached curve, it is unique
  private cachedClips: PointPairMap<ICurve>
  initCachedClips() {
    this.cachedClips = new PointPairMap<ICurve>()
  }
  *getCachedClips(): IterableIterator<[PointPair, ICurve]> {
    yield* this.cachedClips
  }
  get curveClipsLength() {
    return this.curveClips.length
  }

  isEmpty(): boolean {
    return this.curveClips.length == 0 && this.arrowheads.length == 0 && this.nodes.length == 0 && this.labels.length == 0
  }

  *getCurveClips(): IterableIterator<CurveClip> {
    yield* this.curveClips
  }

  initCurveClips() {
    if (this.cachedClips) this.cachedClips.clear()

    this.curveClips = []
  }
  /** an edge can be returned several times, once for every element pointing at it */
  *entitiesOfTile(): IterableIterator<Entity> {
    for (const cc of this.curveClips) {
      yield cc.edge
    }

    for (const label of this.labels) {
      yield (label.parent as GeomEdge).edge
    }
    for (const arrowhead of this.arrowheads) {
      yield arrowhead.edge
    }
    for (const gnode of this.nodes) {
      yield gnode.node
    }
  }
  /** clears all arrays but does not touch this.rect */
  clear() {
    this.curveClips = []
    this.arrowheads = []
    this.nodes = []
    this.labels = []
  }

  get entityCount() {
    return this.curveClips.length + this.arrowheads.length + this.labels.length + this.nodes.length
  }

  addElement(data: CurveClip | ArrowHeadData | GeomLabel | GeomNode) {
    if (data instanceof GeomNode) {
      this.nodes.push(data)
    } else if (data instanceof GeomLabel) {
      this.labels.push(data)
    } else if ('curve' in data) {
      Assert.assert(this.rect.containsRect(data.curve.boundingBox), 'CurveClip.curve is not in tile')
      if (data.curve instanceof Curve) {
        for (const seg of data.curve.segments) {
          this.addCurveClip({edge: data.edge, curve: seg})
        }
      } else {
        this.addCurveClip(data)
      }
    } else {
      this.arrowheads.push(data)
    }
  }
}
