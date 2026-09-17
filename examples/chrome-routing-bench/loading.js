/* eslint-disable no-undef */
// Browser version of modules/core/test/layout/benchmarkLoadingAllGraphs.spec.ts.
// Times parse + layout-with-sleeve-routing + tile-pyramid build per graph,
// POSTing each row to /loadlog so the static server can persist them.

(function () {
  const logEl = document.getElementById('log')
  const statusEl = document.getElementById('status')
  const uaEl = document.getElementById('ua')
  uaEl.textContent = '— ' + navigator.userAgent

  const out = (msg, cls) => {
    const line = document.createElement('div')
    if (cls) line.className = cls
    line.textContent = msg
    logEl.appendChild(line)
    console.log(msg)
  }
  const setStatus = (msg, cls) => {
    statusEl.textContent = msg
    statusEl.className = cls || ''
  }

  if (!globalThis.msagl) { setStatus('Failed to load @msagl/core bundle', 'err'); return }
  const M = globalThis.msagl

  function makeGraph(addEdges) {
    const g = new M.Graph()
    const nodeMap = new Map()
    const getOrAdd = (id) => {
      let n = nodeMap.get(id)
      if (!n) { n = new M.Node(id); g.addNode(n); nodeMap.set(id, n) }
      return n
    }
    addEdges(g, getOrAdd)
    return g
  }
  function parseEdgeList(c) { return makeGraph((_g, getOrAdd) => {
    for (const rawLine of c.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#') || line.startsWith('%')) continue
      const parts = line.split(/\s+/).filter((s) => s.length > 0)
      if (parts.length < 2) continue
      const s = getOrAdd(parts[0]), t = getOrAdd(parts[1])
      if (s !== t) new M.Edge(s, t)
    }
  })}
  function parseCSVEdges(c) { return makeGraph((_g, getOrAdd) => {
    const lines = c.split('\n')
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim(); if (!line) continue
      const parts = line.split(','); if (parts.length < 2) continue
      const s = getOrAdd(parts[0].trim()), t = getOrAdd(parts[1].trim())
      if (s !== t) new M.Edge(s, t)
    }
  })}
  function parseMatrixMarket(c) { return makeGraph((_g, getOrAdd) => {
    let header = false
    for (const rawLine of c.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('%')) continue
      const parts = line.split(/\s+/)
      if (!header) { header = true; continue }
      if (parts.length < 2) continue
      const s = getOrAdd(parts[0]), t = getOrAdd(parts[1])
      if (s !== t) new M.Edge(s, t)
    }
  })}
  function parseJsonNodesEdges(text) {
    const data = JSON.parse(text)
    return makeGraph((_g, getOrAdd) => {
      for (const node of data.nodes || []) getOrAdd(String(node.id))
      const edgeList = data.edges || data.links || []
      for (const e of edgeList) {
        const s = getOrAdd(String(e.source)), t = getOrAdd(String(e.target))
        if (s !== t) new M.Edge(s, t)
      }
    })
  }

  function createGeometry(g) {
    const gg = new M.GeomGraph(g)
    for (const n of g.shallowNodes) {
      const gn = new M.GeomNode(n)
      gn.boundaryCurve = M.CurveFactory.mkRectangleWithRoundedCorners(30, 20, 3, 3, new M.Point(0, 0))
    }
    for (const e of g.deepEdges) new M.GeomEdge(e)
    return gg
  }

  function makeRootTile(bb) {
    const sz = 2 ** Math.ceil(Math.log2(Math.max(bb.width, bb.height)))
    return new M.Rectangle({
      left:   bb.left   - (sz - bb.width)  / 2,
      bottom: bb.bottom - (sz - bb.height) / 2,
      right:  bb.right  + (sz - bb.width)  / 2,
      top:    bb.top    + (sz - bb.height) / 2,
    })
  }

  function withPhaseCapture(captured, fn) {
    const realT = console.time, realE = console.timeEnd
    const starts = new Map()
    console.time = (l) => { if (l != null) starts.set(l, performance.now()) }
    console.timeEnd = (l) => {
      if (l == null) return
      const s = starts.get(l); if (s == null) return
      starts.delete(l); captured[l] = (captured[l] || 0) + (performance.now() - s)
    }
    try { return fn() } finally { console.time = realT; console.timeEnd = realE }
  }

  const TILE_CAPACITY = 500
  const MAX_TILE_LEVELS = 8

  async function benchmark(spec) {
    const t0 = performance.now()
    const text = await fetch('/graphs/' + spec.file).then((r) => {
      if (!r.ok) throw new Error('fetch ' + spec.file + ': ' + r.status)
      return r.text()
    })
    const parseStart = performance.now()
    const g = spec.parse(text)
    const parseMs = performance.now() - parseStart
    const nodes = g.shallowNodeCount
    const edges = g.edgeCount

    const gg = createGeometry(g)
    const settings = new M.MdsLayoutSettings()
    settings.edgeRoutingSettings.EdgeRoutingMode = M.EdgeRoutingMode.Sleeve
    gg.layoutSettings = settings

    const phases = {}
    const t1 = performance.now()
    withPhaseCapture(phases, () => { M.layoutGraphWithMds(gg, null) })
    const layoutMs = performance.now() - t1
    const cdtMs = phases['SleeveRouter CDT'] || 0
    const routingMs = phases['SleeveRouter routing'] || 0
    const routingPhasesMs = cdtMs + routingMs

    const rootTile = makeRootTile(gg.boundingBox)
    const tileMap = new M.TileMap(gg, rootTile, TILE_CAPACITY)
    const t2 = performance.now()
    const tileLevels = tileMap.buildUpToLevel(MAX_TILE_LEVELS)
    const tilingMs = performance.now() - t2

    return {
      name: spec.name, nodes, edges, parseMs, layoutMs,
      cdtMs, routingMs, routingPhasesMs, tilingMs, tileLevels,
      totalMs: parseMs + layoutMs + tilingMs,
      walltimeMs: performance.now() - t0,
    }
  }

  function fmtSec(ms) {
    if (ms >= 60000) return (ms / 1000).toFixed(1) + 's'
    if (ms >= 1000) return (ms / 1000).toFixed(2) + 's'
    return (ms / 1000).toFixed(3) + 's'
  }

  function summary(rows) {
    const lines = []
    lines.push('Loading benchmark — Chrome ' + (navigator.userAgentData?.brands?.find((b) => /Chrom/i.test(b.brand))?.version || ''))
    lines.push('')
    lines.push(
      'Graph'.padEnd(20) + 'Nodes'.padStart(8) + 'Edges'.padStart(10) +
      'Parse'.padStart(8) + 'Layout'.padStart(9) + 'Routing'.padStart(10) +
      'Tiling'.padStart(10) + 'Total'.padStart(10) + 'Levels'.padStart(8))
    for (const r of rows) {
      lines.push(
        r.name.padEnd(20) + String(r.nodes).padStart(8) + String(r.edges).padStart(10) +
        fmtSec(r.parseMs).padStart(8) + fmtSec(r.layoutMs).padStart(9) +
        fmtSec(r.routingPhasesMs).padStart(10) + fmtSec(r.tilingMs).padStart(10) +
        fmtSec(r.totalMs).padStart(10) + String(r.tileLevels).padStart(8))
    }
    lines.push('')
    lines.push('% LaTeX (booktabs) Chrome loading table')
    lines.push('\\begin{tabular}{@{}lrrrrr@{}}')
    lines.push('\\toprule')
    lines.push('Graph & $|V|$ & $|E|$ & Routing & Tiling & Total \\\\')
    lines.push('\\midrule')
    const nf = (s) => s >= 100 ? s.toFixed(1) : s.toFixed(2)
    for (const r of rows) {
      lines.push(
        r.name.replace(/_/g, '\\_') + ' & ' +
        r.nodes.toLocaleString('en-US').replace(/,/g, '\\,') + ' & ' +
        r.edges.toLocaleString('en-US').replace(/,/g, '\\,') + ' & ' +
        nf(r.routingPhasesMs / 1000) + ' & ' +
        nf(r.tilingMs / 1000) + ' & ' +
        nf(r.totalMs / 1000) + ' \\\\')
    }
    lines.push('\\bottomrule')
    lines.push('\\end{tabular}')
    return lines.join('\n')
  }

  const GRAPHS = [
    {name: 'gameofthrones',     file: 'gameofthrones.json', parse: parseJsonNodesEdges},
    {name: 'composers',         file: 'composers.json',     parse: parseJsonNodesEdges},
    {name: 'ca-GrQc',           file: 'ca-GrQc.txt',        parse: parseEdgeList},
    {name: 'facebook_combined', file: 'facebook_combined.txt', parse: parseEdgeList},
    {name: 'ca-HepTh',          file: 'ca-HepTh.txt',       parse: parseEdgeList},
    {name: 'ca-HepPh',          file: 'ca-HepPh.txt',       parse: parseEdgeList},
    {name: 'ca-CondMat',        file: 'ca-CondMat.txt',     parse: parseEdgeList},
    {name: 'deezer_europe',     file: 'deezer_europe/deezer_europe_edges.csv', parse: parseCSVEdges},
    {name: 'delaunay_n15',      file: 'delaunay_n15/delaunay_n15.mtx', parse: parseMatrixMarket},
  ]

  const params = new URLSearchParams(location.search)
  const want = params.get('graphs')
  const subset = want ? GRAPHS.filter((g) => want.split(',').includes(g.name)) : GRAPHS

  globalThis.loadState = {status: 'running', done: 0, total: subset.length, rows: [], summary: null, error: null}

  ;(async () => {
    setStatus('Running loading benchmark on ' + subset.length + ' graphs…', 'work')
    out('=== Chrome loading benchmark (TILE_CAPACITY=' + TILE_CAPACITY + ', MAX_TILE_LEVELS=' + MAX_TILE_LEVELS + ') ===')
    out('UA: ' + navigator.userAgent)
    out('Started: ' + new Date().toISOString())
    const rows = []
    try {
      for (const spec of subset) {
        out('… ' + spec.name + '  (loading)')
        const r = await benchmark(spec)
        rows.push(r)
        globalThis.loadState.rows = rows
        globalThis.loadState.done = rows.length
        out(spec.name +
          ': |V|=' + r.nodes + ' |E|=' + r.edges +
          '  parse=' + fmtSec(r.parseMs) +
          '  layout=' + fmtSec(r.layoutMs) +
          '  routing=' + fmtSec(r.routingPhasesMs) +
          '  tiling=' + fmtSec(r.tilingMs) +
          '  total=' + fmtSec(r.totalMs) +
          '  levels=' + r.tileLevels, 'ok')
        try {
          await fetch('/loadlog', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(r)})
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 50))
      }
      out('')
      const text = summary(rows)
      out(text)
      globalThis.loadState.summary = text
      globalThis.loadState.status = 'done'
      setStatus('Done.', 'ok')
      try {
        await fetch('/loadlog', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({event: 'done', summary: text})})
      } catch (_) {}
    } catch (e) {
      globalThis.loadState.status = 'error'
      globalThis.loadState.error = String(e && e.stack || e)
      setStatus('Error: ' + e, 'err')
      out(String(e && e.stack || e), 'err')
      try {
        await fetch('/loadlog', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({event: 'error', error: String(e && e.stack || e)})})
      } catch (_) {}
    }
  })()
})()
