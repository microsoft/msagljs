---
sidebar_position: 1
---

# Introduction

MSAGL-JS[https://github.com/microsoft/msagljs] is a JavaScript implementation of several graph layout algorithms together with viewer and editor components. In most parts is a port of .NET layout engine [MSAGL](https://github.com/microsoft/automatic-graph-layout). MSAGL-JS is currently under development and it comprises the following modules:

- `@msagl/core`: the core graph data structures and layout engine
- `@msagl/parser`: convert common formats to MSAGL Graph instances
- `@msagl/renderer-webgl`: a WebGL-powered rendering component
- `@msagl/renderer-svg`: an SVG-powered rendering component

To browse a large graph please use [Web-GL renderer example](https://microsoft.github.io/msagljs/renderer-webgl/index.html),
and to browse and to edit a smaller graph use [SVG-renderer example](https://microsoft.github.io/msagljs/renderer-svg/index.html)
