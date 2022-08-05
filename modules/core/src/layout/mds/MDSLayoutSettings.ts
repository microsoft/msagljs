import {EdgeConstraints} from '../edgeConstraints'
import {LayoutSettings} from '../layered/layoutSettings'

/** Settings for multi-dimensional scaling */
export class MdsLayoutSettings extends LayoutSettings {
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
