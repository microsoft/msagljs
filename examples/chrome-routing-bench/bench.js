/* eslint-disable no-undef */
// Browser benchmark for the three sleeve-routing modes (astar / dijkstra /
// dijkstra-vc).  Loads each benchmark graph from /graphs/<name>, lays it out
// without routing, then times the three routing passes back-to-back.  Mirrors
// modules/core/test/layout/benchmarkRoutingModes.spec.ts but runs in a real
// Chrome page (not Node).

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

  // Globals exposed by dist.min.js's bundle.ts:
  //   globalThis.msagl = { Graph, Node, Edge, GeomGraph, GeomNode, GeomEdge,
  //                        CurveFactory, Point, MdsLayoutSettings,
  //                        layoutGraphWithMds, EdgeRoutingMode,
  //                        routeSleeveEdges }
  if (!globalThis.msagl) {
    setStatus('Failed to load @msagl/core bundle', 'err')
    return
  }
  const M = globalThis.msagl

  // ---------- parsers (mirror Jest spec, but using fetch() text) ----------

  function makeGraph(addEdges) {
    const g = new M.Graph()
    const nodeMap = new Map()
    const getOrAdd = (id) => {
      let n = nodeMap.get(id)
      if (!n) {
        n = new M.Node(id)
        g.addNode(n)
        nodeMap.set(id, n)
      }
      return n
    }
    addEdges(g, getOrAdd)
    return g
  }

  function parseEdgeList(content) {
    return makeGraph((_g, getOrAdd) => {
      for (const rawLine of content.split('\n')) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#') || line.startsWith('%')) continue
        const parts = line.split(/\s+/).filter((s) => s.length > 0)
        if (parts.length < 2) continue
        const src = getOrAdd(parts[0])
        const tgt = getOrAdd(parts[1])
        if (src !== tgt) new M.Edge(src, tgt)
      }
    })
  }

  function parseCSVEdges(content) {
    return makeGraph((_g, getOrAdd) => {
      const lines = content.split('\n')
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const parts = line.split(',')
        if (parts.length < 2) continue
        const src = getOrAdd(parts[0].trim())
        const tgt = getOrAdd(parts[1].trim())
        if (src !== tgt) new M.Edge(src, tgt)
      }
    })
  }

  function parseMatrixMarket(content) {
    return makeGraph((_g, getOrAdd) => {
      let headerSeen = false
      for (const rawLine of content.split('\n')) {
        const line = rawLine.trim()
        if (!line || line.startsWith('%')) continue
        const parts = line.split(/\s+/)
        if (!headerSeen) {
          headerSeen = true
          continue
        }
        if (parts.length < 2) continue
        const src = getOrAdd(parts[0])
        const tgt = getOrAdd(parts[1])
        if (src !== tgt) new M.Edge(src, tgt)
      }
    })
  }

  function parseJsonNodesEdges(text) {
    const data = JSON.parse(text)
    return makeGraph((_g, getOrAdd) => {
      for (const node of data.nodes || []) {
        getOrAdd(String(node.id))
      }
      const edgeList = data.edges || data.links || []
      for (const e of edgeList) {
        const src = getOrAdd(String(e.source))
        const tgt = getOrAdd(String(e.target))
        if (src !== tgt) new M.Edge(src, tgt)
      }
    })
  }

  // ---------- geometry / layout helpers ----------

  function createGeometry(g) {
    const gg = new M.GeomGraph(g)
    for (const n of g.shallowNodes) {
      const gn = new M.GeomNode(n)
      gn.boundaryCurve = M.CurveFactory.mkRectangleWithRoundedCorners(30, 20, 3, 3, new M.Point(0, 0))
    }
    for (const e of g.deepEdges) {
      new M.GeomEdge(e)
    }
    return gg
  }

  function collectGeomEdges(gg) {
    const out = []
    for (const e of gg.deepEdges) out.push(e)
    return out
  }

  function countDistinctSources(gg) {
    const sources = new Set()
    const incident = new Map()
    const edges = []
    for (const e of gg.deepEdges) {
      sources.add(e.source)
      edges.push({s: e.source, t: e.target})
      incident.set(e.source, (incident.get(e.source) || 0) + 1)
      incident.set(e.target, (incident.get(e.target) || 0) + 1)
    }
    const remaining = new Set(edges)
    const deg = new Map(incident)
    let vc = 0
    while (remaining.size > 0) {
      let best = null
      let bestDeg = -1
      for (const [n, d] of deg) {
        if (d > bestDeg) {
          bestDeg = d
          best = n
        }
      }
      if (best == null || bestDeg <= 0) break
      vc++
      deg.set(best, 0)
      for (const e of Array.from(remaining)) {
        if (e.s === best || e.t === best) {
          remaining.delete(e)
          const other = e.s === best ? e.t : e.s
          deg.set(other, (deg.get(other) || 1) - 1)
        }
      }
    }
    return {distinct: sources.size, vc}
  }

  // ---------- console.time interception ----------

  function withPhaseCapture(captured, fn) {
    const realTime = console.time
    const realTimeEnd = console.timeEnd
    const starts = new Map()
    console.time = (label) => {
      if (label != null) starts.set(label, performance.now())
    }
    console.timeEnd = (label) => {
      if (label == null) return
      const s = starts.get(label)
      if (s == null) return
      starts.delete(label)
      const dt = performance.now() - s
      captured[label] = (captured[label] || 0) + dt
    }
    try {
      return fn()
    } finally {
      console.time = realTime
      console.timeEnd = realTimeEnd
    }
  }

  function timeOneRouting(gg, mode, padding) {
    const captured = {}
    const edges = collectGeomEdges(gg)
    withPhaseCapture(captured, () => {
      M.routeSleeveEdges(gg, edges, null, padding, undefined, undefined, 0, undefined, false, mode)
    })
    return {
      cdtMs: captured['SleeveRouter CDT'] || 0,
      routingMs: captured['SleeveRouter routing'] || 0,
    }
  }

  // ---------- benchmark ----------

  async function benchmark(spec) {
    const t0 = performance.now()
    const text = await fetch('/graphs/' + spec.file).then((r) => {
      if (!r.ok) throw new Error('fetch ' + spec.file + ': ' + r.status)
      return r.text()
    })
    const g = spec.parse(text)
    const nodes = g.shallowNodeCount
    const edges = g.edgeCount

    const gg = createGeometry(g)
    const settings = new M.MdsLayoutSettings()
    settings.edgeRoutingSettings.EdgeRoutingMode = M.EdgeRoutingMode.None
    gg.layoutSettings = settings
    M.layoutGraphWithMds(gg, null)

    const {distinct, vc} = countDistinctSources(gg)

    const padding = 2
    const a = timeOneRouting(gg, 'astar', padding)
    const d = timeOneRouting(gg, 'dijkstra', padding)
    const v = timeOneRouting(gg, 'dijkstra-vc', padding)

    return {
      name: spec.name,
      nodes,
      edges,
      distinctSources: distinct,
      vcRoots: vc,
      cdtMs: [a.cdtMs, d.cdtMs, v.cdtMs].sort((x, y) => x - y)[1],
      astarMs: a.routingMs,
      dijkstraMs: d.routingMs,
      dijkstraVcMs: v.routingMs,
      walltimeMs: performance.now() - t0,
    }
  }

  // ---------- formatting ----------

  function fmtSec(ms) {
    if (ms >= 60000) return (ms / 1000).toFixed(1) + 's'
    if (ms >= 1000) return (ms / 1000).toFixed(2) + 's'
    return (ms / 1000).toFixed(3) + 's'
  }
  function pct(faster, slower) {
    if (slower <= 0) return '—'
    const gain = ((slower - faster) / slower) * 100
    return (gain >= 0 ? '+' : '') + gain.toFixed(1) + '%'
  }

  function summary(rows) {
    const lines = []
    lines.push('Per-graph results (Chrome ' + (navigator.userAgentData?.brands?.find((b) => /Chrom/i.test(b.brand))?.version || '') + ')')
    lines.push(''.padEnd(110, '─'))
    lines.push(
      'Graph'.padEnd(20) + 'Nodes'.padStart(8) + 'Edges'.padStart(10) +
      'Sources'.padStart(10) + 'VC'.padStart(8) + 'A* (s)'.padStart(12) +
      'Dijk (s)'.padStart(12) + 'Dijk+VC (s)'.padStart(14) +
      ' D/A*'.padStart(8) + ' VC/D'.padStart(8))
    for (const r of rows) {
      lines.push(
        r.name.padEnd(20) +
        String(r.nodes).padStart(8) +
        String(r.edges).padStart(10) +
        String(r.distinctSources).padStart(10) +
        String(r.vcRoots).padStart(8) +
        fmtSec(r.astarMs).padStart(12) +
        fmtSec(r.dijkstraMs).padStart(12) +
        fmtSec(r.dijkstraVcMs).padStart(14) +
        pct(r.dijkstraMs, r.astarMs).padStart(8) +
        pct(r.dijkstraVcMs, r.dijkstraMs).padStart(8))
    }
    lines.push('')
    lines.push('% LaTeX (booktabs) Chrome combined table')
    lines.push('\\begin{tabular}{@{}lrrrrrrr@{}}')
    lines.push('\\toprule')
    lines.push(
      '& & & \\multicolumn{3}{c}{Time (s)} & \\multicolumn{2}{c}{Speedup} \\\\\n' +
      '\\cmidrule(lr){4-6}\\cmidrule(l){7-8}\n' +
      'Graph & Srcs & VC & A* & Dijk. & Dijk.+VC & Dijk./A* & VC/Dijk. \\\\')
    lines.push('\\midrule')
    for (const r of rows) {
      const fmt = (ms) => {
        const s = ms / 1000
        if (s >= 100) return s.toFixed(1)
        if (s >= 10) return s.toFixed(2)
        return s.toFixed(2)
      }
      lines.push(
        r.name.replace(/_/g, '\\_') + ' & ' +
        r.distinctSources.toLocaleString('en-US').replace(/,/g, '\\,') + ' & ' +
        r.vcRoots.toLocaleString('en-US').replace(/,/g, '\\,') + ' & ' +
        fmt(r.astarMs) + ' & ' +
        fmt(r.dijkstraMs) + ' & ' +
        fmt(r.dijkstraVcMs) + ' & ' +
        '$' + pct(r.dijkstraMs, r.astarMs).replace('%', '\\,\\%').replace('+', '+').replace('-', '-') + '$ & ' +
        '$' + pct(r.dijkstraVcMs, r.dijkstraMs).replace('%', '\\,\\%').replace('+', '+').replace('-', '-') + '$ \\\\')
    }
    lines.push('\\bottomrule')
    lines.push('\\end{tabular}')
    return lines.join('\n')
  }

  // ---------- driver ----------

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

  // Allow narrowing via ?graphs=name1,name2 query param
  const params = new URLSearchParams(location.search)
  const want = params.get('graphs')
  const subset = want ? GRAPHS.filter((g) => want.split(',').includes(g.name)) : GRAPHS

  // Expose state so the test harness can poll progress / final results.
  globalThis.benchState = {status: 'running', done: 0, total: subset.length, rows: [], summary: null, error: null}

  ;(async () => {
    setStatus('Running benchmark on ' + subset.length + ' graphs…', 'work')
    out('=== Chrome routing-modes benchmark ===')
    out('UA: ' + navigator.userAgent)
    out('Started: ' + new Date().toISOString())
    const rows = []
    try {
      for (const spec of subset) {
        out('… ' + spec.name + '  (loading)')
        const r = await benchmark(spec)
        rows.push(r)
        globalThis.benchState.rows = rows
        globalThis.benchState.done = rows.length
        const summaryLine =
          spec.name + ': |V|=' + r.nodes + ' |E|=' + r.edges +
          '  astar=' + fmtSec(r.astarMs) +
          '  dijk=' + fmtSec(r.dijkstraMs) +
          '  dijk+vc=' + fmtSec(r.dijkstraVcMs) +
          '  (sources=' + r.distinctSources + ' vc=' + r.vcRoots +
          ', cdt=' + fmtSec(r.cdtMs) + ', wall=' + fmtSec(r.walltimeMs) + ')'
        out(summaryLine, 'ok')
        try {
          await fetch('/log', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(r)})
        } catch (_) {}
        // Yield to allow devtools to inspect state between graphs.
        await new Promise((r) => setTimeout(r, 50))
      }
      out('')
      const text = summary(rows)
      out(text)
      globalThis.benchState.summary = text
      globalThis.benchState.status = 'done'
      setStatus('Done.', 'ok')
      try {
        await fetch('/log', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({event: 'done', summary: text})})
      } catch (_) {}
    } catch (e) {
      globalThis.benchState.status = 'error'
      globalThis.benchState.error = String(e && e.stack || e)
      setStatus('Error: ' + e, 'err')
      out(String(e && e.stack || e), 'err')
      try {
        await fetch('/log', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({event: 'error', error: String(e && e.stack || e)})})
      } catch (_) {}
    }
  })()
})()
