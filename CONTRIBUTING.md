# Contributing

## Examples

Renderings graphs with Deck.gl and with SVG can be seen at https://microsoft.github.io/msagljs/.

In addition to the initially loaded graph, the page offers a list of
graph samples and the option of loading a DOT or JSON graph from the
local disk: You can view a DOT graph by drag-dropping its file into the
folder icon at the left-upper corner of the page.

To run examples locally, execute in the terminal command "npm run start" in the directory "examples/svg-renderer" or
"examples/webgl-renderer". You will see a printout in a form
"Local: http://127.0.0.1:8000/". Clicking on it, or just typing it as the address in an Internet browser, should pop up a tab in your
default Internet browser with the example running.

## Build and test

If you would like to build and run the tests of MSAGL-JS please follow the following guide lines. You can use codespaces.

These instructions are for Ubuntu, however, if your operation system is Windows, you can install WSL and still use Ubuntu:
see https://learn.microsoft.com/en-us/windows/wsl/install.

- Install Node.JS 18+
- Install "nvm" as you may need to update the "node" version and set node 18

```bash
nvm install 18
nvm use 18
```

To build, run

```bash
yarn build
```

To run tests,

```bash
yarn test
```

To edit the docs, start the dev server and update the markdown
in `website/docs`.

```bash
yarn docs
```

To build the docs,

```bash
yarn build:docs
```
