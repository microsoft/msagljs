// Load the built webgl-sleeve demo for the Game of Thrones graph and report
// which nodes populate each tile-pyramid level — checks the paper's
// "Arya dropped from the coarsest level" example against the real pipeline.
// Assumes the demo is served (e.g. python3 -m http.server 8899 in
// website/static/webgl-sleeve) and the bundle is current.
import puppeteer from 'puppeteer'

const URL = process.argv[2] ?? 'http://127.0.0.1:8899/index.html?graph=gameofthrones.json'

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--window-size=1600,1200'],
})
const page = await browser.newPage()
await page.setViewport({width: 1600, height: 1200})
page.on('console', (m) => {
  const t = m.text()
  if (/error/i.test(t)) console.error('[page]', t)
})
await page.goto(URL, {waitUntil: 'domcontentloaded'})
await page.waitForFunction('window.__msaglReady === true', {timeout: 120000})

const report = await page.evaluate(() => {
  const r = window.__msaglRenderer
  const tm = r && r._tileMap
  if (!tm) return {error: 'no tile map'}
  const out = {levels: []}
  const scales = tm.nodeScales
  for (let k = 0; k < scales.length; k++) {
    const m = scales[k]
    const entry = {level: k, size: m.size}
    if (k <= 2) entry.nodes = [...m.entries()].map(([n, s]) => `${n.id}:${s.toFixed(2)}`)
    else {
      entry.ARYA = m.has([...m.keys()].find((n) => n.id === 'ARYA'))
      const find = (id) => [...m.keys()].some((n) => n.id === id)
      entry.ARYA = find('ARYA')
      entry.TYRION = find('TYRION')
    }
    out.levels.push(entry)
  }
  // which of the top-25 PageRank candidates are dropped at level 0
  const sorted = tm.sortedNodes
  const prefix0 = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2 ** (scales.length - 1))))
  const top = scales[0]
  out.level0PrefixSize = prefix0.length
  out.droppedAtLevel0 = prefix0.filter((n) => ![...top.keys()].includes(n)).map((n) => n.id)
  return out
})
console.log(JSON.stringify(report, null, 1))
await browser.close()
