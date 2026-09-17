import {loadGraphFromUrl} from '@msagl/parser'
import {Renderer} from '@msagl/renderer-webgl'

async function startWebglGraph() {
  const viewer = document.getElementById('viewer')
  const status = document.getElementById('graph-status')
  const error = document.getElementById('graph-error')
  if (!viewer || !status || !error) throw new Error('Missing graph UI elements')

  viewer.setAttribute('aria-busy', 'true')
  try {
    const graph = await loadGraphFromUrl('./network.json')
    if (!graph) throw new Error('Could not parse network.json')

    const renderer = new Renderer(viewer)
    await renderer.setGraph(graph, {layoutType: 'Sugiyama LR'})
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
  document.addEventListener('DOMContentLoaded', () => void startWebglGraph(), {once: true})
} else {
  void startWebglGraph()
}
