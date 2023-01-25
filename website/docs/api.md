---
sidebar_position: 4
---

# API

## Renderer with Deck.gl

Constructor:

```typescript
new Renderer(container?: HTMLDivElement)
```

To layout and render a new graph:

```typescript
renderer.setGraph(g: Graph, options: RenderOptions)
```

To change the layout of the current graph:

```typescript
renderer.setOptions(options: LayoutOptions)
```

## Usage of SVG Renderer

```typescript
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

```typescript
rendererSvg=new RendererSVG(container?: HTMLDivElement)
```

To layout and render a new graph:

```typescript
rendererSvg.setGraph(g: Graph, options: RenderOptions)
```

To change the layout of the current graph:

```typescript
rendererSvg.setOptions(options: LayoutOptions)
```

To get the SVG representation of the graph:

```typescript
getSvg(): SVGAElement
```
