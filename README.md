# msagl-js

![Test Status](https://github.com/microsoft/msagljs/workflows/Test%20Status/badge.svg?branch=master)

`msagl-js` is a JavaScript implementation of advanced graph layout algorithms. It is a port of .NET layout engine [MSAGL](https://github.com/microsoft/automatic-graph-layout). `msagl-js` is currently under development and it comprises the following modules:

- `msagl-js`: the core graph data structures and layout engine
- `@msagl/parser`: convert common formats to MSAGL Graph instances
- `@msagl/renderer`: a WebGL-powered rendering component

- [Read the documentation](https://microsoft.github.io/msagljs/)

## The latest

The current version improves the handling of large graphs in two aspects.
Firstly, loading is faster than before: a [graph](https://github.com/microsoft/msagljs/blob/main/examples/data/composers.json) with 3405 nodes and 13832 edges was loaded on a Lenovo Legion 7 laptop in half a minute.
Secondly, and suprisingly, the edge quality has been improved. The edges in MSAGL are usually routed as splines avoiding the nodes. Now the edge routes in many cases are optimal.

To browse a large graph please use [the Web-GL example](https://microsoft.github.io/msagljs/deck.gl_backend/index.html),
and for browsing and editing smaller graphs use [the SVG example](https://microsoft.github.io/msagljs/svg_backend/index.html)

## [Contributing](./CONTRIBUTING.md)

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
