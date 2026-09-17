// For nodes dropped from the coarsest level, report which accepted node's
// scaled padded box overlaps their unit padded box (the reason for the drop).
import puppeteer from 'puppeteer'

const URL = process.argv[2] ?? 'http://127.0.0.1:8899/index.html?graph=gameofthrones.json'
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--window-size=1600,1200'],
})
const page = await browser.newPage()
await page.setViewport({width: 1600, height: 1200})
await page.goto(URL, {waitUntil: 'domcontentloaded'})
await page.waitForFunction('window.__msaglReady === true', {timeout: 120000})

const report = await page.evaluate(() => {
  const r = window.__msaglRenderer
  const tm = r._tileMap
  const scales = tm.nodeScales
  const Z = scales.length - 1
  const top = scales[0]
  const sorted = tm.sortedNodes
  const prefix = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2 ** Z)))
  // reconstruct the filter margin: 2P + P + 3P with P = routing padding
  const gg = tm.geomGraph
  const P = gg.layoutSettings.commonSettings.edgeRoutingSettings.Padding
  const margin = 6 * P
  const geoms = new Map()
  for (const gn of gg.nodesBreadthFirst) geoms.set(gn.node, gn)
  const boxOf = (n, s) => {
    const b = geoms.get(n).boundingBox
    const c = b.center
    return {
      l: c.x - (b.width / 2) * s - margin,
      r: c.x + (b.width / 2) * s + margin,
      b: c.y - (b.height / 2) * s - margin,
      t: c.y + (b.height / 2) * s + margin,
    }
  }
  const overlaps = (a, b) => a.l < b.r && b.l < a.r && a.b < b.t && b.b < a.t
  const out = {padding: P, blockers: {}}
  for (const n of prefix) {
    if (top.has(n)) continue
    const unit = boxOf(n, 1)
    const bl = []
    for (const [u, s] of top.entries()) {
      if (overlaps(unit, boxOf(u, s))) bl.push(u.id + ':' + s.toFixed(2))
    }
    out.blockers[n.id] = bl
  }
  return out
})
console.log(JSON.stringify(report, null, 1))
await browser.close()
