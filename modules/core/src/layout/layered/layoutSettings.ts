import {EdgeRoutingSettings} from '../../routing/EdgeRoutingSettings'
export type LayoutSettingsJSON = {
  minimalWidth?: number
  minimalHeight?: number
  nodeSeparation?: number
  packingAspectRatio?: number
}

/** The base class for hierarchy of layout settings: it specifies the minumal allowed distance between the nodes,  the minimal size of the resulting bounding box, settings for edge routing, and the ratio for the graph boxes packing algorithm  */

export class LayoutSettings {
  static fromJSON(s: LayoutSettingsJSON): LayoutSettings {
    const ret = new LayoutSettings()
    if (s.nodeSeparation != 10) ret.nodeSeparation = s.nodeSeparation
    if (s.packingAspectRatio) ret.packingAspectRatio = s.packingAspectRatio
    return ret
  }
  toJSON(): LayoutSettingsJSON {
    const ret: LayoutSettingsJSON = {}
    if (this.nodeSeparation != 10) ret.nodeSeparation = this.nodeSeparation
    if (this.packingAspectRatio != 1.5) ret.packingAspectRatio = this.packingAspectRatio
    return ret
  }
  edgeRoutingSettings = new EdgeRoutingSettings()

  private nodeSeparation = 10
  public get NodeSeparation() {
    return this.nodeSeparation
  }
  public set NodeSeparation(value) {
    this.nodeSeparation = value
  }
  private packingAspectRatio = 1.5
  get PackingAspectRatio() {
    return this.packingAspectRatio
  }
  set PackingAspectRatio(value: number) {
    this.packingAspectRatio = value
  }
}
