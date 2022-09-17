import {ICurve} from '../../math/geometry'

export class NodeRestoreData {
  constructor(boundaryCurve: ICurve) {
    this.boundaryCurve = boundaryCurve
  }

  private boundaryCurve: ICurve

  //  node boundary curve

  public get BoundaryCurve(): ICurve {
    return this.boundaryCurve
  }
  public set BoundaryCurve(value: ICurve) {
    this.boundaryCurve = value
  }
}
