// Browsing-smoothness harness for the GD 2026 paper.
//
// Output JSONL feeds the post-processor that emits the per-graph LaTeX
// rows for tab:smoothness in gd2026.tex. Both the post-processor and
// the canonical results files live with the paper sources, not here:
//   ~/dev/paper_msagljs/format_smoothness.py
//   ~/dev/paper_msagljs/smoothness-results-mcp.jsonl
//

// For each graph, after the in-browser tile-pyramid build finishes,
// drive a deterministic programmatic tour through deck.gl: pick three
// random points on the root tile, and for each one dive from the
// coarsest zoom to the finest zoom and back over two seconds of wall
// clock. Record per-frame time via requestAnimationFrame timestamps,
// main-thread long tasks via PerformanceObserver, and the deck.gl
// Tileset2D visible-element count at peak zoom. Write one JSON line
// per trial.
//
// Usage:
//   node bench/smoothness.mjs [--trials=2] [--out=results.jsonl] [--only=g1,g2]
//
// Assumes:
//   - The webgl-sleeve example has been built into website/static/webgl-sleeve.
//   - The renderer exposes window.__msaglRenderer with a `_deck` field and
//     a setMaxTileLevels() method (already wired by app.ts on load).
//   - The example sets window.__msaglReady=true after the initial graph load.

import http from 'node:http'
import {createReadStream, statSync, writeFileSync, existsSync, appendFileSync} from 'node:fs'
import {extname, join, resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import puppeteer from 'puppeteer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..', '..', 'website', 'static', 'webgl-sleeve')

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const TRIALS = parseInt(args.trials ?? 2, 10)
const DIVES_PER_TRIAL = parseInt(args.dives ?? 3, 10)
const DIVE_MS = parseInt(args.diveMs ?? 2000, 10)
const OUT = resolve(args.out ?? join(__dirname, 'smoothness-results.jsonl'))
const ONLY = args.only ? String(args.only).split(',') : null

const GRAPHS = [
  {label: 'gameofthrones',      url: './graphs/gameofthrones.json',          loadTimeoutMs:    60_000},
  {label: 'composers',          url: './graphs/composers.json',              loadTimeoutMs:    60_000},
  {label: 'ca-GrQc',            url: './graphs/ca-GrQc.txt.gz',              loadTimeoutMs:    90_000},
  {label: 'ca-HepTh',           url: './graphs/ca-HepTh.txt.gz',             loadTimeoutMs:   300_000},
  {label: 'facebook_combined',  url: './graphs/facebook_combined.txt.gz',    loadTimeoutMs:   300_000},
  {label: 'ca-HepPh',           url: './graphs/ca-HepPh.txt.gz',             loadTimeoutMs: 1_500_000},
  {label: 'ca-CondMat',         url: './graphs/ca-CondMat.txt.gz',           loadTimeoutMs: 1_500_000},
  {label: 'deezer_europe',      url: './graphs/deezer_europe_edges.csv.gz',  loadTimeoutMs: 1_500_000},
  {label: 'delaunay_n15',       url: './graphs/delaunay_n15.mtx.gz',         loadTimeoutMs:   600_000},
]

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.gz': 'application/gzip',
  '.csv': 'text/csv',
  '.mtx': 'text/plain',
  '.txt': 'text/plain',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

function startServer(rootDir, port = 0) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let p = join(rootDir, urlPath === '/' ? '/index.html' : urlPath)
    try {
      const st = statSync(p)
      if (st.isDirectory()) p = join(p, 'index.html')
    } catch {
      res.statusCode = 404
      return res.end('not found')
    }
    res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream')
    // Do NOT set Content-Encoding: gzip — the parser handles .gz files
    // itself via DecompressionStream based on the bytes, so we want raw
    // gzipped bytes to land in fetch.
    createReadStream(p).pipe(res)
  })
  return new Promise((resolveP) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address()
      resolveP({server, port: addr.port})
    })
  })
}

function quantile(sorted, q) {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.floor(q * sorted.length))
  return sorted[i]
}

function summarize(arr) {
  const sorted = [...arr].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  return {
    n: sorted.length,
    mean: sorted.length ? sum / sorted.length : 0,
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    max: sorted.length ? sorted[sorted.length - 1] : 0,
  }
}

async function runTrial(browser, port, graphLabel, graphUrl, loadTimeoutMs, trialIndex) {
  const page = await browser.newPage()
  await page.setViewport({width: 1200, height: 900, deviceScaleFactor: 1})
  page.on('dialog', (d) => d.accept())
  page.on('console', (msg) => {
    if (process.env.MSAGL_BENCH_VERBOSE) {
      process.stderr.write(`  [page.${msg.type()}] ${msg.text()}\n`)
    }
  })
  page.on('pageerror', (err) => {
    process.stderr.write(`  [pageerror] ${err.message}\n`)
  })

  const url = `http://127.0.0.1:${port}/?url=${encodeURIComponent(graphUrl)}&maxLevels=30`
  const t0 = Date.now()
  await page.goto(url, {waitUntil: 'domcontentloaded'})
  await page.waitForFunction(() => (window).__msaglReady === true, {timeout: loadTimeoutMs})
  const loadMs = Date.now() - t0

  // Settle one second after the initial render so any background work in
  // the layout/route worker drains before we start measuring.
  await new Promise((r) => setTimeout(r, 1000))

  const result = await page.evaluate(async (params) => {
    const {dives, diveMs, seed} = params
    const renderer = (window).__msaglRenderer
    const deck = renderer && renderer._deck
    if (!deck) return {error: 'deck not ready'}

    const layer = (deck.props.layers || [])[0]
    if (!layer || !layer.props) return {error: 'tile layer not ready'}
    const minZoom = layer.props.minZoom
    const maxZoom = layer.props.maxZoom
    const extent = layer.props.extent || [0, 0, 1, 1]
    // Pick targets inside the actual graph footprint when the example
    // exposes it; otherwise fall back to the padded extent square so
    // the harness still runs.
    const box = (window).__msaglGraphBox
    const x0 = box ? box.left : extent[0]
    const y0 = box ? box.bottom : extent[1]
    const x1 = box ? box.right : extent[2]
    const y1 = box ? box.top : extent[3]

    // Deterministic PRNG (mulberry32) so a fixed seed gives the same
    // random points across runs.
    let s = (seed | 0) || 1
    const rand = () => {
      s = (s + 0x6D2B79F5) | 0
      let t = s
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    // Frame timestamps + long-task durations.
    const frameTs = []
    const longTasks = []
    let raf = 0
    let stop = false
    const tick = (t) => {
      frameTs.push(t)
      if (!stop) raf = requestAnimationFrame(tick)
    }

    let po = null
    try {
      po = new PerformanceObserver((entries) => {
        for (const e of entries.getEntries()) longTasks.push({start: e.startTime, dur: e.duration})
      })
      po.observe({entryTypes: ['longtask']})
    } catch (_e) { /* longtask not supported */ }

    raf = requestAnimationFrame(tick)
    const tStart = performance.now()

    // Inspect the deck.gl Tileset2D and sum node/edge/label/arrowhead
    // counts across visible (selected) tiles. Run at peak zoom of each
    // dive to estimate per-frame GPU load.
    const tileSize = (t) => {
      const c = t && t.content
      if (!c) return 0
      let n = 0
      for (const k of ['nodes', 'edges', 'labels', 'arrowheads', 'curveClips', 'rectClips']) {
        const arr = c[k]
        if (Array.isArray(arr)) n += arr.length
      }
      return n
    }
    const probeVisible = () => {
      try {
        const l = (deck.props.layers || [])[0]
        const tileset = l && l.state && l.state.tileset
        const selected = (tileset && (tileset.selectedTiles || tileset.tiles)) || []
        let elementSum = 0
        let tilesCounted = 0
        for (const tile of selected) {
          const sz = tileSize(tile)
          if (sz > 0) {
            elementSum += sz
            tilesCounted += 1
          }
        }
        return {elements: elementSum, tiles: tilesCounted}
      } catch (_e) {
        return {elements: null, tiles: null}
      }
    }

    const targets = []
    const peakSamples = []

    // Drive each dive by wall-clock so jank does not stretch its duration:
    // for half the dive, interpolate zoom minZoom -> maxZoom; for the
    // second half, maxZoom -> minZoom. Probe visible tiles at peak.
    const halfMs = diveMs / 2
    for (let d = 0; d < dives; d++) {
      const tx = x0 + rand() * (x1 - x0)
      const ty = y0 + rand() * (y1 - y0)
      const target = [tx, ty, 0]
      targets.push({x: tx, y: ty})

      // Anchor at minZoom with this target; one rAF to commit.
      deck.setProps({viewState: {target, zoom: minZoom}})
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))

      const diveStart = performance.now()
      let probed = false
      let lastT = diveStart
      while (true) {
        const now = performance.now()
        const elapsed = now - diveStart
        if (elapsed >= diveMs) break
        let z
        if (elapsed < halfMs) {
          z = minZoom + ((maxZoom - minZoom) * elapsed) / halfMs
        } else {
          z = maxZoom - ((maxZoom - minZoom) * (elapsed - halfMs)) / halfMs
        }
        deck.setProps({viewState: {target, zoom: z}})
        await new Promise((r) => requestAnimationFrame(() => r(undefined)))
        // Probe once when we cross peak zoom (midpoint of the dive).
        if (!probed && lastT - diveStart < halfMs && performance.now() - diveStart >= halfMs) {
          peakSamples.push(probeVisible())
          probed = true
        }
        lastT = performance.now()
      }
      // End the dive at minZoom exactly.
      deck.setProps({viewState: {target, zoom: minZoom}})
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
      if (!probed) peakSamples.push(probeVisible())
    }

    const tEnd = performance.now()
    stop = true
    cancelAnimationFrame(raf)
    if (po) po.disconnect()

    const frameTimes = []
    for (let i = 1; i < frameTs.length; i++) frameTimes.push(frameTs[i] - frameTs[i - 1])

    const peakElements = peakSamples.map((s) => s.elements ?? 0)
    const peakTiles = peakSamples.map((s) => s.tiles ?? 0)
    const peakMax = peakElements.reduce((a, b) => Math.max(a, b), 0)
    const peakMean = peakElements.length ? peakElements.reduce((a, b) => a + b, 0) / peakElements.length : 0
    const peakTileMax = peakTiles.reduce((a, b) => Math.max(a, b), 0)
    const peakTileMean = peakTiles.length ? peakTiles.reduce((a, b) => a + b, 0) / peakTiles.length : 0

    return {
      durMs: tEnd - tStart,
      frameTimes,
      longTasks: longTasks.map((l) => l.dur),
      // Actual pyramid depth = the layer's zoom range; this is the
      // numberOfLevels TileMap built, which may be less than the
      // requested maxTileLevels cap.
      tilePyramidLevels: maxZoom - minZoom + 1,
      tileLayer: {minZoom, maxZoom, extent},
      graphBox: box || null,
      dives: targets,
      peakElementsPerDive: peakElements,
      peakTilesPerDive: peakTiles,
      peakElementsMax: peakMax,
      peakElementsMean: peakMean,
      peakTilesMax: peakTileMax,
      peakTilesMean: peakTileMean,
    }
  }, {dives: DIVES_PER_TRIAL, diveMs: DIVE_MS, seed: (trialIndex + 1) * 1013904223})

  await page.close()
  return {loadMs, ...result}
}

async function main() {
  const {server, port} = await startServer(ROOT, 0)
  console.error(`[serve] http://127.0.0.1:${port}`)
  if (!args.append) {
    if (existsSync(OUT)) writeFileSync(OUT, '') // truncate
    else writeFileSync(OUT, '')
  }
  const launchOpts = {
    headless: 'new',
    protocolTimeout: 1_800_000,
    args: [
      '--use-gl=angle',
      '--enable-gpu',
      '--enable-webgl',
      '--no-sandbox',
      '--ignore-gpu-blocklist',
    ],
  }
  // One persistent browser warms Chrome's JIT and keeps it warm across
  // graphs. Each trial uses a fresh page so released graph state can be
  // garbage-collected between trials.
  const browser = await puppeteer.launch(launchOpts)
  try {
    for (const g of GRAPHS) {
      if (ONLY && !ONLY.includes(g.label)) continue
      for (let trial = 0; trial < TRIALS; trial++) {
        process.stderr.write(`[run] ${g.label} trial ${trial + 1}/${TRIALS} ... `)
        const t0 = Date.now()
        let res
        try {
          res = await runTrial(browser, port, g.label, g.url, g.loadTimeoutMs, trial)
        } catch (e) {
          res = {error: e.message || String(e)}
        }
        const wall = Date.now() - t0
        const summary = res.frameTimes
          ? {
              frame: summarize(res.frameTimes),
              longTasks: {
                count: res.longTasks.length,
                totalMs: res.longTasks.reduce((a, b) => a + b, 0),
                maxMs: res.longTasks.reduce((a, b) => Math.max(a, b), 0),
              },
              peakElements: {
                max: res.peakElementsMax ?? null,
                mean: res.peakElementsMean ?? null,
                perDive: res.peakElementsPerDive ?? null,
              },
              peakTiles: {
                max: res.peakTilesMax ?? null,
                mean: res.peakTilesMean ?? null,
                perDive: res.peakTilesPerDive ?? null,
              },
            }
          : null
        const line = JSON.stringify({
          graph: g.label,
          trial: trial + 1,
          wallMs: wall,
          loadMs: res.loadMs ?? null,
          durMs: res.durMs ?? null,
          tilePyramidLevels: res.tilePyramidLevels ?? null,
          tileLayer: res.tileLayer ?? null,
          dives: res.dives ?? null,
          summary,
          error: res.error ?? null,
        })
        appendFileSync(OUT, line + '\n')
        if (res.error) {
          process.stderr.write(`ERROR ${res.error}\n`)
        } else {
          const fr = summary.frame
          process.stderr.write(
            `done in ${(wall / 1000).toFixed(1)}s, mean ${fr.mean.toFixed(1)}ms, p95 ${fr.p95.toFixed(1)}ms, ` +
              `${summary.longTasks.count} long tasks, peak elts max ${summary.peakElements.max}\n`,
          )
        }
      }
    }
  } finally {
    await browser.close()
    server.close()
  }
  console.error(`[done] results in ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
