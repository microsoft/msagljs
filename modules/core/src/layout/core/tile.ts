import {Rectangle} from '../../math/geometry/rectangle'
import {GeomNode} from './geomNode'
import {Edge} from '../../structs/edge'
import {GeomLabel} from './geomLabel'
import {Point} from '../../math/geometry/point'
import {CurveClip, ArrowHeadData} from './tileMap'
import {Curve, ICurve} from '../../math/geometry'
import {Assert} from '../../utils/assert'

export type Bundle = {clip: ICurve; edges: Edge[]}

/** keeps the data needed to render a tile, and some fields for optimizations */
export class Tile {
  private _curveClips: CurveClip[] = []
  public get curveClips(): CurveClip[] {
    return this._curveClips
    
  }
  public set curveClips(value: CurveClip[]) {
    this._curveClips = value
  }
    constructor(rect: Rectangle) {
    this.arrowheads = []
    this.nodes = []
    this.labels = []
    this.rect = rect
    this._curveClips = []
  }
  
  addCurveClip(cc: CurveClip) {
    Assert.assert(!(cc.curve instanceof Curve), 'CurveClip.curve should not be a Curve!')
    this._curveClips.push(cc)
  }

  arrowheads: {tip: Point; edge: Edge; base: Point}[]
  nodes: GeomNode[]
  labels: GeomLabel[]
  rect: Rectangle
  
  isEmpty(): boolean {
    return this._curveClips.length == 0 && this.arrowheads.length == 0 && this.nodes.length == 0 && this.labels.length == 0
  }

  initCurveClips() {
    this._curveClips  =[]
  }

  /** clears all arrays but does not touch this.rect */
  clear() {
    this.arrowheads = []
    this.nodes = []
    this.labels = []
    this._curveClips = []
    
  }

  /** returns the number of entities that will be rendered for a tile: each bundle is counted as one entity */
  get entityCount() {
    return this._curveClips.length + this.arrowheads.length + this.labels.length + this.nodes.length
  }

  addElement(data: CurveClip | ArrowHeadData | GeomLabel | GeomNode) {
    if (data instanceof GeomNode) {
      this.nodes.push(data)
    } else if (data instanceof GeomLabel) {
      this.labels.push(data)
    } else if ('curve' in data) {
      if (data.curve instanceof Curve) {
        for (const seg of data.curve.segs) {
          this.addCurveClip({edge: data.edge, curve: seg, startPar:seg.parStart, endPar:seg.parEnd})
        }
      } else {
        this.addCurveClip(data)
      }
    } else {
      this.arrowheads.push(data)
    }
  }
}
