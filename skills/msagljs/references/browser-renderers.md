# Browser renderers

Both renderers create geometry and run layout when `setGraph()` receives a graph
without existing geometry.

## SVG renderer

Use `RendererSvg` for small-to-medium graphs, editable SVG output, DOM-friendly
integration, and static SVG serialization.

```ts
import {EdgeRoutingMode} from '@msagl/core'
import {parseDot} from '@msagl/parser'
import {RendererSvg} from '@msagl/renderer-svg'

const container = document.querySelector<HTMLElement>('#graph')
if (!container) throw new Error('Missing #graph container')

const graph = parseDot('digraph G { browser -> api; api -> database }')
if (!graph) throw new Error('Could not parse graph')

const renderer = new RendererSvg(container)
renderer.layoutEditingEnabled = false
renderer.setGraph(graph, {
  layoutType: 'Sugiyama LR',
  edgeRoutingMode: EdgeRoutingMode.Spline,
})

const svg = renderer.getSvgString()
```

Use CSS similar to:

```css
#graph {
  min-height: 28rem;
  position: relative;
}

#graph svg {
  width: 100%;
  height: 100%;
  display: block;
}
```

## WebGL renderer

Use WebGL for larger graphs, semantic zoom, and browsing performance.

```ts
import {parseJSON} from '@msagl/parser'
import {Renderer} from '@msagl/renderer-webgl'

const container = document.querySelector<HTMLElement>('#graph')
if (!container) throw new Error('Missing #graph container')

const graph = parseJSON({
  nodes: [{id: 'browser'}, {id: 'api'}, {id: 'database'}],
  edges: [
    {source: 'browser', target: 'api'},
    {source: 'api', target: 'database'},
  ],
})

const renderer = new Renderer(container)
await renderer.setGraph(graph, {layoutType: 'Sugiyama LR'})
```

The WebGL container must have a real height and should be positioned. Await
`setGraph()` and `setOptions()` before treating layout as complete.

## Renderer lifecycle

- Construct a renderer after the container is mounted.
- Keep it in a module variable or framework ref, not component state.
- Reuse it with `setGraph()` or `setOptions()`.
- Do not instantiate a renderer during every framework render.
- The renderers do not currently share a public disposal API. Do not reach into
  private renderer or deck.gl fields. Avoid remount loops and remove
  application-owned listeners or fetches during cleanup.

For page-load, SSR, data-fetching, and responsive examples, see
[live-web-embedding.md](live-web-embedding.md).
