# msagl-js

![Test Status](https://github.com/microsoft/msagljs/workflows/Test%20Status/badge.svg?branch=master)

`msagl-js` is a JavaScript implementation of advanced graph layout algorithms. It is a port of .NET layout engine [MSAGL](https://github.com/microsoft/automatic-graph-layout). `msagl-js` is currently under development and it comprises the following modules:

- `msagl-js`: the core graph data structures and layout engine
- `@msagl/parser`: convert common formats to MSAGL Graph instances
- `@msagl/renderer`: a WebGL-powered rendering component

## Installation

Using NPM packages:

```bash
npm i msagl-js @msagl/parser @msagl/renderer
```

```js
import {Graph} from 'msagl-js'
import {Renderer} from '@msagl-js/renderer'
```

Using script tags:

```html
<script src="https://unpkg.com/msagl-js@latest/dist.min.js"></script>
<script src="https://unpkg.com/@msagl/parser@latest/dist.min.js"></script>
<script src="https://unpkg.com/@msagl/renderer@latest/dist.min.js"></script>
```

```js
const {Graph, Renderer} = msagl
```

## Usage

Render a graph from a [DOT](<https://en.wikipedia.org/wiki/DOT_(graph_description_language)#:~:text=DOT%20is%20a%20graph%20description,programs%20can%20process%20DOT%20files.>) file:

```js
import {parseDot} from '@msagl-js/parser'
import {Renderer} from '@msagl-js/renderer'

const renderer = new msagl.Renderer()
const graph = parseDot(`
graph G {
	kspacey -- swilliams;
	swilliams -- kbacon;
	bpitt -- kbacon;
	hford -- lwilson;
	lwilson -- kbacon;
}`)
renderer.setGraph(graph)
```

Render a graph from JSON:

```js
import {parseJSON} from '@msagl-js/parser'

const graph = parseJSON({
  nodes: [{id: 'kspacey'}, {id: 'swilliams'}, {id: 'kbacon'}, {id: 'bpitt'}, {id: 'hford'}, {id: 'lwilson'}],
  edges: [
    {source: 'kspacey', target: 'swilliams'},
    {source: 'swilliams', target: 'kbacon'},
    {source: 'bpitt', target: 'kbacon'},
    {source: 'hford', target: 'lwilson'},
    {source: 'lwilson', target: 'kbacon'},
  ],
})
renderer.setGraph(graph)
```

## Renderer with Deck.gl API

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

The renderer options accept the following fields:

- `layoutType: 'Sugiyama LR' | 'Sugiyama TB' | 'Sugiyama BT' | 'Sugiyama RL' | 'MDS'` - algorithm used to layout the graph. By default, if all edges in the graph are undirected then Pivot MDS is used; otherwise, it applies the Sugiyama Scheme.

  [Sugiyama](https://en.wikipedia.org/wiki/Layered_graph_drawing) TB (layered top-to-bottom):

  ![Alt text](./docs/images/showAPI.svg#gh-light-mode-only)
  ![Alt text](./docs/images/showAPI_dark.svg#gh-dark-mode-only)

  [MDS](https://pubsys.mmsp-kn.de/pubsys/publishedFiles/BrPi06.pdf)
  (Multidemensional Scaling or Pivot MDS):

  ![Alt text](./docs/images/mdsShowAPI.svg#gh-light-mode-only)
  ![Alt text](./docs/images/mdsShowAPI_dark.svg#gh-dark-mode-only)

- `label`
  - `fontFamily: string` - CSS font-family value. Default `'sans-serif'`.
  - `fontSize: number` - Font size, default `16`.
  - `lineHeight: number` - Line height relative to the font size, default `1`.
  - `fontStyle: string` - CSS font-style value, default `'normal'`
  - `fontWeight: string | number` - CSS font-weight value, default `'normal'`.
- `edgeRoutingMode: EdgeRoutingMode` - Enum for supported routing modes, including `Spline`, `SplineBundling` `StraightLine`, `SugiyamaSplines`, `Rectilinear`, `RectilinearToCenter`, `None`. Default varies by `layoutType`.

## Examples

Renderings graphs with Deck.gl and with SVG can be seen at https://microsoft.github.io/msagljs/.

In addition to the initially loaded graph, the page offers a list of
graph samples and the option of loading a DOT or JSON graph from the
local disk: You can view a DOT graph by drag-dropping its file into the
folder icon at the left-upper corner of the page.

To run examples locally, execute in the terminal command "npm run start" in the directory "examples/svg-renderer" or
"examples/webgl-renderer". You will see a printout in a form
"Local: http://127.0.0.1:8000/". Clicking on it should pop up a tab in your
default Interned browser with the example running.

## Build and test

If you would like to build and run the tests of MSAGL-JS please follow the following guide lines.

These instructions are for Ubuntu, however, if your operation system is Windows, you can install WSL and still use Ubuntu:
see https://learn.microsoft.com/en-us/windows/wsl/install.

Install "node" with "npm".

Install "nvm" as you may need to update the "node" version.

Install "yarn".

Clone the repo directory: git clone https://github.com/microsoft/msagljs.git jagl.

Change directory to jagl, or wherever you cloned msagljs.

Run "yarn". You might get an error message that the node version is incorrect.

To mediate this run : nvm install 16.17.0, or other required version: you can check the available versions 
by issuing the "nvm ls-remote" instruction.

To build, run "npm run build".

To run tests, run "npm run test".

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
