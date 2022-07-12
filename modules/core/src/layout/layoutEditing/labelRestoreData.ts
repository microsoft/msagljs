import {Point} from '../../math/geometry'
import {RestoreData} from './restoreData'

export class LabelRestoreData implements RestoreData {
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
  Action: () => void
}
