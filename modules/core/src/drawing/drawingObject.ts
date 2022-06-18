import {ArrowTypeEnum} from './arrowTypeEnum'
import {Color} from './color'
import {StyleEnum} from './styleEnum'
import {RankEnum} from './rankEnum'
import {DirTypeEnum} from './dirTypeEnum'
import {OrderingEnum} from './orderingEnum'
import {LayerDirectionEnum, Size} from '..'
import {Entity} from '../structs/entity'
import {Attr} from 'dotparser'
/** DrawingObject ment to be an attribute on an Entity, with some additional information necessery for rendering. Many fields of this class support of Dot language */
export abstract class DrawingObject {
  *attrIter(): IterableIterator<Attr> {
    if (this.color && this.color.keyword.toLowerCase() != 'black') {
      yield {type: 'attr', id: 'color', eq: this.color.toString()}
    }
  }
  toJSON(): Partial<DrawingObject> {
    const ret: Partial<DrawingObject> = {}
    if (this.color) {
      ret.color = this.color
    }
    if (this.fillColor) {
      ret.fillColor = this.fillColor
    }
    if (this.labelfontcolor && this.labelfontcolor.keyword.toLowerCase() != 'black') {
      ret.labelfontcolor = this.labelfontcolor
    }
    if (this.labelText && this.labelText != this.id) {
      ret.labelText = this.labelText
    }

    if (this.fontColor && this.fontColor.keyword.toLowerCase() != 'black') {
      ret.fontColor = this.fontColor
    }
    if (this.styles && this.styles.length) {
      ret.styles = this.styles
    }

    if (this.pencolor) {
      ret.pencolor = this.pencolor
    }

    if (this.penwidth) {
      ret.penwidth = this.penwidth
    }

    if (this.rankdir) {
      ret.rankdir = this.rankdir
    }

    if (this.fontname && this.fontname != DrawingObject.defaultLabelFontName) {
      ret.fontname = this.fontname
    }
    if (this.margin) {
      ret.margin = this.margin
    }
    if (this.fontsize && this.fontsize != DrawingObject.defaultLabelFontSize) {
      ret.fontsize = this.fontsize
    }

    if (this.orientation) {
      ret.orientation = this.orientation
    }
    if (this.ranksep) {
      ret.ranksep = this.ranksep
    }
    if (this.arrowtail) {
      ret.arrowtail = this.arrowtail
    }
    if (this.ordering) {
      ret.ordering = this.ordering
    }
    if (this.bgcolor) {
      ret.bgcolor = this.bgcolor
    }

    if (this.pos) {
      ret.pos = this.pos
    }
    if (this.nodesep) {
      ret.nodesep = this.nodesep
    }
    if (this.arrowsize) {
      ret.arrowsize = this.arrowsize
    }

    if (this.samehead) {
      ret.samehead = this.samehead
    }

    if (this.layersep) {
      ret.layersep = this.layersep
    }

    if (this.id) {
      ret.id = this.id
    }

    return ret
  }
  measuredTextSize: Size
  /** the index of the DrawingObject in the list of attributes of Entity */
  static attachIndex = 1
  /**  This is the field from the Graph. It is used to keep the connection with the underlying graph */
  attrCont: Entity

  // not all attributes can be used in derived classes
  static defaultLabelFontName = 'Times-Roman'
  static defaultLabelFontSize = 12

  color: Color
  fillColor: Color
  labelfontcolor: Color = Color.Black

  private _labelText: string
  public get labelText(): string {
    return this._labelText
  }
  public set labelText(value: string) {
    this._labelText = value
  }
  headlabel: string
  taillabel: string
  fontColor: Color
  styles: StyleEnum[] = []
  pencolor: Color
  penwidth = 1
  peripheries: number
  size: [number, number]
  rankdir: LayerDirectionEnum
  fontname: any
  width: number
  height: number
  margin: number
  len: number
  fontsize: number
  minlen: number
  rank: RankEnum
  charset: any
  orientation: any
  ratio: any
  weight: number
  ranksep: number
  splines: boolean
  overlap: boolean
  arrowtail: ArrowTypeEnum
  arrowhead: ArrowTypeEnum
  ordering: OrderingEnum
  URL: string
  dir: DirTypeEnum
  concentrate: boolean
  compound: boolean
  lhead: string
  bgcolor: Color
  center: boolean
  pos: [number, number]
  nodesep: number
  rotate: number
  arrowsize: number
  colorscheme: string
  ltail: string
  sides: number
  distortion: number
  skew: number
  bb: [number, number, number, number]
  labelloc: string
  decorate: boolean
  tailclip: boolean
  headclip: boolean
  constraint: boolean
  gradientangle: number
  samehead: string
  href: string
  imagepath: string
  image: string
  labejust: string
  layers: string[]
  layer: string
  layersep: number
  f: number
  nojustify: boolean
  root: boolean
  page: [number, number]
  pname: any
  kind: any
  fname: any
  subkind: any
  area: number
  tailport: string
  headport: string
  wt: any
  private _id: string
  public get id(): string {
    return this._id
  }
  public set id(value: string) {
    this._id = value
  }
  edgetooltip: any
  headURL: any
  tailURL: any
  labelURL: any
  edgeurl: any
  tailtooltip: any
  headtooltip: any
  shapefile: any
  xlabel: any
  sametail: string
  clusterRank: any

  bind() {
    if (this.attrCont != null) {
      this.attrCont.setAttr(DrawingObject.attachIndex, this) // the attribute at 0 is for geometry, at 1 is for drawing
    }
  }

  constructor(attrCont: Entity) {
    this.attrCont = attrCont
    this.bind()
    this.fontname = DrawingObject.defaultLabelFontName
    this.fontsize = DrawingObject.defaultLabelFontSize
  }

  static getDrawingObj(attrCont: Entity): DrawingObject {
    if (attrCont == null) {
      return null
    } else {
      return attrCont.getAttr(DrawingObject.attachIndex) // the attribute at 0 is for geometry, at 1 is for drawing
    }
  }
}
