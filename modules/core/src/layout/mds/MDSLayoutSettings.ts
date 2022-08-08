import {EdgeRoutingSettings} from '../../routing/EdgeRoutingSettings'
import {EdgeConstraints, EdgeConstraintsJSON} from '../edgeConstraints'
import {CommonLayoutSettings} from '../layered/commonLayoutSettings'
export type MdsLayoutSettingsJSON = {
  pivotNumber: number

  iterationsWithMajorization: number

  scaleX: number

  scaleY: number

  exponent: number

  rotationAngle: number

  removeOverlaps: boolean

  _callIterationsWithMajorizationThreshold: number
  edgeConstraints: EdgeConstraintsJSON
  // Settings for calculation of ideal edge length
}
/** Settings for multi-dimensional scaling */
export class MdsLayoutSettings {
  get NodeSeparation() {
    return this.layoutSettings.NodeSeparation
  }
  set NodeSeparation(value: number) {
    this.layoutSettings.NodeSeparation = value
  }
  layoutSettings = new CommonLayoutSettings()
  get edgeRoutingSettings() {
    return this.layoutSettings.edgeRoutingSettings
  }
  set edgeRoutingSettings(value: EdgeRoutingSettings) {
    this.layoutSettings.edgeRoutingSettings = value
  }

  // the setting of Multi-Dimensional Scaling layout

  // private double epsilon = Math.Pow(10,-8);
  private pivotNumber = 50

  private iterationsWithMajorization = 30

  private scaleX = 200

  private scaleY = 200

  private exponent = -2

  private rotationAngle = 0

  removeOverlaps = true

  //
  _callIterationsWithMajorizationThreshold = 3000

  // remove overlaps between node boundaries
  get RemoveOverlaps(): boolean {
    return this.removeOverlaps
  }
  set RemoveOverlaps(value: boolean) {
    this.removeOverlaps = value
  }

  // Number of pivots in Landmark Scaling (between 3 and number of objects).
  get PivotNumber(): number {
    return this.pivotNumber
  }
  set PivotNumber(value: number) {
    this.pivotNumber = value
  }

  /** Number of iterations in distance scaling: these iterations beautify the layout locally. This heuristic is optional , and the property has to be set to zero for a large graph, because each iteration has O(n*n) time, where n is the number of nodes in the graph */
  get IterationsWithMajorization(): number {
    return this.iterationsWithMajorization
  }
  set IterationsWithMajorization(value: number) {
    this.iterationsWithMajorization = value
  }

  // X Scaling Factor.
  get ScaleX(): number {
    return this.scaleX
  }
  set ScaleX(value: number) {
    this.scaleX = value
  }

  // Y Scaling Factor.
  get ScaleY(): number {
    return this.scaleY
  }
  set ScaleY(value: number) {
    /*Assert.assert(!isNaN(value))*/
    this.scaleY = value
  }

  // Weight matrix exponent.
  get Exponent(): number {
    return this.exponent
  }
  set Exponent(value: number) {
    this.exponent = value
  }

  // rotation angle
  get RotationAngle(): number {
    return this.rotationAngle
  }
  set RotationAngle(value: number) {
    this.rotationAngle = value % 360
  }

  edgeConstraints: EdgeConstraints
  // Settings for calculation of ideal edge length
  get IdealEdgeLength(): EdgeConstraints {
    return this.edgeConstraints
  }
  set IdealEdgeLength(value: EdgeConstraints) {
    this.edgeConstraints = value
  }

  adjustScale = false
  // Adjust the scale of the graph if there is not enough whitespace between nodes
  get AdjustScale(): boolean {
    return this.adjustScale
  }
  set AdjustScale(value: boolean) {
    this.adjustScale = value
  }

  GetNumberOfIterationsWithMajorization(nodeCount: number): number {
    if (nodeCount > this.CallIterationsWithMajorizationThreshold) {
      return 0
    }

    return this.IterationsWithMajorization
  }

  get CallIterationsWithMajorizationThreshold(): number {
    return this._callIterationsWithMajorizationThreshold
  }
  set CallIterationsWithMajorizationThreshold(value: number) {
    this._callIterationsWithMajorizationThreshold = value
  }
}
