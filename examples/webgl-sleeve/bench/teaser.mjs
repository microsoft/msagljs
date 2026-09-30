// Re-shoot the paper teaser: two adjacent pyramid levels of Game of Thrones,
// same center, settings panel and top bar hidden.
import http from 'node:http'
import {createReadStream, statSync} from 'node:fs'
import {extname, join, resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import puppeteer from 'puppeteer'
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..', '..', 'website', 'static', 'webgl-sleeve')
const OUTDIR = process.argv[2]
const MIME = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json','.gz':'application/gzip','.gif':'image/gif'}
function startServer(rootDir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let p = join(rootDir, urlPath === '/' ? '/index.html' : urlPath)
    try { if (statSync(p).isDirectory()) p = join(p, 'index.html') } catch { res.statusCode = 404; return res.end('nf') }
    res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream')
    createReadStream(p).pipe(res)
  })
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({server, port: server.address().port})))
}
const {server, port} = await startServer(ROOT)
const browser = await puppeteer.launch({headless: 'new', channel: 'chrome', protocolTimeout: 600000,
  args: ['--use-gl=angle','--enable-gpu','--enable-webgl','--no-sandbox','--ignore-gpu-blocklist','--hide-scrollbars']})
try {
  const page = await browser.newPage()
  await page.setViewport({width: 1100, height: 700, deviceScaleFactor: 4})
  page.on('pageerror', (e) => console.error('[pageerror]', e.message))
  await page.goto(`http://127.0.0.1:${port}/?url=${encodeURIComponent('./graphs/gameofthrones.json')}`, {waitUntil: 'domcontentloaded'})
  await page.waitForFunction(() => window.__msaglReady === true, {timeout: 120000})
  await new Promise((r) => setTimeout(r, 1500))
  const info = await page.evaluate(() => {
    for (const el of document.querySelectorAll('input, button, select')) el.style.visibility = 'hidden'
    for (const id of ['settings', 'top-bar', 'error-banner']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden' }
    const deck = window.__msaglRenderer._deck
    const layer = deck.props.layers[0]
    const box = window.__msaglGraphBox
    const e = layer.props.extent
    const r = window.__msaglRenderer
    const keys = Object.keys(r)
    const g = r._graph || r.graph
    let gb = null
    try { const b = g.boundingBox || (g.geomGraph && g.geomGraph.boundingBox); gb = b && {left: b.left, right: b.right, top: b.top, bottom: b.bottom} } catch {}
    const probe = {graphKeys: g && Object.keys(g), tileMapKeys: r._tileMap && Object.keys(r._tileMap), offset: r._graphOffset, startZoom: r._startZoom, maxTileZoom: r._maxTileZoom}
    try { const ga = g.getAttr ? g.getAttr(0) : (g.attrs && g.attrs[0]); const b = ga && ga.boundingBox; if (b) gb = {left: b.left, right: b.right, top: b.top, bottom: b.bottom} } catch (e) { probe.err = String(e) }
    try { const tm = r._tileMap; const b = tm.geomGraph ? tm.geomGraph.boundingBox : (tm.topLevelTileRect || tm.rootRect); if (b) probe.tmBox = {left: b.left, right: b.right, top: b.top, bottom: b.bottom} } catch {}
    return {keys, gb, probe, minZoom: layer.props.minZoom, maxZoom: layer.props.maxZoom, box: box || {left: e[0], bottom: e[1], right: e[2], top: e[3]}, extent: e}
  })
  console.error('info', JSON.stringify(info))
  const off = info.probe.offset, gb = info.gb
  const cx = (gb.left + gb.right) / 2 + off.x, cy = (gb.top + gb.bottom) / 2 + off.y
  console.error('center', cx, cy)
  const canvas = await page.$('canvas')
  const zooms = (process.argv[3] || '-2,-1,0').split(',').map(Number)
  for (const z of zooms) {
    await page.evaluate((t, z) => { window.__msaglRenderer._deck.setProps({viewState: {target: t, zoom: z}}) }, [cx, cy, 0], z)
    await new Promise((r) => setTimeout(r, 2500))
    const rect = await canvas.boundingBox()
    await page.screenshot({path: `${OUTDIR}/got_z${z}.png`, clip: rect})
    console.error('shot zoom', z)
  }
} finally { await browser.close(); server.close() }
