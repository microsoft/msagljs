export class LayoutAlgorithmHelpers {
  ///  <summary>
  ///  Linearly interpolates a result between the minResult and the maxResult based on the location of the value between the lowerThreshold and the upperThreshold.
  ///  </summary>
  ///  <param name="value">The input value.</param>
  ///  <param name="lowerThreshold">If the input value is lower than the lowerThreshold, minResult is returned.</param>
  ///  <param name="upperThreshold">If the input value is higher than the upperThreshold, maxResult is returned.</param>
  ///  <param name="minResult">The minimum result.</param>
  ///  <param name="maxResult">The maximum result.</param>
  ///  <returns>The linearly interpolated result.  Between minResult and maxResult, inclusive.</returns>
  static LinearInterpolation(value: number, lowerThreshold: number, upperThreshold: number, minResult: number, maxResult: number): number {
    if (value < lowerThreshold) {
      return minResult
    }

    if (value > upperThreshold) {
      return maxResult
    }

    const fraction: number = (value - lowerThreshold) / <number>(upperThreshold - lowerThreshold)
    return minResult + <number>(fraction * (maxResult - minResult))
  }

  ///  <summary>
  ///  Negatively linearly interpolates a result between the minResult and the maxResult based on the location of the value between the lowerThreshold and the upperThreshold.
  ///  </summary>
  ///  <param name="value">The input value.</param>
  ///  <param name="lowerThreshold">If the input value is lower than the lowerThreshold, maxResult is returned.</param>
  ///  <param name="upperThreshold">If the input value is higher than the upperThreshold, minResult is returned.</param>
  ///  <param name="minResult">The minimum result.</param>
  ///  <param name="maxResult">The maximum result.</param>
  ///  <returns>The linearly interpolated result.  Between minResult and maxResult, inclusive.</returns>
  static NegativeLinearInterpolation(
    value: number,
    lowerThreshold: number,
    upperThreshold: number,
    minResult: number,
    maxResult: number,
  ): number {
    if (value < lowerThreshold) {
      return maxResult
    }

    if (value > upperThreshold) {
      return minResult
    }

    const fraction: number = (value - lowerThreshold) / <number>(upperThreshold - lowerThreshold)
    return minResult + <number>((1 - fraction) * (maxResult - minResult))
  }
}
