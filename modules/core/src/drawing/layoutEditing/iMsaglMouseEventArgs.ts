/** represent MouseEvent */
export interface IMsaglMouseEventArgs {
  LeftButtonIsPressed: boolean

  MiddleButtonIsPressed: boolean
  RightButtonIsPressed: boolean
  Handled: boolean

  X: number
  Y: number

  Clicks: number
}
