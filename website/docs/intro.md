---
sidebar_position: 1
---

# Introduction

`@msagl/core` is a JavaScript implementation of advanced graph layout algorithms. It is a port of .NET layout engine [MSAGL](https://github.com/microsoft/automatic-graph-layout). `@msagl/core` is currently under development and it comprises the following modules:

- `@msagl/core`: the core graph data structures and layout engine
- `@msagl/parser`: convert common formats to MSAGL Graph instances
- `@msagl/renderer`: a WebGL-powered rendering component

## The latest

The current version improves the handling of large graphs in two aspects.
Firstly, loading is faster than before: a [graph](https://github.com/microsoft/msagljs/blob/main/examples/data/composers.json) with 3405 nodes and 13832 edges was loaded on a Lenovo Legion 7 laptop in half a minute.
Secondly, and suprisingly, the edge quality has been improved. The edges in MSAGL are usually routed as splines avoiding the nodes. Now the edge routes in many cases are optimal.

To browse a large graph please use [the Web-GL example](https://github.com/microsoft/msagljs/blob/gh-pages/renderer-svg/index.html),
and for browsing and editing smaller graphs use [the SVG example](https://github.com/microsoft/msagljs/blob/gh-pages/renderer-svg/index.html)
