// Browsing-smoothness ablation harness for the GD 2026 paper.
//
// For each (graph, maxLevels) configuration, drive a deterministic
// programmatic zoom-in tour through deck.gl, record per-frame time
// (via requestAnimationFrame timestamps) and main-thread long tasks
// (via PerformanceObserver), and write a JSON line per trial.
//
// Usage:
//   node bench/smoothness.mjs [--trials=3] [--frames=600] [--out=results.jsonl]
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
const TRIALS = parseInt(args.trials ?? 3, 10)
const FRAMES_PER_TRIAL = parseInt(args.frames ?? 600, 10)
const OUT = resolve(args.out ?? join(__dirname, 'smoothness-results.jsonl'))
const ONLY = args.only ? String(args.only).split(',') : null

const GRAPHS = [
  {label: 'gameofthrones', url: './graphs/gameofthrones.json', loadTimeoutMs: 60_000},
  {label: 'composers', url: './graphs/composers.json', loadTimeoutMs: 60_000},
  {label: 'ca-GrQc', url: './graphs/ca-GrQc.txt.gz', loadTimeoutMs: 90_000},
  {label: 'ca-HepPh', url: './graphs/ca-HepPh.txt.gz', loadTimeoutMs: 900_000},
]
const CONFIGS = [
  {name: 'pyramid', maxLevels: 8},
  {name: 'singleLayer', maxLevels: 0},
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

async function runTrial(browser, port, graphLabel, graphUrl, maxLevels, loadTimeoutMs, framesPerTrial) {
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

  const url = `http://127.0.0.1:${port}/?url=${encodeURIComponent(graphUrl)}&maxLevels=${maxLevels}`
  const t0 = Date.now()
  await page.goto(url, {waitUntil: 'domcontentloaded'})
  await page.waitForFunction(() => (window).__msaglReady === true, {timeout: loadTimeoutMs})
  const loadMs = Date.now() - t0

  // Settle one second after the initial render so any background work in
  // the layout/route worker drains before we start measuring.
  await new Promise((r) => setTimeout(r, 1000))

  const result = await page.evaluate(async (frames) => {
    const renderer = (window).__msaglRenderer
    const deck = renderer && renderer._deck
    if (!deck) return {error: 'deck not ready'}

    // Read current view state and the layer's zoom range so the tour
    // covers the full pyramid.
    const vs = deck.viewManager.getViewState()
    const layer = (deck.props.layers || [])[0]
    const minZoom = layer && layer.props ? layer.props.minZoom : (vs.zoom ?? 0)
    const maxZoom = layer && layer.props ? layer.props.maxZoom : (vs.zoom ?? 0)
    const target = vs.target || [0, 0, 0]

    // Frame timestamps + long-task durations.
    const frameTs = []
    const longTasks = []
    let raf = 0
    let stop = false
    const tick = (t) => {
      frameTs.push(t)
      if (!stop) raf = requestAnimationFrame(tick)
    }

    // PerformanceObserver for long tasks (> 50 ms).
    let po = null
    try {
      po = new PerformanceObserver((entries) => {
        for (const e of entries.getEntries()) longTasks.push({start: e.startTime, dur: e.duration})
      })
      po.observe({entryTypes: ['longtask']})
    } catch (_e) { /* longtask not supported */ }

    raf = requestAnimationFrame(tick)
    const tStart = performance.now()

    // Scripted zoom-in then pan-out tour. Interpolate linearly so frame
    // count corresponds to wall-clock at ~60 Hz.
    const zoomFrames = Math.floor(frames * 0.5)
    const panFrames = frames - zoomFrames
    const zSpan = Math.max(0, (maxZoom ?? 0) - (minZoom ?? 0))

    for (let i = 0; i < zoomFrames; i++) {
      const z = minZoom + (zSpan * i) / Math.max(1, zoomFrames - 1)
      deck.setProps({
        viewState: {target, zoom: z},
      })
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    }
    // Pan: oscillate target along x at the finest zoom to force
    // tile-cache misses on tile boundaries (in pyramid mode) or
    // re-render of the root tile every frame (in single-layer mode).
    const panAmplitude = 200
    for (let i = 0; i < panFrames; i++) {
      const phase = (i / panFrames) * 2 * Math.PI
      const dx = Math.sin(phase) * panAmplitude
      deck.setProps({
        viewState: {target: [target[0] + dx, target[1], target[2] || 0], zoom: maxZoom},
      })
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    }

    const tEnd = performance.now()
    stop = true
    cancelAnimationFrame(raf)
    if (po) po.disconnect()

    // Compute frame intervals (ms between consecutive rAF callbacks).
    const frameTimes = []
    for (let i = 1; i < frameTs.length; i++) frameTimes.push(frameTs[i] - frameTs[i - 1])

    // Probe the deck.gl TileLayer's active tile set at peak zoom and sum
    // node/edge/label/arrowhead counts across visible tiles. This is the
    // GPU-load proxy: pyramid mode caps per-tile elements at TileCapacity
    // and only draws a bounded number of tiles, while single-layer mode
    // draws the single root tile (≈ |G| elements) on every frame.
    let visibleTileElements = null
    let visibleTileCount = null
    try {
      const tileLayer = (deck.props.layers || [])[0]
      const tileset = tileLayer && tileLayer.state && tileLayer.state.tileset
      const selected = tileset && (tileset.selectedTiles || tileset.tiles) || []
      let elementSum = 0
      let tilesCounted = 0
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
      for (const tile of selected) {
        const sz = tileSize(tile)
        if (sz > 0) {
          elementSum += sz
          tilesCounted += 1
        }
      }
      visibleTileElements = elementSum
      visibleTileCount = tilesCounted
    } catch (_e) { /* probe is best-effort */ }

    return {
      durMs: tEnd - tStart,
      frameTimes,
      longTasks: longTasks.map((l) => l.dur),
      tilePyramidLevels: (renderer && renderer.maxTileLevels !== undefined) ? renderer.maxTileLevels + 1 : null,
      visibleTileElements,
      visibleTileCount,
    }
  }, framesPerTrial)

  await page.close()
  return {loadMs, ...result}
}

async function main() {
  const {server, port} = await startServer(ROOT, 0)
  console.error(`[serve] http://127.0.0.1:${port}`)
  if (existsSync(OUT)) writeFileSync(OUT, '') // truncate
  else writeFileSync(OUT, '')
  const browser = await puppeteer.launch({
    headless: 'new',
    protocolTimeout: 900_000,
    args: [
      '--use-gl=angle',
      '--enable-gpu',
      '--enable-webgl',
      '--no-sandbox',
      '--ignore-gpu-blocklist',
    ],
  })
  try {
    for (const g of GRAPHS) {
      if (ONLY && !ONLY.includes(g.label)) continue
      for (const c of CONFIGS) {
        for (let trial = 0; trial < TRIALS; trial++) {
          process.stderr.write(`[run] ${g.label} ${c.name} trial ${trial + 1}/${TRIALS} ... `)
          const t0 = Date.now()
          let res
          try {
            res = await runTrial(browser, port, g.label, g.url, c.maxLevels, g.loadTimeoutMs, FRAMES_PER_TRIAL)
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
                visibleTileElements: res.visibleTileElements ?? null,
                visibleTileCount: res.visibleTileCount ?? null,
              }
            : null
          const line = JSON.stringify({
            graph: g.label,
            config: c.name,
            maxLevels: c.maxLevels,
            trial: trial + 1,
            wallMs: wall,
            loadMs: res.loadMs ?? null,
            durMs: res.durMs ?? null,
            tilePyramidLevels: res.tilePyramidLevels ?? null,
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
                `${summary.longTasks.count} long tasks\n`,
            )
          }
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
