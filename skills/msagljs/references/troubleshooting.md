# Troubleshooting

## The viewer is blank

- Confirm the container exists before constructing the renderer.
- Give it nonzero width and height.
- For SVG, make the generated `svg` fill the container.
- Check that parsing returned a graph rather than `null`.
- Show caught fetch/layout errors in the UI.

## `window` or `document` is undefined

SVG and WebGL rendering is browser-only. Move renderer imports and construction
behind the client boundary or mount hook. Use `@msagl/core` alone for headless
layout.

## Direct core layout fails

Verify that:

- Every node belongs to the graph.
- Every node has a `GeomNode` and non-degenerate boundary curve.
- The graph has a `GeomGraph`.
- Every edge has a `GeomEdge`.

## The WebGL loading indicator never finishes

Await `renderer.setGraph()` and `renderer.setOptions()`. Catch rejections and
clear or replace the loading state in `finally`.

## Duplicate canvases, SVGs, or event handlers appear

The application is probably reconstructing the renderer during rerenders. Keep
one renderer in a ref or module instance and update it. Do not access private
renderer fields to force cleanup.

## TypeScript cannot find an imported symbol

- Confirm the correct package is installed directly.
- Use the package root export.
- Inspect the installed package's `.d.ts` files when the consumer uses a
  different published version than this repository's `dev` branch.
- Do not import from `@msagl/*/src/...`.

## Layout or routing is too slow

- Prefer straight lines or no routing.
- Avoid spline bundling and rectilinear routing for large graphs.
- Use WebGL for large interactive graphs.
- Filter or aggregate dense static figures.

## PDF, EPS, or PostScript export fails

- Run `npm ci --prefix scripts`.
- Confirm Puppeteer's browser installation succeeded.
- For EPS/PS, install Ghostscript and ensure `gs` is on `PATH`.
- Keep the SVG source when conversion fails.
- Validate page bounds and fonts in the generated document.
