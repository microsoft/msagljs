import {VerticalConstraintsForSugiyama} from './verticalConstraintsForSugiyama'
import {HorizontalConstraintsForSugiyama} from './HorizontalConstraintsForSugiyama'
import {LayerDirectionEnum} from './layerDirectionEnum'
import {PlaneTransformation} from '../../math/geometry/planeTransformation'
import {closeDistEps} from '../../utils/compare'
import {EdgeRoutingMode} from '../../routing/EdgeRoutingMode'
import {LayoutSettings} from './layoutSettings'
export enum SnapToGridByY {
  None,
  Top,
  Bottom,
}

export type SugiyamaLayoutSettingsJSON = {
  sameRanks?: Array<string[]>
  verticalConstraints?: VerticalConstraintsForSugiyama
  horizontalConstraints?: HorizontalConstraintsForSugiyama
  NoGainAdjacentSwapStepsBound?: number
  RepetitionCoefficientForOrdering?: number
  AspectRatio?: number
  MaxNumberOfPassesInOrdering?: number
  BrandesThreshold?: number
  LabelCornersPreserveCoefficient?: number
  MinNodeHeight?: number
  MinNodeWidth?: number
  SnapToGridByY?: SnapToGridByY
  yLayerSep?: number
  transform?: PlaneTransformation
  GridSizeByY?: number
  GridSizeByX?: number
}

/** Settings for layered layout: it specifies if the direction of the layers, distance between the layers, etc*/
export class SugiyamaLayoutSettings extends LayoutSettings {
  static createFrom(s: SugiyamaLayoutSettingsJSON) {
    const r = new SugiyamaLayoutSettings()
    if (s.sameRanks) r.sameRanks = s.sameRanks
    if (s.verticalConstraints) r.verticalConstraints = s.verticalConstraints
    if (s.horizontalConstraints) r.horizontalConstraints = s.horizontalConstraints
    if (s.NoGainAdjacentSwapStepsBound) r.horizontalConstraints = s.horizontalConstraints
    if (s.RepetitionCoefficientForOrdering) r.RepetitionCoefficientForOrdering = s.RepetitionCoefficientForOrdering
    if (s.AspectRatio) r.AspectRatio = s.AspectRatio
    if (s.MaxNumberOfPassesInOrdering) r.MaxNumberOfPassesInOrdering = s.MaxNumberOfPassesInOrdering
    if (s.BrandesThreshold) r.BrandesThreshold = s.BrandesThreshold
    if (s.LabelCornersPreserveCoefficient) r.LabelCornersPreserveCoefficient = s.LabelCornersPreserveCoefficient
    if (s.MinNodeHeight) r.minimalHeight = s.MinNodeHeight
    if (s.MinNodeWidth) r.minimalWidth = r.minimalWidth
    if (s.SnapToGridByY) r.SnapToGridByY = s.SnapToGridByY
    if (s.yLayerSep) r.yLayerSep = s.yLayerSep
    if (s.transform) r.transform = s.transform
    if (s.GridSizeByY) r.GridSizeByY = s.GridSizeByY
    if (s.GridSizeByX) r.GridSizeByX = s.GridSizeByX
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
