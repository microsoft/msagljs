import {VerticalConstraintsForSugiyama} from './VerticalConstraintsForSugiyama'
import {HorizontalConstraintsForSugiyama} from './HorizontalConstraintsForSugiyama'
import {LayerDirectionEnum} from './layerDirectionEnum'
import {PlaneTransformation} from '../../math/geometry/planeTransformation'
import {closeDistEps} from '../../utils/compare'
import {EdgeRoutingSettings} from '../../routing/EdgeRoutingSettings'
import {EdgeRoutingMode} from '../../routing/EdgeRoutingMode'
export enum SnapToGridByY {
  None,
  Top,
  Bottom,
}

type LayoutSettingsJSON = {
  minimalWidth?: number
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
/** Settings for layered layout: it specifies if the direction of the layers, distance between the layers, etc*/
export class SugiyamaLayoutSettings extends LayoutSettings {
  static createFrom(ss: any) {
    throw new Error('Method not implemented.')
  }

  sameRanks = new Array<string[]>()

  verticalConstraints = new VerticalConstraintsForSugiyama()
  horizontalConstraints = new HorizontalConstraintsForSugiyama()

  NoGainAdjacentSwapStepsBound = 5
  RepetitionCoefficientForOrdering = 1
  AspectRatio = 0
  MaxNumberOfPassesInOrdering = 24
  /**  When the number of vertices in the proper layered graph
   is at least threshold  we switch to a fast, but not so accurate,
   method for x-coordinates calculations. */
  BrandesThreshold = 600
  LabelCornersPreserveCoefficient = 0.1
  MinNodeHeight = (72 * 0.5) / 4
  MinNodeWidth = (72 * 0.75) / 4
  SnapToGridByY = SnapToGridByY.None
  yLayerSep = 10 * 3
  transform: PlaneTransformation = PlaneTransformation.getIdentity()
  get LayerSeparation() {
    return this.yLayerSep
  }
  set LayerSeparation(value) {
    this.yLayerSep = Math.max(10 * 3, value)
  }
  ActualLayerSeparation(layersAreDoubled: boolean) {
    return layersAreDoubled ? this.LayerSeparation / 2.0 : this.LayerSeparation
  }
  GridSizeByY = 0
  GridSizeByX = 0

  constructor() {
    super()
    this.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SugiyamaSplines
  }

  transformIsRotation(ang: number): boolean {
    const p = PlaneTransformation.rotation(ang)
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) if (!closeDistEps(p.elements[i][j], this.transform.elements[i][j])) return false
    }
    return true
  }

  get layerDirection() {
    if (this.transformIsRotation(0)) return LayerDirectionEnum.TB
    if (this.transformIsRotation(Math.PI / 2)) return LayerDirectionEnum.LR
    if (this.transformIsRotation(-Math.PI / 2)) return LayerDirectionEnum.RL
    if (this.transformIsRotation(Math.PI)) return LayerDirectionEnum.BT
    return LayerDirectionEnum.None
  }
  set layerDirection(value: LayerDirectionEnum) {
    switch (value) {
      case LayerDirectionEnum.TB:
        this.transform = PlaneTransformation.getIdentity()
        break
      case LayerDirectionEnum.LR:
        this.transform = PlaneTransformation.rotation(Math.PI / 2)
        break
      case LayerDirectionEnum.RL:
        this.transform = PlaneTransformation.rotation(-Math.PI / 2)
        break
      case LayerDirectionEnum.BT:
        this.transform = PlaneTransformation.rotation(Math.PI)
        break
      default:
        throw new Error('unexpected layout direction')
    }
  }
}
