# Copilot Instructions for msagl-js

## Project Overview

msagl-js is a JavaScript/TypeScript implementation of Microsoft's Automatic Graph Layout (MSAGL) algorithms. It computes node positions and edge routes for graph visualization.

## Build, Test, and Lint

```bash
yarn build          # Build all modules (lerna + tsc + esbuild bundles)
yarn test           # Run all tests (Jest with ts-jest)
yarn typecheck      # Type-check without emitting (tsc --noEmit)
yarn eslint         # Lint modules/core/src
yarn prettier       # Format modules/core/src
```

Run a single test file:
```bash
npx jest --testPathPattern="graph.spec"
```

Run examples locally:
```bash
cd examples/svg-renderer && npm run start
cd examples/webgl-renderer && npm run start
```

## Architecture

This is a **Yarn workspaces + Lerna monorepo** with six `@msagl/*` packages under `modules/`:

```
@msagl/core            → Graph data model, layout algorithms, math, routing
@msagl/drawing         → Visual attributes (colors, shapes, styles) for nodes/edges
@msagl/parser          → DOT and JSON graph format parsers
@msagl/renderer-common → Shared renderer utilities (text measurement, etc.)
@msagl/renderer-svg    → SVG renderer (uses panzoom)
@msagl/renderer-webgl  → WebGL renderer (uses deck.gl)
```

**Dependency flow** (each arrow means "depends on"):
```
core ← drawing ← parser ← renderer-common ← renderer-svg
                                            ← renderer-webgl
```
`core` has zero internal dependencies. All other modules depend on `core`.

### Core Data Model (`@msagl/core`)

- **`Graph`** extends **`Node`** — a graph is also a node, enabling nested/clustered subgraphs
- **`Node`** extends **`Entity`** — has an `id` string and `inEdges`/`outEdges`/`selfEdges` sets
- **`Edge`** extends **`Entity`** — connects `source` and `target` nodes; self-registers in node edge sets on construction
- **`GeomGraph`/`GeomNode`/`GeomEdge`** — geometry layer counterparts that store computed positions, curves, and bounding boxes
- Layout and geometry are separate from the structural graph — `Graph`/`Node`/`Edge` hold structure, `Geom*` objects hold layout results

### Layout Algorithms

- **Sugiyama (layered)** — `SugiyamaLayoutSettings`, `LayeredLayout` for hierarchical DAG layouts
- **MDS (multidimensional scaling)** — `MdsLayoutSettings`, `PivotMDS` for force-directed-like layouts
- **Incremental** — `IPsepColaSetting` for interactive/incremental layouts
- Entry point: `layoutGeomGraph()` from `layout/driver.ts`

### Edge Routing

- Spline routing, rectilinear routing, bundle routing, sleeve routing, and straight-line edges
- Configured via `EdgeRoutingSettings` and `EdgeRoutingMode`

## Key Conventions

- **ES modules** — all packages use `"type": "module"` in package.json
- **TypeScript target** — ES2018 with `moduleResolution: node`
- **Formatting** — Prettier with: single quotes, no semicolons, no bracket spacing, trailing commas, 140 char print width
- **Tests** — Jest with ts-jest preset; test files use `*.spec.ts` naming and live in `modules/core/test/` mirroring the `src/` structure
- **Test utilities** — `parseDotGraph()` and other helpers in `modules/core/test/utils/testUtils.ts` load `.gv` graph files for testing
- **Module path aliases** — `@msagl/core`, `@msagl/drawing`, etc. are mapped in both `tsconfig.json` and `jest.config.js`
- **Bundle builds** — each module builds with `tsc` then bundles via a shared `esbuild.js` script at the repo root
- **Graph construction** — `new Edge(source, target)` automatically registers itself in both nodes' edge sets (no separate `addEdge` call)
