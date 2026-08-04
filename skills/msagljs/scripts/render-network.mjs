#!/usr/bin/env node

import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import process from 'node:process'
import puppeteer from 'puppeteer'

const require = createRequire(import.meta.url)

const layoutTypes = {
  default: undefined,
  'sugiyama-lr': 'Sugiyama LR',
  'sugiyama-tb': 'Sugiyama TB',
  'sugiyama-bt': 'Sugiyama BT',
  'sugiyama-rl': 'Sugiyama RL',
  mds: 'MDS',
  ipsepcola: 'IPsepCola',
}

const routingTypes = {
  default: undefined,
  spline: 'Spline',
  bundling: 'SplineBundling',
  straight: 'StraightLine',
  sugiyama: 'SugiyamaSplines',
  rectilinear: 'Rectilinear',
  none: 'None',
}

function usage() {
  return `Usage:
  node render-network.mjs INPUT OUTPUT [options]

OUTPUT extension: .svg, .pdf, .png, .eps, or .ps

Options:
  --input-format dot|json|jgf|txt
  --layout ${Object.keys(layoutTypes).join('|')}
  --routing ${Object.keys(routingTypes).join('|')}
  --margin NUMBER
  --background COLOR|transparent
  --font-family NAME
  --font-size NUMBER
  --help`
}

function parseArgs(argv) {
  const positional = []
  const options = {
    inputFormat: undefined,
    layout: 'default',
    routing: 'default',
    margin: 12,
    background: 'white',
    fontFamily: 'sans-serif',
    fontSize: 16,
  }

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      console.log(usage())
      process.exit(0)
    }
    if (!argument.startsWith('--')) {
      positional.push(argument)
      continue
    }

    const value = argv[++index]
    if (value == null) throw new Error(`Missing value for ${argument}`)

    switch (argument) {
      case '--input-format':
        options.inputFormat = value.toLowerCase()
        break
      case '--layout':
        options.layout = value.toLowerCase()
        break
      case '--routing':
        options.routing = value.toLowerCase()
        break
      case '--margin':
        options.margin = Number(value)
        break
      case '--background':
        options.background = value
        break
      case '--font-family':
        options.fontFamily = value
        break
      case '--font-size':
        options.fontSize = Number(value)
        break
      default:
        throw new Error(`Unknown option ${argument}`)
    }
  }

  if (positional.length !== 2) throw new Error('INPUT and OUTPUT are required')
  if (!(options.layout in layoutTypes)) throw new Error(`Unsupported layout: ${options.layout}`)
  if (!(options.routing in routingTypes)) throw new Error(`Unsupported routing: ${options.routing}`)
  if (!Number.isFinite(options.margin) || options.margin < 0) throw new Error('--margin must be a non-negative number')
  if (!Number.isFinite(options.fontSize) || options.fontSize <= 0) throw new Error('--font-size must be a positive number')

  return {
    input: path.resolve(positional[0]),
    output: path.resolve(positional[1]),
    ...options,
  }
}

function inferInputFormat(input, override) {
  if (override) {
    if (!['dot', 'json', 'jgf', 'txt'].includes(override)) throw new Error(`Unsupported input format: ${override}`)
    return override
  }

  const extension = path.extname(input).toLowerCase()
  if (extension === '.json') return 'json'
  if (extension === '.jgf') return 'jgf'
  if (['.txt', '.tsv', '.csv', '.mtx'].includes(extension)) return 'txt'
  if (['.dot', '.gv'].includes(extension)) return 'dot'
  throw new Error(`Cannot infer input format from ${extension || 'a file without an extension'}; use --input-format`)
}

function inferOutputFormat(output) {
  const extension = path.extname(output).slice(1).toLowerCase()
  if (!['svg', 'pdf', 'png', 'eps', 'ps'].includes(extension)) {
    throw new Error('OUTPUT must end in .svg, .pdf, .png, .eps, or .ps')
  }
  return extension
}

function packageFile(packageName, file) {
  const packageJson = require.resolve(`${packageName}/package.json`)
  return path.join(path.dirname(packageJson), file)
}

function findGhostscript() {
  const configured = process.env.GHOSTSCRIPT
  const candidates = configured
    ? [configured]
    : process.platform === 'win32'
      ? ['gswin64c.exe', 'gswin32c.exe', 'gs.exe']
      : ['gs']

  for (const executable of candidates) {
    if (spawnSync(executable, ['--version'], {stdio: 'ignore'}).status === 0) return executable
  }
  return null
}

function convertPdfWithGhostscript(pdf, output, format) {
  const ghostscript = findGhostscript()
  if (!ghostscript) {
    throw new Error(
      `Ghostscript is required for .${format} output; install it or set GHOSTSCRIPT to the converter executable`,
    )
  }

  const device = format === 'eps' ? 'eps2write' : 'ps2write'
  const result = spawnSync(
    ghostscript,
    ['-dSAFER', '-dBATCH', '-dNOPAUSE', `-sDEVICE=${device}`, `-sOutputFile=${output}`, pdf],
    {encoding: 'utf8'},
  )

  if (result.status !== 0) {
    throw new Error(`Ghostscript failed: ${(result.stderr || result.stdout || '').trim()}`)
  }
}

async function render(options) {
  const content = await readFile(options.input, 'utf8')
  const inputFormat = inferInputFormat(options.input, options.inputFormat)
  const outputFormat = inferOutputFormat(options.output)
  await mkdir(path.dirname(options.output), {recursive: true})

  const launchArgs = process.env.PUPPETEER_NO_SANDBOX === '1' ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
  const browser = await puppeteer.launch({headless: true, args: launchArgs})
  let temporaryDirectory

  try {
    const page = await browser.newPage()
    await page.setContent(`<!doctype html>
      <html>
        <head>
          <style>
            html, body { margin: 0; padding: 0; }
            #viewer { display: block; }
            #viewer svg { display: block; }
          </style>
        </head>
        <body><div id="viewer"></div></body>
      </html>`)

    await page.addScriptTag({path: packageFile('@msagl/core', 'dist.min.js')})
    await page.addScriptTag({path: packageFile('@msagl/parser', 'dist.min.js')})
    await page.addScriptTag({path: packageFile('@msagl/renderer-svg', 'dist.min.js')})

    const rendered = await page.evaluate(
      async ({content, inputFormat, layout, routing, margin, background, fontFamily, fontSize, recognizedHeaders}) => {
        const api = globalThis.msagl
        if (!api) throw new Error('MSAGL browser bundles did not initialize')

        await document.fonts.ready

        let graph
        if (inputFormat === 'json') graph = api.parseJSON(JSON.parse(content))
        else if (inputFormat === 'jgf') {
          const json = JSON.parse(content)
          graph = 'graph' in json || 'graphs' in json ? api.parseJSON(json) : api.parseJGF(json)
        } else if (inputFormat === 'txt') {
          const lines = content.split(/\r\n|\r|\n/)
          const matrixMarket = lines.some((line) => line.trimStart().startsWith('%%MatrixMarket'))
          const nodes = new Set()
          const edges = []
          let firstDataRow = true

          for (const rawLine of lines) {
            const line = rawLine.trim()
            if (!line || line.startsWith('#') || line.startsWith('%')) continue

            const columns = line.split(/[\s,]+/).filter(Boolean)
            if (columns.length < 2) throw new Error(`Cannot parse edge-list row: ${rawLine}`)

            if (firstDataRow) {
              firstDataRow = false
              if (matrixMarket && columns.length >= 3 && columns.slice(0, 3).every((value) => /^\d+$/.test(value))) continue
              if (recognizedHeaders.includes(`${columns[0].toLowerCase()},${columns[1].toLowerCase()}`)) continue
            }

            const source = columns[0]
            const target = columns[1]
            nodes.add(source)
            nodes.add(target)
            edges.push({source, target, directed: true})
          }

          if (edges.length === 0) throw new Error('Edge-list input contains no edges')
          graph = api.parseJSON({
            nodes: Array.from(nodes, (id) => ({id})),
            edges,
          })
        }
        else graph = api.parseDot(content)

        if (!graph) throw new Error(`Could not parse ${inputFormat} input`)

        const drawingIndex = api.AttributeRegistry.DrawingObjectIndex
        const applyFont = (entity) => {
          const drawing = entity && entity.getAttr(drawingIndex)
          if (!drawing) return
          drawing.fontname = fontFamily
          drawing.fontsize = fontSize
        }
        applyFont(graph)
        for (const node of graph.nodesBreadthFirst) applyFont(node)
        for (const edge of graph.deepEdges) applyFont(edge)

        const viewer = document.getElementById('viewer')
        const renderer = new api.RendererSvg(viewer)
        renderer.layoutEditingEnabled = false

        const renderOptions = {
          label: {fontFamily, fontSize},
        }
        if (layout != null) renderOptions.layoutType = layout
        if (routing != null) {
          const routingMode = api.EdgeRoutingMode[routing]
          if (typeof routingMode !== 'number') throw new Error(`Installed @msagl/core does not support ${routing} routing`)
          renderOptions.edgeRoutingMode = routingMode
        }

        renderer.setGraph(graph, renderOptions)

        const geomGraph = api.GeomGraph.getGeom(graph)
        const bounds = geomGraph && geomGraph.boundingBox
        if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
          throw new Error('Layout did not produce finite graph bounds')
        }

        const width = Math.max(1, bounds.width + 2 * margin)
        const height = Math.max(1, bounds.height + 2 * margin)
        const left = bounds.left - margin
        const top = -bounds.top - margin
        const svg = viewer.querySelector('svg')
        if (!svg) throw new Error('Renderer did not create an SVG element')

        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`)
        svg.setAttribute('width', String(width))
        svg.setAttribute('height', String(height))

        if (background !== 'transparent') {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          rect.setAttribute('x', String(left))
          rect.setAttribute('y', String(top))
          rect.setAttribute('width', String(width))
          rect.setAttribute('height', String(height))
          rect.setAttribute('fill', background)
          svg.insertBefore(rect, svg.firstChild)
        }

        Object.assign(document.body.style, {
          margin: '0',
          width: `${width}px`,
          height: `${height}px`,
          background: background === 'transparent' ? 'transparent' : background,
        })
        Object.assign(viewer.style, {width: `${width}px`, height: `${height}px`})

        return {svg: renderer.getSvgString(), width, height}
      },
      {
        content,
        inputFormat,
        layout: layoutTypes[options.layout],
        routing: routingTypes[options.routing],
        margin: options.margin,
        background: options.background,
        fontFamily: options.fontFamily,
        fontSize: options.fontSize,
        recognizedHeaders: [
          'source,target',
          'from,to',
          'src,dst',
          'node_1,node_2',
          'node1,node2',
          'source_id,target_id',
        ],
      },
    )

    if (outputFormat === 'svg') {
      await writeFile(options.output, rendered.svg)
    } else {
      const outputPage = await browser.newPage()
      await outputPage.setViewport({
        width: Math.max(1, Math.ceil(rendered.width)),
        height: Math.max(1, Math.ceil(rendered.height)),
        deviceScaleFactor: 1,
      })
      await outputPage.setContent(`<!doctype html>
        <html>
          <head>
            <style>
              html, body { margin: 0; padding: 0; width: ${rendered.width}px; height: ${rendered.height}px; }
              svg { display: block; }
            </style>
          </head>
          <body>${rendered.svg}</body>
        </html>`)
      await outputPage.evaluate(() => document.fonts.ready)

      if (outputFormat === 'png') {
        const svg = await outputPage.$('svg')
        if (!svg) throw new Error('Standalone output page does not contain an SVG element')
        await svg.screenshot({
          path: options.output,
          omitBackground: options.background === 'transparent',
        })
        await outputPage.close()
        console.log(
          `Rendered ${path.basename(options.input)} as ${outputFormat.toUpperCase()} at ${options.output} ` +
            `(layout=${options.layout}, routing=${options.routing})`,
        )
        return
      }

      let pdfOutput = options.output
      if (outputFormat === 'eps' || outputFormat === 'ps') {
        temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'msagljs-export-'))
        pdfOutput = path.join(temporaryDirectory, 'network.pdf')
      }

      await outputPage.emulateMediaType('screen')
      await outputPage.pdf({
        path: pdfOutput,
        width: `${rendered.width}px`,
        height: `${rendered.height}px`,
        margin: {top: 0, right: 0, bottom: 0, left: 0},
        omitBackground: options.background === 'transparent',
        printBackground: true,
        pageRanges: '1',
      })
      await outputPage.close()

      if (outputFormat === 'eps' || outputFormat === 'ps') {
        convertPdfWithGhostscript(pdfOutput, options.output, outputFormat)
      }
    }

    console.log(
      `Rendered ${path.basename(options.input)} as ${outputFormat.toUpperCase()} at ${options.output} ` +
        `(layout=${options.layout}, routing=${options.routing})`,
    )
  } finally {
    await browser.close()
    if (temporaryDirectory) await rm(temporaryDirectory, {recursive: true, force: true})
  }
}

try {
  await render(parseArgs(process.argv.slice(2)))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error(usage())
  process.exitCode = 1
}
