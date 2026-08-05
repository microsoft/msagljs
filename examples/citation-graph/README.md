# Citation-graph presentation viewer (WebGL)

An interactive [MSAGL-JS](https://github.com/microsoft/msagljs) **WebGL** viewer for
the RiSE-seeded citation graph in [`rise_3k.json`](./rise_3k.json) (~2.8k papers /
~10k citations, including Shuo Chen's disambiguated works).

Each node shows a **short label** (the first word or two of the paper title) so the
graph stays legible; **hovering a node** shows a rich tooltip with the **full title,
authors, venue, year and citation count**. Papers authored by **Shuo Chen** are drawn
in amber, everything else in blue.

## Search

A single search box sits in the top bar, with a mode selector:

- **Author** (default) — type an author name; matches are shown with each author's
  paper count. Acting on a match **highlights all of that author's papers** at once
  and zooms in on their **most-cited paper**.
- **Title** — type words from a paper title; acting on a match zooms to that paper.

**Cycling through matches:** press **Enter** (or **↓**) to act on the first match;
pressing Enter again on the *same query* advances to the next match, looping back to
the start at the end. **↑** steps backwards (and wraps). You can also click a
suggestion directly. Switching the Author/Title mode clears the query.

## Run it

```bash
cd examples/citation-graph
npm start          # esbuild bundles src/ and serves on http://127.0.0.1:8000
```

Then open the printed `http://127.0.0.1:8000/` (or `/index.html`) in a WebGL-capable
browser. Drag to pan, scroll to zoom, use the top-bar search to find a node (by
author or title), and hover any node for its full citation.

### Choosing the graph

By default the viewer loads the RiSE-seeded graph (`rise_3k.json`, ~2.8k papers /
~10k citations). Append a `?graph=` query param to load a different sibling JSON
file:

```
http://127.0.0.1:8000/?graph=rise_3k.json
```

`rise_3k.json` is produced by `make_large_subgraph.py` in the `ppx` repo: every
connected RiSE-group seed paper plus its highest-degree citation neighbours. It
takes a few seconds to lay out (MDS) on load.

## How it works

`src/app.ts`:

1. `fetch('./rise_3k.json')` — the citation subgraph.
2. Converts it to MSAGL's SimpleJSON format, using `shortLabel()` for the on-node text
   and `cited_by_count` as the node weight (size).
3. `parseJSON(...)` → graph, then `renderer.setGraph(graph, {layoutType: 'MDS'})`.
4. Builds an `id → rich-HTML` map and registers it via
   `renderer.setTooltipProvider(...)` — the hook that lets the tooltip show different
   (richer) content than the short on-node label.

`setTooltipProvider` is part of `@msagl/renderer-webgl`: it takes a callback
`(entity, object) => string | null`; return HTML to show, or `null` to fall back to
the renderer's default label tooltip.

## Swap in your own graph

Replace `rise_3k.json` (same node fields: `id`, `title`, `authors[].name`, `year`,
`venue`, `cited_by_count`) — or adjust `shortLabel()` / `tooltipHtml()` in `src/app.ts`.
