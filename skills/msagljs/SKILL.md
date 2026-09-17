---
name: msagljs
description: Use MSAGL-JS (Microsoft Automatic Graph Layout) to lay out and visualize networks in JavaScript or TypeScript. Use for graph and network layout, DOT/JSON/JGF parsing, live embedded SVG or WebGL graphs, Sugiyama/MDS/IPSepCola layouts, edge routing, and exporting SVG, PDF, PNG, EPS, or PostScript figures for LaTeX and other documents.
license: MIT
compatibility: JavaScript or TypeScript. Browser APIs are required for SVG/WebGL rendering. The static export helper requires Node.js 20+ and optionally Ghostscript for EPS or PostScript.
metadata:
  author: Microsoft
  source: https://github.com/microsoft/msagljs
---

# MSAGL-JS

Use this skill to add automatic graph layout or network visualization with the
`@msagl/*` packages.

## Choose the workflow

| Goal | Workflow |
| --- | --- |
| Compute node positions and routed edge curves without a viewer | [Core layout](references/core-layout.md) |
| Embed an interactive graph that appears when a page loads | [Live web embedding](references/live-web-embedding.md) |
| Add or configure the SVG or WebGL renderer | [Browser renderers](references/browser-renderers.md) |
| Select a layout algorithm or edge-routing mode | [Layout and routing](references/layout-and-routing.md) |
| Generate SVG, PDF, PNG, EPS, or PostScript for a document | [Document export](references/document-export.md) |
| Choose packages or parse graph inputs | [Packages and inputs](references/packages-and-inputs.md) |
| Diagnose an integration problem | [Troubleshooting](references/troubleshooting.md) |

## Required process

1. Inspect the target project's package manager, framework, runtime, and existing
   build or test commands.
2. Determine whether the result should be core geometry, a live SVG viewer, a
   live WebGL viewer, or a static document figure.
3. Identify the graph source: programmatic nodes and edges, inline DOT/JSON, a
   local graph file, or an API response.
4. Install every `@msagl/*` package imported directly by the code. Do not rely
   on transitive dependencies.
5. Select the layout and routing based on graph direction, graph size, and the
   desired visual style.
6. Implement the matching workflow using public package exports.
7. Validate with the target project's existing typecheck, build, tests, or a
   browser smoke test. Confirm the output is visibly non-empty.

## Invariants

- `new Edge(source, target)` registers the edge with both endpoint nodes. Do not
  invent a separate `addEdge` call.
- Add every node to its `Graph`.
- Direct core layout requires a `GeomGraph`, a `GeomNode` with a boundary curve
  for each node, and a `GeomEdge` for each edge before `layoutGeomGraph`.
- `RendererSvg.setGraph()` is synchronous. WebGL `Renderer.setGraph()` is
  asynchronous and must be awaited.
- Browser renderers require `window`, `document`, canvas text measurement, and
  a mounted container with nonzero dimensions. Do not run them during SSR.
- Pass a dedicated container to a renderer. Do not rely on its `document.body`
  default in an embedded application.
- Retain one renderer instance per mounted container and update it with
  `setGraph()` or `setOptions()`. Do not reconstruct it on every framework
  render.
- Omit `layoutType` to use the renderer default. The string `'default'` is not a
  valid `LayoutOptions.layoutType`.
- Use only public package exports, not internal source paths.
- Preserve the textual graph source when generating PDF, EPS, or PostScript.
  The binary figure should not be the only editable artifact.

## Static export helper

For a repository without an existing browser application, install the helper's
locked dependencies from this skill directory:

```bash
npm ci --prefix scripts
```

Then render a graph:

```bash
node scripts/render-network.mjs examples/network.dot figures/network.pdf \
  --layout sugiyama-lr \
  --routing spline
```

The output extension selects `svg`, `pdf`, `png`, `eps`, or `ps`. PDF is the
default choice for pdfLaTeX, LuaLaTeX, and XeLaTeX. EPS is intended for legacy
LaTeX-to-DVI-to-PostScript workflows.

Do not pre-approve shell execution for this skill. Let the agent host apply its
normal permission policy before installing dependencies or running commands.

## Completion criteria

- The graph input is retained or generated in a reviewable text format.
- The selected packages, layout, routing, and renderer match the use case.
- Live viewers show loading and error states and render after their container is
  mounted.
- Static outputs use vector SVG/PDF/EPS unless raster output was requested.
- Generated code compiles, and the resulting graph or document asset has been
  opened or otherwise checked for non-empty output.
