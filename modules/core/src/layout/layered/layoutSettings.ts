import {EdgeRoutingSettings} from '../../routing/EdgeRoutingSettings'
export type LayoutSettingsJSON = {
  minimalWidth?: number
  nodeSeparation?: number
  packingAspectRatio?: number
}

/** The base class for hierarchy of layout settings: it specifies the minumal allowed distance between the nodes,  the minimal size of the resulting bounding box, settings for edge routing, and the ratio for the graph boxes packing algorithm  */

export class LayoutSettings {
  edgeRoutingSettings = new EdgeRoutingSettings()
  minimalWidth = 0
  /**  The resulting layout should be at list this wide*/
  get MinimalWidth(): number {
    return this.minimalWidth
  }
  set MinimalWidth(value: number) {
    this.minimalWidth = Math.max(value, 0)
  }
  minimalHeight = 0
  /**  The resulting layout should be at least this tall*/
  get MinimalHeight(): number {
    return this.minimalHeight
  }
  set MinimalHeight(value: number) {
    this.minimalHeight = Math.max(value, 0)
  }

  private nodeSeparation = 10
  public get NodeSeparation() {
    return this.nodeSeparation
  }
  public set NodeSeparation(value) {
    this.nodeSeparation = value
  }
  packingAspectRatio = 1.5
  get PackingAspectRatio() {
    return this.packingAspectRatio
  }
  set PackingAspectRatio(value: number) {
    this.packingAspectRatio = value
  }
}
