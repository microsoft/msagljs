# Static document export

MSAGL-JS does not expose a native PDF or PostScript writer. Use SVG as the
canonical vector intermediate, then convert it when needed.

## Choose an output

| Output | Use |
| --- | --- |
| SVG | Browser use, editing, or the canonical vector source |
| PDF | pdfLaTeX, LuaLaTeX, XeLaTeX, papers, and presentations |
| EPS | Legacy `latex -> dvi -> dvips` toolchains |
| PostScript | Only when explicitly required |
| PNG | Raster output or a vector file that would be impractically large |

## Export helper

From the installed skill directory:

```bash
npm ci --prefix scripts
node scripts/render-network.mjs INPUT OUTPUT [options]
```

Examples:

```bash
node scripts/render-network.mjs graphs/architecture.dot figures/architecture.svg

node scripts/render-network.mjs graphs/architecture.dot figures/architecture.pdf \
  --layout sugiyama-lr \
  --routing spline \
  --margin 18

node scripts/render-network.mjs data/network.json figures/network.png \
  --layout mds \
  --background transparent

node scripts/render-network.mjs graphs/legacy.gv figures/legacy.eps
```

Supported options:

- `--input-format dot|json|jgf|txt`
- `--layout default|sugiyama-lr|sugiyama-tb|sugiyama-bt|sugiyama-rl|mds|ipsepcola`
- `--routing default|spline|bundling|straight|sugiyama|rectilinear|none`
- `--margin NUMBER`
- `--background COLOR|transparent`
- `--font-family NAME`
- `--font-size NUMBER`

The helper uses a real headless browser because `RendererSvg` depends on DOM and
canvas text measurement. EPS and PostScript conversion requires `gs`
(Ghostscript). On Windows the helper also checks `gswin64c.exe` and
`gswin32c.exe`; set `GHOSTSCRIPT` to an explicit executable path when needed.
If Ghostscript is missing, retain the generated SVG or PDF and report the
missing dependency instead of silently rasterizing.

## TeX integration

For modern TeX engines:

```tex
\usepackage{graphicx}

\begin{figure}
  \centering
  \includegraphics[width=\linewidth]{figures/network.pdf}
  \caption{Network layout generated with MSAGL-JS.}
  \label{fig:network}
\end{figure}
```

Keep the DOT/JSON source and the generation command near the document. Prefer a
landscape figure or simplify the graph when its aspect ratio or density makes
labels unreadable.

Use stable installed fonts and wait for browser fonts before rendering. Check
the final PDF or EPS for font substitution, clipping, and page bounds.
