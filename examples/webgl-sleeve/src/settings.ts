// Sample graphs the user can pick from the dropdown.
// All are flat (no nested subgraphs) so they pass the example's "no subgraphs" guard.
// URLs are relative so the demo runs entirely from its own deployment with no
// cross-origin dependency (the parser auto-gunzips `.gz` files via DecompressionStream).
//
// `etaSec` is a rough end-to-end (layout + sleeve routing + tile pyramid) estimate
// based on Node.js benchmarks on a modern laptop; the browser is typically 1.5-2x
// slower, so it is multiplied by 1.5 for the on-screen warning.
export const SAMPLE_GRAPHS: {label: string; url: string; etaSec: number}[] = [
  {
    label: 'Game of Thrones (407 nodes, 2 639 edges)',
    url: './graphs/gameofthrones.json',
    etaSec: 2,
  },
  {
    label: 'Composers (3 405 nodes, 13 832 edges)',
    url: './graphs/composers.json',
    etaSec: 7,
  },
  {
    label: 'ca-GrQc (5 242 nodes, 28 968 edges)',
    url: './graphs/ca-GrQc.txt.gz',
    etaSec: 8,
  },
  {
    label: 'Facebook combined (4 039 nodes, 88 234 edges)',
    url: './graphs/facebook_combined.txt.gz',
    etaSec: 20,
  },
  {
    label: 'ca-HepTh (9 877 nodes, 51 946 edges)',
    url: './graphs/ca-HepTh.txt.gz',
    etaSec: 40,
  },
  {
    label: 'delaunay_n15 (32 768 nodes, 98 274 edges)',
    url: './graphs/delaunay_n15.mtx.gz',
    etaSec: 70,
  },
  {
    label: 'ca-HepPh (12 008 nodes, 236 978 edges)',
    url: './graphs/ca-HepPh.txt.gz',
    etaSec: 120,
  },
  {
    label: 'ca-CondMat (23 133 nodes, 186 878 edges)',
    url: './graphs/ca-CondMat.txt.gz',
    etaSec: 280,
  },
  {
    label: 'Deezer Europe (28 281 nodes, 92 752 edges)',
    url: './graphs/deezer_europe_edges.csv.gz',
    etaSec: 490,
  },
]

// Graphs whose end-to-end load is expected to exceed this many seconds in the
// browser trigger a confirm() prompt so users do not block on multi-minute
// pipelines unintentionally.
export const SLOW_GRAPH_ETA_SEC = 30

// IPsepCola is listed first so it becomes the dropdown's default selection,
// since msagl's auto-picker would otherwise apply Sugiyama on small graphs
// (e.g. Game of Thrones, 407 nodes), which is not what this example demonstrates.
export const LAYOUT: {[value: string]: string} = {
  ipsepCola: 'IPSepCola',
  mds: 'Pivot MDS',
  tb: 'Layered Top-Bottom',
  lr: 'Layered Left-Right',
  bt: 'Layered Bottom-Top',
  rl: 'Layered Right-Left',
} as const

// Layouts in the Sugiyama family. These do not scale to thousands of nodes,
// so the example refuses to apply them when the loaded graph exceeds
// LARGE_GRAPH_NODE_THRESHOLD.
export const SUGIYAMA_LAYOUTS = new Set<string>(['tb', 'lr', 'bt', 'rl'])

// Above this node count the Sugiyama-family layouts are blocked.
// Game of Thrones (407 nodes) stays under the threshold;
// composers (3 405 nodes) is over it.
export const LARGE_GRAPH_NODE_THRESHOLD = 1500

export function isSugiyamaLayout(value: string): boolean {
  return SUGIYAMA_LAYOUTS.has(value)
}
