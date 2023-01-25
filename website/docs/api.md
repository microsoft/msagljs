---
sidebar_position: 4
---

# API

## Renderer with Deck.gl

Constructor:

```ts
new Renderer(container?: HTMLDivElement)
```

To layout and render a new graph:

```ts
renderer.setGraph(g: Graph, options: RenderOptions)
```

To change the layout of the current graph:

```ts
renderer.setOptions(options: LayoutOptions)
```

## Usage of SVG Renderer

```ts build
import {parseDot} from '@msagl/parser'
import {RendererSvg} from '@msagl/renderer'

const renderer = new RendererSvg()
const graph = parseDot(`
graph G {
	kspacey -- swilliams;
	swilliams -- kbacon;
	bpitt -- kbacon;
	hford -- lwilson;
	lwilson -- kbacon;
}`)
```

## Renderer with SVG API

Constructor:

```ts
rendererSvg=new RendererSVG(container?: HTMLDivElement)
```

To layout and render a new graph:

```ts
rendererSvg.setGraph(g: Graph, options: RenderOptions)
```

To change the layout of the current graph:

```ts
rendererSvg.setOptions(options: LayoutOptions)
```

To get the SVG representation of the graph:

```ts
getSvg(): SVGAElement
```
