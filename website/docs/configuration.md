---
sidebar_position: 3
---

# Configuration of the renderers

The renderer options accept the following fields:

- `layoutType: 'default' | 'Sugiyama LR' | 'Sugiyama TB' | 'Sugiyama BT' | 'Sugiyama RL' | 'IPSepCola' | 'MDS'`
  This option defins the algorithm used to layout the graph.
  When the 'default' option is usde and all the edges in the graph are undirected, IPSepCola algorithm is used; otherwise, the graph is laid out with the Sugiyama Scheme.

  "Sugiyama TB": creates a layered top-to-bottom illustrated below.
  ![dark](/images/showAPI_dark.svg#gh-dark-mode-only)
  ![light](/images/showAPI.svg#gh-light-mode-only)

[IPSepCola](https://www.researchgate.net/profile/Tim-Dwyer-5/publication/6715571_IPSep-CoLa_An_Incremental_Procedure_for_Separation_Constraint_Layout_of_Graphs/links/0fcfd5081c588735c8000000/IPSep-CoLa-An-Incremental-Procedure-for-Separation-Constraint-Layout-of-Graphs.pdf) An Incremental Procedure for Separation Constraint Layout of Graphs: illustrated below.

![dark](/images/awilliams_blackbg.svg#gh-dark-mode-only)
![light](/images/awilliams_whitebg.svg#gh-light-mode-only).

[MDS](https://pubsys.mmsp-kn.de/pubsys/publishedFiles/BrPi06.pdf): Pivot Multidemensional Scaling:

![Alt text](/images/mdsShowAPI.svg#gh-light-mode-only)
![Alt text](/images/mdsShowAPI_dark.svg#gh-dark-mode-only)

```

- `label`
  - `fontFamily: string` - CSS font-family value. Default `'sans-serif'`.
  - `fontSize: number` - Font size, default `16`.
  - `lineHeight: number` - Line height relative to the font size, default `1`.
  - `fontStyle: string` - CSS font-style value, default `'normal'`
  - `fontWeight: string | number` - CSS font-weight value, default `'normal'`.
- `edgeRoutingMode: EdgeRoutingMode` - Enum for supported routing modes, including `Spline`, `SplineBundling` `StraightLine`, `SugiyamaSplines`, `Rectilinear`, `RectilinearToCenter`, `None`. Default varies by `layoutType`.

## Layout Editing

There are some layout editing capabilities that are demonstrated by the video below:


[![video](./docs/video.png)](https://youtu.be/j-zsysohSU0)
They include:

- dragging of the entities; one can select and drag a group of entities as well
- deletion of the entities
- node insertion
- edge insertion
- editing the node label
- edge curve editing
- undo/redo

  The current limitations are:

- the edge routing switches to straight lines when dragging
- undo/redo does not work for node label text editing
- the node does not resize for the new label text
- only [the viewer with SVG](https://microsoft.github.io/msagljs/svg_backend/index.html) supports editing.
```
