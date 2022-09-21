import {Point} from '../../math/geometry'

export class LabelRestoreData {
  private center: Point

  public get Center(): Point {
    return this.center
  }
  public set Center(value: Point) {
    this.center = value
  }

  public constructor(centerP: Point) {
    this.center = centerP
  }
}
