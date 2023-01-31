import puppeteer from 'puppeteer'
import path from 'path'
// print process.argv
let dir: string
process.argv.forEach(function (val, index, array) {
  if (index == 1) {
    dir = path.dirname(val)
  }
  console.log(index + ': ' + val)
})

try_puppeteer()

async function try_puppeteer() {
  const browser = await puppeteer.launch({headless: false})

  try {
    const page = await browser.newPage()
    const html: string = 'file:///' + path.join(dir, '../../../', 'examples/svg-renderer/dist/index.html')
    await page.goto(html)
    console.log('here')
  } catch (err) {
    console.error(err)
  } finally {
    // await browser.close()
  }
}
