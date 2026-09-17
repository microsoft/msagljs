# Live web embedding

Use this workflow when the graph should load and become interactive as part of
a web page.

## Choose SVG or WebGL

| Situation | Renderer |
| --- | --- |
| Small-to-medium graph, SVG output, editing, simple DOM integration | `RendererSvg` |
| Large graph, semantic zoom, smoother browsing | WebGL `Renderer` |

## Vanilla page startup

Use a deferred module script or a ready-state-safe initializer:

```ts
import {loadGraphFromUrl} from '@msagl/parser'
import {RendererSvg} from '@msagl/renderer-svg'

async function start() {
  const viewer = document.querySelector<HTMLElement>('#graph')
  const status = document.querySelector<HTMLElement>('#graph-status')
  const error = document.querySelector<HTMLElement>('#graph-error')
  if (!viewer || !status || !error) throw new Error('Missing graph UI elements')

  viewer.setAttribute('aria-busy', 'true')
  try {
    const graph = await loadGraphFromUrl('/graphs/network.gv')
    if (!graph) throw new Error('Graph parser returned no graph')

    const renderer = new RendererSvg(viewer)
    renderer.layoutEditingEnabled = false
    renderer.setGraph(graph)
    status.hidden = true
  } catch (reason) {
    error.textContent = reason instanceof Error ? reason.message : String(reason)
    error.hidden = false
  } finally {
    viewer.setAttribute('aria-busy', 'false')
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void start(), {once: true})
} else {
  void start()
}
```

## Container contract

A renderer can run successfully while remaining invisible if the container has
zero height.

```css
#graph {
  position: relative;
  width: 100%;
  min-height: 32rem;
}

#graph svg {
  width: 100%;
  height: 100%;
  display: block;
}
```

When a flex child contains the graph, it may also need `min-height: 0`.

## Data loading

- Use `loadGraphFromUrl()` for same-origin static graph files.
- Use `fetch()` plus `parseJSON()`, `parseJGF()`, or `parseTXT()` for an API
  whose response format is known.
- Use `AbortController` for route changes, prop changes, or repeated loads.
- Reject stale responses so an older request cannot replace a newer graph.
- Surface HTTP status and parser failures in the page. A blank container is not
  an acceptable error state.

## Framework and SSR integration

For React, Next.js, Vue, Nuxt, Svelte, SvelteKit, and similar frameworks:

1. Put renderer code behind the client boundary.
2. Construct it in a mount effect or hook after the container ref exists.
3. Store the renderer in a ref or module instance.
4. Update it with `setGraph()` or `setOptions()`.
5. Abort application-owned fetches when the component unmounts or inputs
   change.
6. Never access `window` or `document` during server rendering.

For WebGL, await each `setGraph()` or `setOptions()` call. Debounce rapid option
changes and ignore superseded async work.

## Accessibility and safety

- Give the visualization region an accessible label.
- Keep a textual summary or data download for information that is otherwise
  available only visually.
- Validate or trust graph sources. Do not silently fetch arbitrary third-party
  URLs.
- Treat labels as text unless the application explicitly sanitizes supported
  markup.
