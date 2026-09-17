import {EdgeRoutingMode} from '@msagl/core'
import {loadGraphFromUrl} from '@msagl/parser'
import {RendererSvg} from '@msagl/renderer-svg'

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing #${id} element`)
  return element as T
}

async function start() {
  const viewer = requireElement<HTMLElement>('viewer')
  const status = requireElement<HTMLElement>('graph-status')
  const error = requireElement<HTMLElement>('graph-error')
  const download = requireElement<HTMLButtonElement>('download-svg')
  const graphUrl = new URLSearchParams(window.location.search).get('graph') || './network.dot'

  viewer.setAttribute('aria-busy', 'true')
  error.hidden = true

  try {
    const graph = await loadGraphFromUrl(graphUrl)
    if (!graph) throw new Error(`Could not parse ${graphUrl}`)

    const renderer = new RendererSvg(viewer)
    renderer.layoutEditingEnabled = false
    renderer.setGraph(graph, {
      layoutType: 'Sugiyama LR',
      edgeRoutingMode: EdgeRoutingMode.Spline,
    })

    download.disabled = false
    download.addEventListener('click', () => {
      const svg = viewer.querySelector('svg')
      if (!svg) throw new Error('Renderer did not create an SVG element')

      const width = Math.max(1, viewer.clientWidth)
      const height = Math.max(1, viewer.clientHeight)
      const standalone = svg.cloneNode(true) as SVGElement
      standalone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      standalone.setAttribute('viewBox', `0 0 ${width} ${height}`)
      standalone.setAttribute('width', String(width))
      standalone.setAttribute('height', String(height))

      const blob = new Blob([new XMLSerializer().serializeToString(standalone)], {type: 'image/svg+xml'})
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `${graph.id || 'network'}.svg`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 0)
    })
    status.hidden = true
  } catch (reason) {
    error.textContent = reason instanceof Error ? reason.message : String(reason)
    error.hidden = false
    status.hidden = true
  } finally {
    viewer.setAttribute('aria-busy', 'false')
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void start(), {once: true})
} else {
  void start()
}
