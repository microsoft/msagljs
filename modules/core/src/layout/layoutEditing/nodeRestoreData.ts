import {ICurve} from '../../math/geometry'
import {RestoreData} from './restoreData'

export class NodeRestoreData implements RestoreData {
  constructor(boundaryCurve: ICurve) {
    this.boundaryCurve = boundaryCurve
  }

  Action: () => void

  private boundaryCurve: ICurve

  //  node boundary curve

  public get BoundaryCurve(): ICurve {
    return this.boundaryCurve
  }
  public set BoundaryCurve(value: ICurve) {
    this.boundaryCurve = value
  }
}
