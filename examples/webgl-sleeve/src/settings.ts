// Sample graphs the user can pick from the dropdown.
// Both are flat (no nested subgraphs) so they pass the example's "no subgraphs" guard.
export const SAMPLE_GRAPHS: {label: string; url: string}[] = [
  {
    label: 'Game of Thrones (407 nodes, 2 639 edges)',
    url: 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/JSONfiles/gameofthrones.json',
  },
  {
    label: 'Composers (3 405 nodes, 13 832 edges)',
    url: 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/JSONfiles/composers.json',
  },
]

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
