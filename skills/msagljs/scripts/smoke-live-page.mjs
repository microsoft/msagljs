#!/usr/bin/env node

import {createReadStream} from 'node:fs'
import {stat} from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'
import puppeteer from 'puppeteer'

const root = path.resolve(process.argv[2] || new URL('../examples', import.meta.url).pathname)
const mimeTypes = {
  '.dot': 'text/vnd.graphviz',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
}

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
    if (pathname === '/favicon.ico') {
      response.writeHead(204).end()
      return
    }
    const relative = pathname === '/' ? 'live-page.html' : pathname.slice(1)
    const file = path.resolve(root, relative)
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end('Forbidden')
      return
    }

    const info = await stat(file)
    if (!info.isFile()) throw new Error('Not a file')
    response.writeHead(200, {'content-type': mimeTypes[path.extname(file)] || 'application/octet-stream'})
    createReadStream(file).pipe(response)
  } catch {
    response.writeHead(404).end('Not found')
  }
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
if (!address || typeof address === 'string') throw new Error('Could not start smoke-test server')
const origin = `http://127.0.0.1:${address.port}`

const launchArgs = process.env.PUPPETEER_NO_SANDBOX === '1' ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
const browser = await puppeteer.launch({headless: true, args: launchArgs})

try {
  const successPage = await browser.newPage()
  const errors = []
  successPage.on('pageerror', (error) => errors.push(error.message))
  successPage.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await successPage.goto(`${origin}/live-page.html?graph=network.dot`, {waitUntil: 'networkidle0'})
  await successPage.waitForSelector('#viewer svg path', {timeout: 30000})
  const pathCount = await successPage.$$eval('#viewer svg path', (paths) => paths.length)
  if (pathCount === 0) throw new Error('Live page created no SVG paths')
  if (errors.length) throw new Error(`Live page browser errors: ${errors.join('; ')}`)

  const downloadedSvg = await successPage.evaluate(async () => {
    let blob
    let downloadName
    URL.createObjectURL = (value) => {
      blob = value
      return 'blob:msagljs-smoke-test'
    }
    URL.revokeObjectURL = () => {}
    HTMLAnchorElement.prototype.click = function () {
      downloadName = this.download
    }

    document.getElementById('download-svg').click()
    if (!blob) throw new Error('Download button did not create an SVG blob')
    return {downloadName, svg: await blob.text()}
  })
  if (!downloadedSvg.downloadName.endsWith('.svg')) throw new Error('Download button did not set an SVG file name')
  if (!/<svg[^>]+viewBox="0 0 [^"]+"/.test(downloadedSvg.svg)) {
    throw new Error('Downloaded SVG does not have standalone viewport bounds')
  }

  const failurePage = await browser.newPage()
  await failurePage.goto(`${origin}/live-page.html?graph=missing.dot`, {waitUntil: 'networkidle0'})
  await failurePage.waitForFunction(() => {
    const error = document.getElementById('graph-error')
    return error && !error.hidden && error.textContent.trim().length > 0
  })

  console.log('Live SVG page smoke test passed')
} finally {
  await browser.close()
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}
