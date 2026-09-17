# Packages and graph inputs

## Package selection

Install every package that the generated code imports directly.

| Need | Packages |
| --- | --- |
| Graph model, layout geometry, routing only | `@msagl/core` |
| DOT, JSON, JGF, TXT, TSV, CSV, or MTX parsing | `@msagl/parser` plus `@msagl/core` when its types are imported |
| Node/edge colors, shapes, labels, or styles | `@msagl/drawing` plus `@msagl/core` |
| Interactive SVG viewer | `@msagl/renderer-svg`, `@msagl/parser`, and any directly imported core/drawing packages |
| Large-graph WebGL viewer | `@msagl/renderer-webgl`, `@msagl/parser`, and any directly imported core packages |
| Shared renderer option types | `@msagl/renderer-common` |

The packages are ES modules. Match the target project's existing package
manager and module conventions.

## Programmatic graph construction

```ts
import {Edge, Graph, Node} from '@msagl/core'

const graph = new Graph('dependencies')
const api = graph.addNode(new Node('API'))
const service = graph.addNode(new Node('Service'))
const database = graph.addNode(new Node('Database'))

new Edge(api, service)
new Edge(service, database)
```

The `Edge` constructor attaches the edge to its endpoints. Nodes still need to
be added to the graph.

## DOT

```ts
import {parseDot} from '@msagl/parser'

const graph = parseDot(`
  digraph G {
    browser -> api
    api -> database
  }
`)

if (!graph) throw new Error('Could not parse DOT graph')
```

`parseDot()` currently reports syntax details to the console and returns
`null` on failure, so always check the result.

## Simple JSON and JGF

```ts
import {parseJSON} from '@msagl/parser'

const graph = parseJSON({
  nodes: [{id: 'browser'}, {id: 'api'}, {id: 'database'}],
  edges: [
    {source: 'browser', target: 'api', directed: true},
    {source: 'api', target: 'database', directed: true},
  ],
})
```

`parseJSON()` accepts the simple `{nodes, edges}` shape and recognizes JGF
documents with `graph` or `graphs` roots. Use `parseJGF()` when the caller
already has the inner JGF graph object.

## Delimited edge lists

```ts
import {parseTXT} from '@msagl/parser'

const graph = parseTXT(`
source,target
browser,api
api,database
`)

if (!graph) throw new Error('Could not parse edge list')
```

`parseTXT()` accepts whitespace, comma, or tab-separated endpoint pairs and
ignores lines beginning with `#` or `%`. With currently published packages,
include a header row for string node IDs; otherwise the parser can interpret
the first pair as a header. For a headerless string edge list, parse the rows
yourself and pass a `{nodes, edges}` object to `parseJSON()`.

## Files and URLs in a browser

```ts
import {loadGraphFromFile, loadGraphFromUrl} from '@msagl/parser'

const remoteGraph = await loadGraphFromUrl('/graphs/network.gv')
const uploadedGraph = await loadGraphFromFile(file)
```

The loaders infer JSON, TXT/TSV/CSV/MTX, or DOT from the file name and support
`.gz` input when `DecompressionStream` is available. `loadGraphFromUrl()` throws
for unsuccessful HTTP responses. Check for a null graph after parsing.

Prefer same-origin URLs or an application API. If another origin is required,
confirm its CORS policy and that the source is trusted.

## Drawing attributes

Parsing DOT or JSON creates drawing attributes where appropriate. For a
programmatically constructed graph, use `DrawingNode` and `DrawingEdge` only
when visual styling is required:

```ts
import {Edge, Graph, Node} from '@msagl/core'
import {Color, DrawingEdge, DrawingNode, ShapeEnum, StyleEnum} from '@msagl/drawing'

const graph = new Graph()
const source = graph.addNode(new Node('source'))
const target = graph.addNode(new Node('target'))

const sourceStyle = new DrawingNode(source)
sourceStyle.fillColor = Color.LightBlue
sourceStyle.shape = ShapeEnum.ellipse
sourceStyle.styles.push(StyleEnum.filled)

const edge = new Edge(source, target)
const edgeStyle = new DrawingEdge(edge, true)
edgeStyle.color = Color.DarkBlue
```
