# Chrome routing & loading benchmarks

Browser-side benchmarks used to produce the routing-mode and loading
tables in the GD~2026 paper. Loads the unmodified browser bundle of
`@msagl/core` into a page, drives a static graph corpus, and POSTs
per-graph results back to a tiny local server so a long run can be
monitored from the filesystem while the page main thread is busy.

## Layout

* `server.js` — static HTTP+POST server (port 8765). Serves files from
  this directory plus `/graphs/*` from `paper_msagljs/graphs/`. Accepts
  `POST /log` (routing-modes) and `POST /loadlog` (loading) and appends
  the JSON body, with a UTC timestamp, to `/tmp/chrome_bench_results.log`
  and `/tmp/chrome_load_results.log` respectively.
* `index.html` + `bench.js` — routing-modes benchmark
  (A* / Dijkstra-tree / Dijkstra+VC).
* `loading.html` + `loading.js` — full loading benchmark
  (parse + MDS layout with the sleeve router + tile pyramid build).
* `msagl.min.js` — copy of `modules/core/dist.min.js`. Not tracked;
  copy after `npm run build` in `modules/core/`.

## Usage

```bash
# 1. (Re-)build the browser bundle and copy it next to the bench files.
( cd modules/core && npm run build )
cp modules/core/dist.min.js examples/chrome-routing-bench/msagl.min.js

# 2. Start the local server.
node examples/chrome-routing-bench/server.js

# 3. Open one of the benchmark pages in Chrome.
#    Routing modes: http://127.0.0.1:8765/
#    Loading:       http://127.0.0.1:8765/loading.html
#
#    Optional ?graphs=<comma list> to restrict the corpus.

# 4. Tail the results.
tail -f /tmp/chrome_bench_results.log /tmp/chrome_load_results.log
```

The graph corpus is read from `paper_msagljs/graphs/` (sibling
checkout). Adjust `GRAPHS_DIR` in `server.js` if your layout differs.
