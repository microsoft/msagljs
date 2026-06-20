---
sidebar_position: 5
---

# Demos and paper

The large-graph browsing experience in MSAGL-JS combines a **tile pyramid** for
semantic zoom (so the labels of the highest-ranked nodes stay readable at every
zoom level, just like major features on an online map) with **sleeve routing** for
the edges. The method is described in the paper below, and you can try it live in
the two WebGL demos.

## The paper

- 📄 [**Browsing Large Graphs with Tile Pyramids and Sleeve Routing in the Browser**](https://arxiv.org/abs/2605.17498)
  — Lev Nachmanson and Xiaoji Chen, arXiv:2605.17498.
  Introduces *sleeve routing*, which searches the dual graph of a Constrained
  Delaunay Triangulation to pick a sequence of triangles through the free space and
  then applies the funnel algorithm to compute a shortest path inside the selected
  sleeve. See the ["Sleeve" routing mode](./api.md) for a short description.

## The demos

- 🗺️ [**WebGL sleeve-routing demo**](https://microsoft.github.io/msagljs/webgl-sleeve/index.html)
  — browse the built-in sample graphs (up to 32,768 nodes and 236,978 edges) laid out and
  routed with sleeve routing entirely in the browser. Drag to pan, scroll to zoom,
  drop in your own graph, and switch layouts from the settings panel. The bundled samples are:

  | Sample | Nodes | Edges |
  | --- | ---: | ---: |
  | [Game of Thrones](https://microsoft.github.io/msagljs/webgl-sleeve/index.html?graph=gameofthrones.json) | 407 | 2,639 |
  | [Composers](https://microsoft.github.io/msagljs/webgl-sleeve/index.html?graph=composers.json) | 3,405 | 13,832 |
  | [ca-GrQc](https://microsoft.github.io/msagljs/webgl-sleeve/index.html?graph=ca-GrQc.txt.gz) | 5,242 | 28,968 |
  | [Facebook combined](https://microsoft.github.io/msagljs/webgl-sleeve/index.html?graph=facebook_combined.txt.gz) | 4,039 | 88,234 |
  | [ca-HepTh](https://microsoft.github.io/msagljs/webgl-sleeve/index.html?graph=ca-HepTh.txt.gz) | 9,877 | 51,946 |
  | [delaunay_n15](https://microsoft.github.io/msagljs/webgl-sleeve/index.html?graph=delaunay_n15.mtx.gz) | 32,768 | 98,274 |
  | [ca-HepPh](https://microsoft.github.io/msagljs/webgl-sleeve/index.html?graph=ca-HepPh.txt.gz) | 12,008 | 236,978 |
  | [ca-CondMat](https://microsoft.github.io/msagljs/webgl-sleeve/index.html?graph=ca-CondMat.txt.gz) | 23,133 | 186,878 |
  | [Deezer Europe](https://microsoft.github.io/msagljs/webgl-sleeve/index.html?graph=deezer_europe_edges.csv.gz) | 28,281 | 92,752 |

- 🔍 [**Citation-graph demo**](https://microsoft.github.io/msagljs/citation-graph/index.html)
  — a RiSE-seeded citation graph (~2.8k papers / ~10k citations). Each node shows a
  short label; **hovering a node** shows a rich citation tooltip with the full title,
  authors, venue, year and citation count. Use the top-bar search to find papers by
  author or title.
