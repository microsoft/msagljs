import {Rectangle} from '../../math/geometry/rectangle'
import {GeomNode} from './geomNode'
import {GeomEdge} from './geomEdge'
import {Edge} from '../../structs/edge'
import {GeomLabel} from './geomLabel'
import {Point} from '../../math/geometry/point'
import {Entity} from '../../structs/entity'
import {CurveClip, ArrowHeadData} from './tileMap'

/** keeps all the data needed to render a tile */
export class Tile {
  isEmpty(): boolean {
    return this.curveClips.length == 0 && this.arrowheads.length == 0 && this.nodes.length == 0 && this.labels.length == 0
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
  static mk(curveClips: CurveClip[], arrows: ArrowHeadData[], nodes: GeomNode[], labels: GeomLabel[], rect: Rectangle): Tile {
    const t = new Tile()
    t.curveClips = curveClips
    t.arrowheads = arrows
    t.nodes = nodes
    t.labels = labels
    t.rect = rect
    return t
  }

  curveClips: CurveClip[]
  arrowheads: {tip: Point; edge: Edge; base: Point}[]
  nodes: GeomNode[]
  labels: GeomLabel[]
  rect: Rectangle
  get entityCount() {
    return this.curveClips.length + this.arrowheads.length + this.labels.length + this.nodes.length
  }

  addElement(data: CurveClip | ArrowHeadData | GeomLabel | GeomNode) {
    if (data instanceof GeomNode) {
      this.nodes.push(data)
    } else if (data instanceof GeomLabel) {
      this.labels.push(data)
    } else if ('curve' in data) {
      this.curveClips.push(data)
    } else {
      this.arrowheads.push(data)
    }
  }
}
