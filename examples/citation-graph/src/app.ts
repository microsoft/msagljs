import {Renderer as WebGLRenderer, TooltipProvider} from '@msagl/renderer-webgl'
import {parseJSON} from '@msagl/parser'
import {Node} from '@msagl/core'
import {LayoutOptions} from '@msagl/renderer-common'

// ---------------------------------------------------------------------------
// Data shapes coming from rise_3k.json (the citation subgraph).
// ---------------------------------------------------------------------------
type Author = {id?: string; name: string}
type SsgNode = {
  id: string
  title: string
  year?: number
  venue?: string
  authors?: Author[]
  cited_by_count?: number
  is_seed?: boolean
}
type SsgEdge = {source: string; target: string}
type Ssg = {nodes: SsgNode[]; edges: SsgEdge[]}

const HIGHLIGHT_AUTHOR = 'Shuo Chen' // the presentation's focus author
const SEED_COLOR = '#d98c00' // amber for the focus author's papers
const NODE_COLOR = '#2b6cb0' // blue for everything else

// ---------------------------------------------------------------------------
// Short on-node label: first word, or first two words when the first is short.
// A trailing ellipsis signals that the full title is longer (see the tooltip).
// ---------------------------------------------------------------------------
function shortLabel(title: string): string {
  const words = (title || '').trim().split(/\s+/)
  let label = words[0] || ''
  if (words.length > 1 && label.length <= 6) label += ' ' + words[1]
  if (label.length > 20) label = label.slice(0, 19) + '\u2026'
  const usedWords = label.includes(' ') ? 2 : 1
  if (words.length > usedWords && !label.endsWith('\u2026')) label += '\u2026'
  return label
}

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

// Rich HTML shown on hover: full title, authors, venue/year/citation count.
function tooltipHtml(n: SsgNode): string {
  const authors = (n.authors || []).map((a) => a.name)
  const authorLine =
    authors.length === 0
      ? ''
      : `<div style="opacity:.9;margin-top:3px">${escapeHtml(authors.join(', '))}</div>`
  const meta: string[] = []
  if (n.venue) meta.push(escapeHtml(n.venue))
  if (n.year != null) meta.push(String(n.year))
  if (n.cited_by_count != null) meta.push(`${n.cited_by_count} citations`)
  const metaLine = meta.length ? `<div style="opacity:.65;margin-top:3px">${meta.join(' \u00b7 ')}</div>` : ''
  return (
    `<div style="max-width:360px;white-space:normal;line-height:1.35">` +
    `<div style="font-weight:600">${escapeHtml(n.title)}</div>` +
    authorLine +
    metaLine +
    `</div>`
  )
}

function isFocusPaper(n: SsgNode): boolean {
  return (n.authors || []).some((a) => a.name === HIGHLIGHT_AUTHOR)
}

const viewer = document.getElementById('viewer') as HTMLDivElement
viewer.setAttribute('style', 'touch-action: none;')
const renderer = new WebGLRenderer(viewer, './worker.js')

function showError(msg: string) {
  const banner = document.getElementById('error-banner')
  if (!banner) return
  banner.textContent = msg
  banner.style.display = 'block'
}

;(async () => {
  try {
    // Which graph file to load. Defaults to rise_3k.json; pass ?graph=<file>
    // to load a different sibling JSON graph.
    const params = new URLSearchParams(window.location.search)
    const graphFile = params.get('graph') || 'rise_3k.json'
    const resp = await fetch('./' + graphFile)
    if (!resp.ok) throw new Error(`HTTP ${resp.status} loading ${graphFile}`)
    const ssg = (await resp.json()) as Ssg

    // id -> rich tooltip HTML, used by the tooltip provider below.
    const tooltipById = new Map<string, string>()
    for (const n of ssg.nodes) tooltipById.set(n.id, tooltipHtml(n))

    // Convert to the renderer's SimpleJSON format with SHORT labels.
    const simple = {
      nodes: ssg.nodes.map((n) => ({
        id: n.id,
        label: shortLabel(n.title),
        weight: n.cited_by_count ?? 1,
        color: isFocusPaper(n) ? SEED_COLOR : NODE_COLOR,
      })),
      edges: ssg.edges.map((e) => ({
        source: e.source,
        target: e.target,
        directed: true,
        arrowhead: 'normal' as const,
      })),
    }

    const graph = parseJSON(simple)
    const options: LayoutOptions = {layoutType: 'MDS'}
    await renderer.setGraph(graph, options)

    // Short label on the node, full title + authors in the tooltip.
    const provider: TooltipProvider = (entity) => {
      if (entity instanceof Node) return tooltipById.get(entity.id) ?? null
      return null
    }
    renderer.setTooltipProvider(provider)

    // Build search data: author → their papers, plus a per-paper rank
    // (citation count) used both to pick an author's headline paper and to
    // order title matches.
    const papersByAuthor = new Map<string, string[]>()
    for (const n of ssg.nodes) {
      for (const a of n.authors || []) {
        const list = papersByAuthor.get(a.name) || []
        list.push(n.id)
        papersByAuthor.set(a.name, list)
      }
    }
    const rank = new Map<string, number>()
    for (const n of ssg.nodes) rank.set(n.id, n.cited_by_count ?? 0)
    setupSearch(ssg.nodes, papersByAuthor, rank)

    const nameEl = document.getElementById('graph-name')
    if (nameEl) nameEl.textContent = `Citation subgraph — ${ssg.nodes.length} papers, ${ssg.edges.length} citations`
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Failed to load citation graph:', e)
    showError(`Failed to load citation graph: ${msg}`)
  }
})()

// ---------------------------------------------------------------------------
// Unified search box. A mode selector chooses the field to search:
//   * "Author" (default) — match author names. Acting on a match (Enter / click)
//     highlights ALL of that author's papers and zooms to their most-cited one.
//     Each subsequent Enter (or ↓ / ↑) walks that SAME author's papers in rank
//     order — next-cited, then next, looping back to the top — so a repeated
//     Enter browses one person's body of work rather than hopping to a different
//     author. The suggestion box switches to list the author's papers while
//     browsing. Editing the query (or picking another author) restarts the walk.
//   * "Title"  — match paper titles; pressing Enter (or ↓ / ↑) repeatedly on an
//     UNCHANGED query cycles through every matching title, zooming to each in
//     turn and looping back to the start.
// ---------------------------------------------------------------------------
type SearchItem = {label: string; folded: string; count: number; paperIds: string[]; zoomId: string}

// Fold diacritics so "Bjorner" matches "Bjørner", "Florencio" matches "Florêncio", etc.
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[øœ]/g, 'o')
    .replace(/[æ]/g, 'a')
    .replace(/[ł]/g, 'l')
    .replace(/[ð]/g, 'd')
}

function setupSearch(nodes: SsgNode[], papersByAuthor: Map<string, string[]>, rank: Map<string, number>) {
  const modeSel = document.getElementById('search-mode') as HTMLSelectElement | null
  const input = document.getElementById('search-input') as HTMLInputElement | null
  const box = document.getElementById('search-suggestions') as HTMLDivElement | null
  // Inline pill on the same row as the search box. While walking an author's
  // papers it shows the current paper (position + title + citations) instead of
  // a dropdown that would cover the drawing; clicking it advances to the next.
  const indicator = document.getElementById('paper-indicator') as HTMLSpanElement | null
  if (!modeSel || !input || !box || !indicator) return

  // Author items: one per author. Their papers are ordered by rank (most-cited
  // first), so paperIds[0] is the headline paper and stepping walks down the
  // ranking. zoomId tracks the headline for the initial landing.
  const authorItems: SearchItem[] = [...papersByAuthor.entries()]
    .map(([name, ids]) => {
      const ranked = [...ids].sort((a, b) => (rank.get(b) ?? 0) - (rank.get(a) ?? 0))
      return {label: name, folded: fold(name), count: ranked.length, paperIds: ranked, zoomId: ranked[0]}
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  // Title items: one per paper, ordered by citation count.
  const titleItems: SearchItem[] = nodes
    .map((n) => ({
      label: n.title || n.id,
      folded: fold(n.title || ''),
      count: n.cited_by_count ?? 0,
      paperIds: [n.id],
      zoomId: n.id,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  let matches: SearchItem[] = []
  let cycleIndex = -1
  let actedQuery: string | null = null
  // Author "paper-browsing" sub-state. When set (author mode only), the
  // suggestion box lists this author's papers and stepping walks paperIndex
  // through them in rank order. null = listing matches (authors or titles).
  let paperAuthor: SearchItem | null = null
  let paperIndex = 0
  const MAX_SHOWN = 30

  // id -> {title, citation count} for rendering an author's paper list.
  const meta = new Map<string, {title: string; count: number}>()
  for (const n of nodes) meta.set(n.id, {title: n.title || n.id, count: n.cited_by_count ?? 0})

  const source = () => (modeSel.value === 'title' ? titleItems : authorItems)

  function render() {
    if (paperAuthor) {
      renderPapers()
      return
    }
    indicator.style.display = 'none'
    if (matches.length === 0) {
      box.style.display = 'none'
      return
    }
    box.innerHTML = matches
      .map(
        (it, i) =>
          `<div class="opt${i === cycleIndex ? ' focus' : ''}" data-i="${i}">` +
          `<span class="lbl">${escapeHtml(it.label)}</span>` +
          `<span class="count">${it.count}</span></div>`,
      )
      .join('')
    box.style.display = 'block'
    const focused = box.querySelector('.opt.focus') as HTMLElement | null
    if (focused) focused.scrollIntoView({block: 'nearest'})
  }

  // Show the current paper inline on the search row (no dropdown), so browsing
  // an author's long list never covers the drawing. Enter / ↓ / ↑ — or a click
  // on the pill — move through the ranking, wrapping around.
  function renderPapers() {
    if (!paperAuthor) return
    const n = paperAuthor.paperIds.length
    const id = paperAuthor.paperIds[paperIndex]
    const m = meta.get(id)
    indicator.innerHTML =
      `<span class="pi-pos">${paperIndex + 1}/${n}</span>` +
      `<span class="pi-title">${escapeHtml(m?.title ?? id)}</span>` +
      `<span class="pi-count">${m?.count ?? 0}</span>`
    indicator.style.display = 'inline-flex'
    box.style.display = 'none'
  }

  function filter(q: string) {
    const kw = fold(q.trim())
    const src = source()
    if (!kw) {
      matches = src.slice(0, MAX_SHOWN)
    } else {
      const starts: SearchItem[] = []
      const has: SearchItem[] = []
      for (const it of src) {
        const i = it.folded.indexOf(kw)
        if (i === 0) starts.push(it)
        else if (i > 0) has.push(it)
      }
      matches = starts.concat(has).slice(0, MAX_SHOWN)
    }
    cycleIndex = -1
    actedQuery = null
    paperAuthor = null // editing the query leaves paper-browsing
    paperIndex = 0
    render()
  }

  // Begin walking an author's papers from the top of their ranking.
  function startPaperBrowse(author: SearchItem, fromEnd: boolean) {
    paperAuthor = author
    paperIndex = fromEnd ? author.paperIds.length - 1 : 0
    actedQuery = input.value
  }

  function act() {
    if (paperAuthor) {
      const id = paperAuthor.paperIds[paperIndex]
      if (id == null) return
      render() // shows the inline pill, hides the dropdown
      focusPapers(paperAuthor.paperIds, id)
      return
    }
    const it = matches[cycleIndex]
    if (!it) return
    render()
    box.style.display = 'block'
    focusPapers(it.paperIds, it.zoomId)
  }

  // Advance the focus. In author mode the first action commits the best (or
  // focused) author and lands on their headline paper; further actions walk
  // that author's papers by rank, wrapping around. In title mode actions cycle
  // through the matching titles. `dir` is +1 (next) or -1 (previous).
  function step(dir: number) {
    if (matches.length === 0) filter(input.value)
    if (matches.length === 0) return

    if (modeSel.value !== 'title') {
      if (!paperAuthor) {
        const idx = cycleIndex >= 0 ? cycleIndex : 0
        startPaperBrowse(matches[idx], dir < 0)
      } else {
        const n = paperAuthor.paperIds.length
        paperIndex = (paperIndex + dir + n) % n
      }
      act()
      return
    }

    const q = input.value
    if (actedQuery !== q || cycleIndex < 0) {
      cycleIndex = dir >= 0 ? 0 : matches.length - 1
      actedQuery = q
    } else {
      cycleIndex = (cycleIndex + dir + matches.length) % matches.length
    }
    act()
  }

  modeSel.addEventListener('change', () => {
    input.placeholder = modeSel.value === 'title' ? 'Search by title…' : 'Search by author…'
    renderer.highlightNodes([])
    // Keep whatever was typed — just re-run it against the new field, so an
    // accidental mode switch mid-query doesn't discard the text.
    actedQuery = null
    paperAuthor = null
    filter(input.value)
    input.focus()
  })
  input.addEventListener('focus', () => {
    // Defer the select() past the click's mouseup, which would otherwise drop
    // the selection and let the next keystroke append instead of replace.
    setTimeout(() => input.select(), 0)
    filter(input.value)
  })
  input.addEventListener('input', () => filter(input.value))
  input.addEventListener('blur', () => setTimeout(() => (box.style.display = 'none'), 200))
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      step(+1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      step(-1)
    } else if (e.key === 'Escape') {
      box.style.display = 'none'
      indicator.style.display = 'none'
      paperAuthor = null
    }
  })
  // Clicking the inline pill advances to the next paper (cyclic), mirroring Enter.
  indicator.addEventListener('mousedown', (e) => {
    e.preventDefault()
    step(+1)
  })
  box.addEventListener('mousedown', (e) => {
    const opt = (e.target as HTMLElement).closest('.opt') as HTMLElement | null
    if (!opt) return
    e.preventDefault()
    const i = Number(opt.dataset.i)
    if (Number.isNaN(i)) return
    if (paperAuthor) {
      // Clicking a paper jumps straight to it.
      paperIndex = i
    } else if (modeSel.value !== 'title') {
      // Clicking an author starts walking their papers from the headline.
      startPaperBrowse(matches[i], false)
    } else {
      cycleIndex = i
      actedQuery = input.value
    }
    act()
  })
}

// Highlight the given papers and zoom in on `zoomId`. zoomToNode descends to the
// level-of-detail tier that actually contains the node, so even a rarely cited
// paper (which only appears in the finest tiles) becomes visible and shows its
// highlight — a plain geometric fit would stop short and leave it undrawn.
function focusPapers(paperIds: string[], zoomId: string) {
  const graph = renderer.graph
  if (!graph) return

  const present = paperIds.filter((id) => graph.findNodeRecursive(id))
  renderer.highlightNodes(present)

  renderer.zoomToNode(zoomId)
}
