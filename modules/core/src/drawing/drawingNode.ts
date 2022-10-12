import {DrawingObject} from './drawingObject'
import {Color} from './color'
import {ShapeEnum} from './shapeEnum'
import {Node} from '../structs/node'
import {Attr} from 'dotparser'
import {Attribute} from '../structs/attribute'
export class DrawingNode extends DrawingObject {
  clone(): Attribute {
    throw new Error('Method not implemented.')
  }
  *attrIter(): IterableIterator<Attr> {
    yield* super.attrIter()
    if (this.shape && this.shape !== ShapeEnum.box) {
      yield {type: 'attr', id: 'shape', eq: this.shape.toString()}
    }
    if (this.xRad && this.xRad !== 3) {
      yield {type: 'attr', id: 'xRad', eq: this.xRad.toString()}
    }
    if (this.yRad && this.yRad !== 3) {
      yield {type: 'attr', id: 'yRad', eq: this.yRad.toString()}
    }
    if (this.padding && this.padding !== 2) {
      yield {type: 'attr', id: 'padding', eq: this.padding.toString()}
    }
  }

  shape: ShapeEnum = ShapeEnum.box
  padding = 2

  get Padding(): number {
    return this.padding
  }
  set Padding(value: number) {
    this.padding = Math.max(0, value)
    // //RaiseVisualsChangedEvent(this, null);
  }
  xRad = 3

  // x radius of the rectangle box

  get XRadius(): number {
    return this.xRad
  }
  set XRadius(value: number) {
    this.xRad = value
    //RaiseVisualsChangedEvent(this, null);
  }

  yRad = 3

  // y radius of the rectangle box

  get YRadius(): number {
    return this.yRad
  }
  set YRadius(value: number) {
    this.yRad = value
  }

  static defaultFillColor: Color = Color.LightGray

  // the default fill color

  static get DefaultFillColor(): Color {
    return DrawingNode.defaultFillColor
  }
  static set DefaultFillColor(value: Color) {
    DrawingNode.defaultFillColor = value
  }

  get ShapeEnum(): ShapeEnum {
    return this.shape
  }
  set ShapeEnum(value: ShapeEnum) {
    this.shape = value
    //RaiseVisualsChangedEvent(this, null);
  }

  labelMargin = 1

  // the node label margin

  get LabelMargin(): number {
    return this.labelMargin
  }
  set LabelMargin(value: number) {
    this.labelMargin = value
    //RaiseVisualsChangedEvent(this, null);
  }
  constructor(n: Node) {
    super(n)
    if (n != null) {
      this.labelText = n.id
    }
  }
  // the non adgjacent edges should avoid being closer to the node than Padding

  private labelWidthToHeightRatio = 1

  // the label width to height ratio.

  get LabelWidthToHeightRatio(): number {
    return this.labelWidthToHeightRatio
  }
  set LabelWidthToHeightRatio(value: number) {
    this.labelWidthToHeightRatio = value
  }
  get node(): Node {
    return this.entity as Node
  }

  get id(): string {
    return this.node ? this.node.id : null
  }
}
