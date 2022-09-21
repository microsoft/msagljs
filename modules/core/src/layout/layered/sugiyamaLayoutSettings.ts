import {VerticalConstraintsForSugiyama} from './verticalConstraintsForSugiyama'
import {HorizontalConstraintsForSugiyama} from './HorizontalConstraintsForSugiyama'
import {LayerDirectionEnum} from './layerDirectionEnum'
import {PlaneTransformation} from '../../math/geometry/planeTransformation'
import {closeDistEps} from '../../utils/compare'
import {EdgeRoutingMode} from '../../routing/EdgeRoutingMode'
import {CommonLayoutSettings, CommonLayoutSettingsJSON} from '../commonLayoutSettings'
import {EdgeRoutingSettings} from '../../routing/EdgeRoutingSettings'
import {ILayoutSettings} from './iLayoutSettings'
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
  transform?: Array<Array<number>>
  GridSizeByY?: number
  GridSizeByX?: number
  commonLayoutSettings?: CommonLayoutSettingsJSON
}

/** Settings for layered layout: it specifies if the direction of the layers, distance between the layers, etc*/
export class SugiyamaLayoutSettings implements ILayoutSettings {
  commonSettings: CommonLayoutSettings = new CommonLayoutSettings()
  get NodeSeparation(): number {
    return this.commonSettings.NodeSeparation
  }
  get edgeRoutingSettings() {
    return this.commonSettings.edgeRoutingSettings
  }
  set edgeRoutingSettings(value: EdgeRoutingSettings) {
    this.commonSettings.edgeRoutingSettings = value
  }
  toJSON(): SugiyamaLayoutSettingsJSON {
    const r: SugiyamaLayoutSettingsJSON = {}
    if (this.sameRanks) r.sameRanks = this.sameRanks
    if (this.verticalConstraints) r.verticalConstraints = this.verticalConstraints
    if (this.horizontalConstraints) r.horizontalConstraints = this.horizontalConstraints
    if (this.NoGainAdjacentSwapStepsBound != 5) r.horizontalConstraints = this.horizontalConstraints
    if (this.RepetitionCoefficientForOrdering != 1) r.RepetitionCoefficientForOrdering = this.RepetitionCoefficientForOrdering
    if (this.AspectRatio) r.AspectRatio = this.AspectRatio
    if (this.MaxNumberOfPassesInOrdering != 24) r.MaxNumberOfPassesInOrdering = this.MaxNumberOfPassesInOrdering
    if (this.BrandesThreshold != 600) r.BrandesThreshold = this.BrandesThreshold
    if (this.LabelCornersPreserveCoefficient != 0.1) r.LabelCornersPreserveCoefficient = this.LabelCornersPreserveCoefficient
    if (this.MinNodeHeight != (72 * 0.5) / 4) r.MinNodeHeight = this.MinNodeHeight
    if (this.MinNodeWidth != (72 * 0.75) / 4) r.MinNodeWidth = this.MinNodeWidth
    if (this.SnapToGridByY != SnapToGridByY.None) r.SnapToGridByY = this.SnapToGridByY
    if (this.yLayerSep != 10 * 3) r.yLayerSep = this.yLayerSep
    if (this.transform) r.transform = this.transform.elements
    if (this.GridSizeByY) r.GridSizeByY = this.GridSizeByY
    if (this.GridSizeByX) r.GridSizeByX = this.GridSizeByX
    r.commonLayoutSettings = this.commonSettings.toJSON()

    return r
  }
  static fromJSON(s: SugiyamaLayoutSettingsJSON): SugiyamaLayoutSettings {
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
    if (s.MinNodeHeight) r.MinNodeHeight = s.MinNodeHeight
    if (s.MinNodeWidth) r.MinNodeWidth = r.MinNodeWidth
    if (s.SnapToGridByY) r.SnapToGridByY = s.SnapToGridByY
    if (s.yLayerSep) r.yLayerSep = s.yLayerSep
    if (s.transform)
      r.transform = new PlaneTransformation(
        s.transform[0][0],
        s.transform[0][1],
        s.transform[0][2],
        s.transform[1][0],
        s.transform[1][1],
        s.transform[1][2],
      )
    if (s.GridSizeByY) r.GridSizeByY = s.GridSizeByY
    if (s.GridSizeByX) r.GridSizeByX = s.GridSizeByX
    if (s.commonLayoutSettings) r.commonSettings = CommonLayoutSettings.fromJSON(s.commonLayoutSettings)
    return r
  }

  sameRanks: Array<string[]>

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
    this.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SugiyamaSplines
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
