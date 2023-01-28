import {EdgeRoutingMode} from 'msagl-js'
import {TextMeasurerOptions} from 'msagl-js/drawing'
import {layoutGraph} from './layout'
import TextMeasurer from './text-measurer'
import {deepEqual, getLabelPosition} from './utils'
import initLayoutWorker from './workers/layoutWorker'

export {deepEqual, getLabelPosition, TextMeasurer, layoutGraph, initLayoutWorker}
export type LayoutOptions = {
  layoutType?: 'Sugiyama LR' | 'Sugiyama TB' | 'Sugiyama BT' | 'Sugiyama RL' | 'IPsepCola' | 'MDS'
  label?: Partial<TextMeasurerOptions>
  edgeRoutingMode?: EdgeRoutingMode
}
