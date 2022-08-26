// Following "A technique for Drawing Directed Graphs" of Gansner, Koutsofios, North and Vo

import {copyTo} from '../../../utils/copy'
import {randomInt} from '../../../utils/random'
import {LayerArrays} from '../LayerArrays'
import {ProperLayeredGraph} from '../ProperLayeredGraph'
import {SugiyamaLayoutSettings} from '../sugiyamaLayoutSettings'
import {OrderingMeasure} from './orderingMeasure'
import {SortedMap} from '@esfx/collections-sortedmap'
import {CancelToken} from '../../../utils/cancelToken'
import {LayerEdge} from '../layerEdge'
import {Stack} from 'stack-typescript'

import {EdgeComparerBySource} from './edgeComparerBySource'
import {EdgeComparerByTarget} from './edgeComparerByTarget'
import {Algorithm} from './../../../utils/algorithm'
import {flattenArray} from '../../../utils/setOperations'
// Works on the layered graph.
// See GraphLayout.pdfhttps://www.researchgate.net/profile/Lev_Nachmanson/publication/30509007_Drawing_graphs_with_GLEE/links/54b6b2930cf2e68eb27edf71/Drawing-graphs-with-GLEE.pdf

function HeadOfTheCoin() {
  return randomInt(2) === 0
}

// This method can be improved: see the paper Simple And Efficient ...
function GetCrossingCountFromStrip(bottom: number, properLayeredGraph: ProperLayeredGraph, layerArrays: LayerArrays) {
  const topVerts = layerArrays.Layers[bottom + 1]
  const bottomVerts = layerArrays.Layers[bottom]
  if (bottomVerts.length <= topVerts.length)
    return GetCrossingCountFromStripWhenBottomLayerIsShorter(bottomVerts, properLayeredGraph, layerArrays)
  else return GetCrossingCountFromStripWhenTopLayerIsShorter(topVerts, bottomVerts, properLayeredGraph, layerArrays)
}

function GetCrossingCountFromStripWhenTopLayerIsShorter(
  topVerts: number[],
  bottomVerts: number[],
  properLayeredGraph: ProperLayeredGraph,
  layerArrays: LayerArrays,
) {
  const edges = EdgesOfStrip(bottomVerts, properLayeredGraph)
  const comparer = new EdgeComparerByTarget(layerArrays.x)
  edges.sort((a, b) => comparer.Compare(a, b))
  //find first n such that 2^n >=topVerts.length
  let n = 1
  while (n < topVerts.length) n *= 2
  //init the accumulator tree

  const tree = new Array<number>(2 * n - 1).fill(0)

  n-- // the first bottom node starts from n now

  let cc = 0 //number of crossings
  for (const edge of edges) {
    let index = n + layerArrays.x[edge.Source]
    const ew = edge.CrossingWeight
    tree[index] += ew
    while (index > 0) {
      if (index % 2 !== 0) cc += ew * tree[index + 1] //intersect everything accumulated in the right sibling
      index = Math.floor((index - 1) / 2)
      tree[index] += ew
    }
  }
  return cc
}
// see: Simple and Efficient Bilayer Cross Counting, by Wilhelm Barth, Petra Mutzel
function GetCrossingCountFromStripWhenBottomLayerIsShorter(
  bottomVerts: number[],
  properLayeredGraph: ProperLayeredGraph,
  layerArrays: LayerArrays,
) {
  const edges: LayerEdge[] = EdgesOfStrip(bottomVerts, properLayeredGraph)
  const comparer = new EdgeComparerBySource(layerArrays.x)
  edges.sort((a, b) => comparer.Compare(a, b))
  //find first n such that 2^n >=bottomVerts.length
  let n = 1
  while (n < bottomVerts.length) n *= 2
  //init accumulator

  const tree = new Array<number>(2 * n - 1).fill(0)

  n-- // the first bottom node starts from n now

  let cc = 0 //number of crossings
  for (const edge of edges) {
    let index = n + layerArrays.x[edge.Target]
    const ew = edge.CrossingWeight
    tree[index] += ew
    while (index > 0) {
      if (index % 2 !== 0) cc += ew * tree[index + 1] //intersect everything accumulated in the right sibling
      index = Math.floor((index - 1) / 2)
      tree[index] += ew
    }
  }

  return cc
}

function EdgesOfStrip(bottomVerts: number[], properLayeredGraph: ProperLayeredGraph): LayerEdge[] {
  return flattenArray(bottomVerts, (v) => properLayeredGraph.InEdges(v))
}

export function GetCrossingsTotal(properLayeredGraph: ProperLayeredGraph, layerArrays: LayerArrays) {
  let x = 0
  for (let i = 0; i < layerArrays.Layers.length - 1; i++) x += GetCrossingCountFromStrip(i, properLayeredGraph, layerArrays)

  return x
}

export class Ordering extends Algorithm {
  // fields
  hasCrossWeights: boolean

  layerArrays: LayerArrays
  layerArraysCopy: number[][]
  layering: number[]
  layers: number[][]
  measure: OrderingMeasure

  nOfLayers: number
  properLayeredGraph: ProperLayeredGraph

  SugSettings: SugiyamaLayoutSettings
  startOfVirtNodes: number

  tryReverse = true
  get NoGainStepsBound() {
    return this.SugSettings.NoGainAdjacentSwapStepsBound * this.SugSettings.RepetitionCoefficientForOrdering
  }

  // gets the random seed for some random choices inside of layer ordering
  get SeedOfRandom() {
    return randomInt(100)
  }

  X: number[]

  constructor(
    graphPar: ProperLayeredGraph,
    tryReverse: boolean,
    layerArraysParam: LayerArrays,
    startOfVirtualNodes: number,
    hasCrossWeights: boolean,
    settings: SugiyamaLayoutSettings,
    cancelToken: CancelToken,
  ) {
    super(cancelToken)
    this.cancelToken = cancelToken
    this.tryReverse = tryReverse
    this.startOfVirtNodes = startOfVirtualNodes
    this.layerArrays = layerArraysParam
    this.layering = layerArraysParam.y
    this.nOfLayers = layerArraysParam.Layers.length
    this.layers = layerArraysParam.Layers
    this.properLayeredGraph = graphPar
    this.hasCrossWeights = hasCrossWeights
    this.SugSettings = settings
  }

  // an upper limit on a number of passes in layer ordering
  get MaxOfIterations() {
    return this.SugSettings.MaxNumberOfPassesInOrdering * this.SugSettings.RepetitionCoefficientForOrdering
  }

  static OrderLayers(
    graph: ProperLayeredGraph,
    layerArrays: LayerArrays,
    startOfVirtualNodes: number,
    settings: SugiyamaLayoutSettings,
    cancelToken: CancelToken,
  ) {
    let hasCrossWeight = false
    for (const le of graph.Edges)
      if (le.CrossingWeight !== 1) {
        hasCrossWeight = true
        break
      }

    const o = new Ordering(graph, true, layerArrays, startOfVirtualNodes, hasCrossWeight, settings, cancelToken)
    o.run()
  }

  run() {
    // #if DEBUGORDERING
    // if (graph.NumberOfVertices !== layering.length)
    //  throw new System.Exception("the layering does not correspond to the graph");
    // for (IntEdge e of graph.Edges)
    // if (layering[e.Source] - layering[e.Target] !== 1)
    //  throw new System.Exception("the edge in the graph does not span exactly one layer:" + e);
    // #endif

    this.Calculate()

    if (/*orderingMeasure.x>0 &&*/ this.tryReverse) {
      const secondLayers = this.layerArrays.ReversedClone()

      const revOrdering = new Ordering(
        this.properLayeredGraph.ReversedClone(),
        false,
        secondLayers,
        this.startOfVirtNodes,
        this.hasCrossWeights,
        this.SugSettings,
        this.cancelToken,
      )

      revOrdering.run()

      if (revOrdering.measure < this.measure) {
        for (let j = 0; j < this.nOfLayers; j++) copyTo(secondLayers.Layers[j], this.layerArrays.Layers[this.nOfLayers - 1 - j])

        this.layerArrays.UpdateXFromLayers()
      }
    }
  }

  Calculate() {
    this.Init()

    this.layerArraysCopy = Ordering.CloneLayers(this.layers, this.layerArraysCopy)
    let countOfNoGainSteps = 0
    this.measure = new OrderingMeasure(
      this.layerArraysCopy,
      GetCrossingsTotal(this.properLayeredGraph, this.layerArrays),
      this.startOfVirtNodes,
    )

    //Stopwatch sw = Stopwatch.StartNew();
    for (let i = 0; i < this.MaxOfIterations && countOfNoGainSteps < this.NoGainStepsBound && !this.measure.IsPerfect(); i++) {
      const up = i % 2 === 0

      this.LayerByLayerSweep(up)

      this.AdjacentExchange()

      const newMeasure = new OrderingMeasure(
        this.layerArrays.Layers,
        GetCrossingsTotal(this.properLayeredGraph, this.layerArrays),
        this.startOfVirtNodes,
      )

      if (this.measure < newMeasure) {
        this.Restore()
        countOfNoGainSteps++
      } else if (newMeasure < this.measure || HeadOfTheCoin()) {
        countOfNoGainSteps = 0
        this.layerArraysCopy = Ordering.CloneLayers(this.layers, this.layerArraysCopy)
        this.measure = newMeasure
      }
    }
  }

  static CloneLayers(layers: number[][], layerArraysCopy: number[][]) {
    if (layerArraysCopy == null) {
      layerArraysCopy = new Array<Array<number>>(layers.length)
      for (let i = 0; i < layers.length; i++) layerArraysCopy[i] = layers[i].map((i) => i)
    } else for (let i = 0; i < layers.length; i++) copyTo(layers[i], layerArraysCopy[i])
    return layerArraysCopy
  }

  Restore() {
    this.layerArrays.updateLayers(this.layerArraysCopy)
  }

  LayerByLayerSweep(up: boolean) {
    if (up) {
      for (let i = 1; i < this.nOfLayers; i++) this.SweepLayer(i, true)
    } else for (let i = this.nOfLayers - 2; i >= 0; i--) this.SweepLayer(i, false)
  }

  // the layer layer-1 is fixed if
  // upperLayer us true and layer+1 is fixed in
  // the opposite case
  // the layer with index "layer" is updated
  // of the strip</param>
  SweepLayer(layer: number, upperLayer: boolean) {
    const l = this.layers[layer]
    const medianValues = new Array<number>(l.length)

    for (let i = 0; i < medianValues.length; i++) medianValues[i] = this.WMedian(l[i], upperLayer)

    this.Sort(layer, medianValues)

    //update X
    const vertices = this.layerArrays.Layers[layer]
    for (let i = 0; i < vertices.length; i++) this.layerArrays.x[vertices[i]] = i
  }

  // sorts layerToSort according to medianValues
  // if medianValues[i] is -1 then layer[i] does not move
  Sort(layerToSort: number, medianValues: number[]) {
    const s = new SortedMap<number, any>()
    const vertices = this.layers[layerToSort]
    let i = 0

    for (const m of medianValues) {
      const v = vertices[i++]
      if (m === -1.0) continue

      if (!s.has(m)) s.set(m, v)
      else {
        const o = s.get(m)
        if (!(typeof o === 'number')) {
          const al = o as number[]
          if (HeadOfTheCoin()) al.push(v)
          else {
            //stick it in the middle
            const j = randomInt(al.length)
            const k = al[j]
            al[j] = v
            al.push(k)
          }
        } else {
          const io = o as number
          const al = new Array<number>()
          s.set(m, al)
          if (HeadOfTheCoin()) {
            al.push(io)
            al.push(v)
          } else {
            al.push(v)
            al.push(io)
          }
        }
      }
    }

    const senum = s.values()

    for (i = 0; i < vertices.length; ) {
      if (medianValues[i] !== -1) {
        const o = senum.next().value
        if (typeof o === 'number') vertices[i++] = o as number
        else {
          const al = o as number[]
          for (const v of al) {
            //find the first empty spot
            while (medianValues[i] === -1) i++
            vertices[i++] = v
          }
        }
      } else i++
    }
  }

  WMedian(node: number, theMedianGoingDown: boolean) {
    let edges: IterableIterator<LayerEdge>
    let p: number
    if (theMedianGoingDown) {
      edges = this.properLayeredGraph.OutEdges(node)
      p = this.properLayeredGraph.OutEdgesCount(node)
    } else {
      edges = this.properLayeredGraph.InEdges(node)
      p = this.properLayeredGraph.InEdgesCount(node)
    }

    if (p === 0) return -1.0

    const parray = new Array<number>(p) //we do not have multiple edges

    let i = 0
    if (theMedianGoingDown) for (const e of edges) parray[i++] = this.X[e.Target]
    else for (const e of edges) parray[i++] = this.X[e.Source]

    parray.sort((a, b) => a - b)

    const m = Math.floor(p / 2)

    if (p % 2 === 1) return parray[m]

    if (p === 2) return 0.5 * (parray[0] + parray[1])

    const left = parray[m - 1] - parray[0]

    const right = parray[p - 1] - parray[m]

    return Math.floor((parray[m - 1] * left + parray[m] * right) / (left + right))
  }

  // Just depth search and assign the index saying when the node was visited
  Init() {
    const counts = new Array<number>(this.nOfLayers).fill(0)

    //the initial layers are set by following the order of the
    //depth first traversal inside one layer
    const q = new Stack<number>()
    //enqueue all sources of the graph
    for (let i = 0; i < this.properLayeredGraph.NodeCount; i++) if (this.properLayeredGraph.InEdgesCount(i) === 0) q.push(i)

    const visited = new Array<boolean>(this.properLayeredGraph.NodeCount).fill(false)

    while (q.size > 0) {
      const u = q.pop()
      const l = this.layerArrays.y[u]

      this.layerArrays.Layers[l][counts[l]] = u
      this.layerArrays.x[u] = counts[l]
      counts[l]++

      for (const v of this.properLayeredGraph.Succ(u))
        if (!visited[v]) {
          visited[v] = true
          q.push(v)
        }
    }

    this.X = this.layerArrays.x
  }

  predecessors: number[][]

  // The array contains a dictionary per vertex
  // The value POrder[v][u] gives the offset of u in the array P[v]
  pOrder: Map<number, number>[]

  // for each vertex v let S[v] be the array of successors of v
  successors: number[][]

  // The array contains a dictionary per vertex
  // The value SOrder[v][u] gives the offset of u in the array S[v]
  sOrder: Map<number, number>[]

  inCrossingCount: Map<number, number>[]
  // Gets or sets the number of of passes over all layers to rung adjacent exchanges, where every pass goes '
  // all way up to the top layer and down to the lowest layer
  MaxNumberOfAdjacentExchanges = 50

  outCrossingCount: Map<number, number>[]

  AdjacentExchange() {
    this.InitArrays()
    let count = 0
    let progress = true
    while (progress && count++ < this.MaxNumberOfAdjacentExchanges) {
      progress = false
      for (let i = 0; i < this.layers.length; i++) progress = this.AdjExchangeLayer(i) || progress
      for (let i = this.layers.length - 2; i >= 0; i--) progress = this.AdjExchangeLayer(i) || progress
    }
  }

  AllocArrays() {
    const n = this.properLayeredGraph.NodeCount
    this.predecessors = new Array<Array<number>>(n)
    this.successors = new Array<Array<number>>(n)
    this.pOrder = new Array<Map<number, number>>(n)
    this.sOrder = new Array<Map<number, number>>(n)
    if (this.hasCrossWeights) {
      this.outCrossingCount = new Array<Map<number, number>>(n)
      this.inCrossingCount = new Array<Map<number, number>>(n)
    }
    for (let i = 0; i < n; i++) {
      let count = this.properLayeredGraph.InEdgesCount(i)
      this.predecessors[i] = new Array<number>(count)
      if (this.hasCrossWeights) {
        const inCounts = (this.inCrossingCount[i] = new Map<number, number>())
        for (const le of this.properLayeredGraph.InEdges(i)) inCounts.set(le.Source, le.CrossingWeight)
      }
      this.pOrder[i] = new Map<number, number>()
      count = this.properLayeredGraph.OutEdgesCount(i)
      this.successors[i] = new Array<number>(count)
      this.sOrder[i] = new Map<number, number>()
      if (this.hasCrossWeights) {
        const outCounts = (this.outCrossingCount[i] = new Map<number, number>())
        for (const le of this.properLayeredGraph.OutEdges(i)) outCounts.set(le.Target, le.CrossingWeight)
      }
    }
  }

  // Is called just after median layer swap is done
  InitArrays() {
    if (this.successors == null) this.AllocArrays()

    for (let i = 0; i < this.properLayeredGraph.NodeCount; i++) {
      this.pOrder[i] = new Map<number, number>()
      this.sOrder[i] = new Map<number, number>()
    }

    for (const t of this.layers) this.InitPsArraysForLayer(t)
  }

  // calculates the number of intersections between edges adjacent to u and v
  CalcPair(u: number, v: number): {cuv: number; cvu: number} {
    const su = this.successors[u]
    const sv = this.successors[v]
    const pu = this.predecessors[u]
    const pv = this.predecessors[v]
    if (!this.hasCrossWeights) {
      return {
        cuv: this.CountOnArrays(su, sv) + this.CountOnArrays(pu, pv),
        cvu: this.CountOnArrays(sv, su) + this.CountOnArrays(pv, pu),
      }
    } else {
      const uOutCrossCounts = this.outCrossingCount[u]
      const vOutCrossCounts = this.outCrossingCount[v]
      const uInCrossCounts = this.inCrossingCount[u]
      const vInCrossCounts = this.inCrossingCount[v]
      return {
        cuv: this.CountOnArraysUV(su, sv, uOutCrossCounts, vOutCrossCounts) + this.CountOnArraysUV(pu, pv, uInCrossCounts, vInCrossCounts),
        cvu: this.CountOnArraysUV(sv, su, vOutCrossCounts, uOutCrossCounts) + this.CountOnArraysUV(pv, pu, vInCrossCounts, uInCrossCounts),
      }
    }
  }

  // Sweep layer from left to right and fill S,P arrays as we go.
  // The arrays P and S will be sorted according to X. Note that we will not keep them sorted
  // as we doing adjacent swaps. Initial sorting only needed to calculate initial clr,crl values.
  InitPsArraysForLayer(layer: number[]) {
    for (const l of layer) {
      for (const p of this.properLayeredGraph.Pred(l)) {
        const so = this.sOrder[p]
        const sHasNow = so.size
        this.successors[p][sHasNow] = l //l takes the first available slot in S[p]
        so.set(l, sHasNow)
      }
      for (const s of this.properLayeredGraph.Succ(l)) {
        const po = this.pOrder[s]
        const pHasNow = po.size
        this.predecessors[s][pHasNow] = l //l take the first available slot in P[s]
        po.set(l, pHasNow)
      }
    }
  }

  CountOnArrays(unbs: number[], vnbs: number[]) {
    let ret = 0
    const vl = vnbs.length - 1
    let j = -1 //the right most position of vnbs to the left from the current u neighbor
    let vnbsSeenAlready = 0
    for (const uNeighbor of unbs) {
      const xu = this.X[uNeighbor]
      for (; j < vl && this.X[vnbs[j + 1]] < xu; j++) vnbsSeenAlready++
      ret += vnbsSeenAlready
    }
    return ret
  }

  // every inversion between unbs and vnbs gives an intersecton
  CountOnArraysUV(unbs: number[], vnbs: number[], uCrossingCounts: Map<number, number>, vCrossingCount: Map<number, number>) {
    let ret = 0
    const vl = vnbs.length - 1
    let j = -1 //the right most position of vnbs to the left from the current u neighbor

    let vCrossingNumberSeenAlready = 0
    for (const uNeib of unbs) {
      const xu = this.X[uNeib]
      let vnb: number
      for (; j < vl && this.X[(vnb = vnbs[j + 1])] < xu; j++) vCrossingNumberSeenAlready += vCrossingCount.get(vnb)
      ret += vCrossingNumberSeenAlready * uCrossingCounts.get(uNeib)
    }
    return ret
  }

  AdjExchangeLayer(i: number): boolean {
    const layer = this.layers[i]
    const gain = this.ExchangeWithGainWithNoDisturbance(layer)

    if (gain) return true

    this.DisturbLayer(layer)

    return this.ExchangeWithGainWithNoDisturbance(layer)
  }

  //in this routine u and v are adjacent, and u is to the left of v before the swap
  Swap(u: number, v: number) {
    const left = this.X[u]
    const right = this.X[v]
    const ln = this.layering[u] //layer number
    const layer = this.layers[ln]

    layer[left] = v
    layer[right] = u

    this.X[u] = right
    this.X[v] = left

    //update sorted arrays POrders and SOrders
    //an array should be updated only in case it contains both u and v.
    // More than that, v has to follow u in an the array.

    this.UpdateSsContainingUv(u, v)

    this.UpdatePsContainingUv(u, v)
  }

  UpdatePsContainingUv(u: number, v: number) {
    if (this.successors[u].length <= this.successors[v].length)
      for (const a of this.successors[u]) {
        const porder = this.pOrder[a]
        //of course porder contains u, let us see if it contains v
        if (porder.has(v)) {
          const vOffset = porder.get(v)
          //swap u and v in the array P[coeff]
          const p = this.predecessors[a]
          p[vOffset - 1] = v
          p[vOffset] = u
          //update sorder itself
          porder.set(v, vOffset - 1)
          porder.set(u, vOffset)
        }
      }
    else
      for (const a of this.successors[v]) {
        const porder = this.pOrder[a]
        //of course porder contains u, let us see if it contains v
        if (porder.has(u)) {
          const vOffset = porder.get(v)
          //swap u and v in the array P[coeff]
          const p = this.predecessors[a]
          p[vOffset - 1] = v
          p[vOffset] = u
          //update sorder itself
          porder.set(v, vOffset - 1)
          porder.set(u, vOffset)
        }
      }
  }

  UpdateSsContainingUv(u: number, v: number) {
    if (this.predecessors[u].length <= this.predecessors[v].length)
      for (const a of this.predecessors[u]) {
        const sorder = this.sOrder[a]
        //of course sorder contains u, let us see if it contains v
        if (sorder.has(v)) {
          const vOffset = sorder.get(v)
          //swap u and v in the array S[coeff]
          const s = this.successors[a]
          s[vOffset - 1] = v
          s[vOffset] = u
          //update sorder itself
          sorder.set(v, vOffset - 1)
          sorder.set(u, vOffset)
        }
      }
    else
      for (const a of this.predecessors[v]) {
        const sorder = this.sOrder[a]
        //of course sorder contains u, let us see if it contains v
        if (sorder.has(u)) {
          const vOffset = sorder.get(v)
          //swap u and v in the array S[coeff]
          const s = this.successors[a]
          s[vOffset - 1] = v
          s[vOffset] = u
          //update sorder itself
          sorder.set(v, vOffset - 1)
          sorder.set(u, vOffset)
        }
      }
  }

  DisturbLayer(layer: number[]) {
    for (let i = 0; i < layer.length - 1; i++) this.AdjacentSwapToTheRight(layer, i)
  }

  ExchangeWithGainWithNoDisturbance(layer: number[]) {
    let wasGain = false

    let gain: boolean
    do {
      gain = this.ExchangeWithGain(layer)
      wasGain = wasGain || gain
    } while (gain)

    return wasGain
  }

  ExchangeWithGain(layer: number[]) {
    //find a first pair giving some gain
    for (let i = 0; i < layer.length - 1; i++)
      if (this.SwapWithGain(layer[i], layer[i + 1])) {
        this.SwapToTheLeft(layer, i)
        this.SwapToTheRight(layer, i + 1)
        return true
      }

    return false
  }

  SwapToTheLeft(layer: number[], i: number) {
    for (let j = i - 1; j >= 0; j--) this.AdjacentSwapToTheRight(layer, j)
  }

  SwapToTheRight(layer: number[], i: number) {
    for (let j = i; j < layer.length - 1; j++) this.AdjacentSwapToTheRight(layer, j)
  }

  // swaps i-th element with i+1
  AdjacentSwapToTheRight(layer: number[], i: number) {
    const u = layer[i]
    const v = layer[i + 1]

    const gain = this.SwapGain(u, v)

    if (gain > 0 || (gain === 0 && HeadOfTheCoin())) this.Swap(u, v)
  }

  SwapGain(u: number, v: number) {
    const r = this.CalcPair(u, v)
    return r.cuv - r.cvu
  }

  UvAreOfSameKind(u: number, v: number) {
    return (u < this.startOfVirtNodes && v < this.startOfVirtNodes) || (u >= this.startOfVirtNodes && v >= this.startOfVirtNodes)
  }

  NeighborsForbidTheSwap(u: number, v: number) {
    return this.UpperNeighborsForbidTheSwap(u, v) || this.LowerNeighborsForbidTheSwap(u, v)
  }

  LowerNeighborsForbidTheSwap(u: number, v: number) {
    let uCount: number
    let vCount: number
    if ((uCount = this.properLayeredGraph.OutEdgesCount(u)) === 0 || (vCount = this.properLayeredGraph.OutEdgesCount(v)) === 0) return false

    return this.X[this.successors[u][uCount >> 1]] < this.X[this.successors[v][vCount >> 1]]
  }

  UpperNeighborsForbidTheSwap(u: number, v: number) {
    const uCount = this.properLayeredGraph.InEdgesCount(u)
    const vCount = this.properLayeredGraph.InEdgesCount(v)
    if (uCount === 0 || vCount === 0) return false

    return this.X[this.predecessors[u][uCount >> 1]] < this.X[this.predecessors[v][vCount >> 1]]
  }

  CalcDeltaBetweenGroupsToTheLeftAndToTheRightOfTheSeparator(layer: number[], separatorPosition: number, separator: number) {
    const kind = this.GetKindDelegate(separator)
    let leftGroupSize = 0
    for (let i = separatorPosition - 1; i >= 0 && !kind(layer[i]); i--) leftGroupSize++
    let rightGroupSize = 0
    for (let i = separatorPosition + 1; i < layer.length && !kind(layer[i]); i++) rightGroupSize++

    return leftGroupSize - rightGroupSize
  }

  IsOriginal(v: number) {
    return v < this.startOfVirtNodes
  }

  IsVirtual(v: number) {
    return v >= this.startOfVirtNodes
  }

  GetKindDelegate(v: number) {
    return this.IsVirtual(v) ? this.IsVirtual : this.IsOriginal
  }

  // swaps two vertices only if reduces the number of intersections
  SwapWithGain(u: number, v: number) {
    const gain = this.SwapGain(u, v)

    if (gain > 0) {
      this.Swap(u, v)
      return true
    }
    return false
  }
}
