# Layout and edge routing

## Renderer layout types

`LayoutOptions.layoutType` accepts exactly:

- `'Sugiyama LR'`
- `'Sugiyama TB'`
- `'Sugiyama BT'`
- `'Sugiyama RL'`
- `'IPsepCola'`
- `'MDS'`

Omit the property for automatic selection. Do not pass `'default'`.

| Graph or goal | Layout |
| --- | --- |
| Directed dependency, call, state, or workflow graph | Sugiyama |
| Wide labels or left-to-right flow | Sugiyama LR |
| Conventional hierarchy | Sugiyama TB |
| Undirected topology where global distance matters | MDS |
| Interactive or force-style layout with overlap handling | IPSepCola |

## Routing modes

Import `EdgeRoutingMode` from `@msagl/core`.

| Mode | Use |
| --- | --- |
| `Spline` | General obstacle-avoiding smooth routes |
| `SplineBundling` | Metro-style bundles; slower |
| `StraightLine` | Fastest option and a useful large-graph fallback |
| `SugiyamaSplines` | Layered-layout routing through intermediate layers |
| `Rectilinear` | Orthogonal routes around obstacles; can be expensive |
| `None` | Node positions only or custom routing later |

Example:

```ts
import {EdgeRoutingMode} from '@msagl/core'

renderer.setGraph(graph, {
  layoutType: 'Sugiyama LR',
  edgeRoutingMode: EdgeRoutingMode.Spline,
})
```

## Performance rules

- Do not select bundling or rectilinear routing by default for a large graph.
- Use straight lines when responsiveness matters more than obstacle avoidance.
- Prefer the WebGL renderer for large interactive graphs.
- Use `None` when only node positions are required.
- Do not select `RectilinearToCenter` until the layout driver routes that mode
  distinctly; current packages fall back to spline routing.
- Sleeve routing exists on the repository's development branch but is not
  exposed by the npm `@msagl/core` version locked by the portable exporter.
  Check the installed package before using it in application code.
- For static figures, simplify, filter, or aggregate a graph that is too dense
  to remain readable on the target page.
