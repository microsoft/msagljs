import {GeomNode, Graph, Node} from 'msagl-js'
import {DrawingNode} from 'msagl-js/drawing'

import type Renderer from '../renderer'
import type {IRendererControl} from '../renderer'

const DropdownStyle = `
  .search-control { pointer-events: all; font-family: "Segoe UI", Helvetica, Arial, sans-serif; font-size: 14px; position: absolute; top: 0; right: 0; margin: 20px; width: 200px; }
  .search-control-input { font-family: "Segoe UI", Helvetica, Arial, sans-serif; font-size: 14px; padding: 8px; width: 100%; }
  .search-control-options { background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); padding: 12px 0; margin-top: 4px; overflow-x: hidden; overflow-y: auto; }
  .search-control-option { padding: 0 12px; line-height: 32px; white-space: nowrap; color: #000; cursor: pointer; }
  .search-control-option:hover { background: #f8f8f8; }
  .search-control-option.focus { color: #08f; background: #f8f8f8; }
`

export default class SearchControl implements IRendererControl {
  private _dropdown: Dropdown
  private _nodes: Node[] = []

  onAdd(renderer: Renderer) {
    renderer.on('graphload', this._onGraphLoad)

    this._dropdown = new Dropdown({
      getLabel: (node: Node) => (<DrawingNode>DrawingNode.getDrawingObj(node)).labelText,
      onSelect: (node: Node) => {
        renderer.highlight(node.id)
        const geomNode = GeomNode.getGeom(node)
        renderer.zoomTo(geomNode.boundingBox)
      },
    })
    this._updateNodeList(renderer.graph)
  }

  onRemove(renderer: Renderer) {
    renderer.off('graphload', this._onGraphLoad)

    this._dropdown.delete()
    this._dropdown = null
  }

  getElement(): HTMLDivElement {
    return this._dropdown.element
  }

  private _onGraphLoad = (evt: any) => {
    this._updateNodeList(evt.data)
  }

  private _updateNodeList(graph: Graph) {
    this._nodes = graph ? Array.from(graph.nodesBreadthFirst) : []
    this._dropdown.update(this._nodes)
  }
}

type DropdownOptions = {
  getLabel: (item: any) => string
  renderItem: (label: string, keyword: string, item: any) => string
  filterItem: (label: string, keyword: string, item: any) => number
  onSelect: (item: any) => void
  buffer: number
  itemHeight: number
  maxHeight: number
}

/** A minimal virtualized dropdown control */
class Dropdown {
  element: HTMLDivElement
  focus = -1
  items: any[] = []

  options: DropdownOptions = {
    getLabel: (item: any) => item.toString(),
    renderItem: (label: string, keyword: string) => {
      if (!keyword) return label
      const i = label.toLowerCase().indexOf(keyword)
      return `${label.slice(0, i)}<b>${label.slice(i, i + keyword.length)}</b>${label.slice(i + keyword.length)}`
    },
    filterItem: (label: string, keyword: string) => {
      if (!keyword) return 1
      const i = label.toLowerCase().indexOf(keyword)
      if (i === 0) return 2
      if (i > 0) return 1
      return 0
    },
    onSelect: () => {}, // eslint-disable-line
    buffer: 2,
    itemHeight: 32,
    maxHeight: 240,
  }

  _active = false
  _topOffset = 0
  _keyword = ''
  _filteredItems: any[] = []
  _textbox: HTMLInputElement
  _flyout: HTMLDivElement
  _scroller: HTMLDivElement
  _items: HTMLDivElement[] = []
  _scrollTop: number
  _stylesheet: HTMLStyleElement

  constructor(options: Partial<DropdownOptions>) {
    const stylesheet = document.createElement('style')
    stylesheet.innerText = DropdownStyle
    document.head.appendChild(stylesheet)
    this._stylesheet = stylesheet

    const container = document.createElement('div')
    container.className = 'search-control'

    const textbox = document.createElement('input')
    textbox.placeholder = 'Search...'
    textbox.className = 'search-control-input'
    container.appendChild(textbox)
    textbox.addEventListener('focus', () => {
      textbox.value = ''
      this._keyword = ''
      this._active = true
      this._updateFilter()
    })
    textbox.addEventListener('blur', () => {
      setTimeout(() => {
        this._active = false
        this._updateUI()
      }, 200)
    })
    textbox.addEventListener('input', (evt) => {
      this._keyword = textbox.value.toLowerCase()
      this._updateFilter()
    })
    textbox.addEventListener('keydown', (evt) => {
      switch (evt.key) {
        case 'ArrowDown':
          evt.preventDefault()
          this.focus = Math.min(this._filteredItems.length - 1, this.focus + 1)
          this._updateUI()
          break
        case 'ArrowUp':
          evt.preventDefault()
          this.focus = Math.max(0, this.focus - 1)
          this._updateUI()
          break
        case 'Enter':
          this._select(this.focus)
          break
      }
    })
    this._textbox = textbox

    const flyout = document.createElement('div')
    flyout.className = 'search-control-options'
    flyout.addEventListener('scroll', this._onScroll)
    container.appendChild(flyout)

    const scroller = document.createElement('div')
    scroller.style.boxSizing = 'border-box'
    scroller.style.overflow = 'hidden'
    flyout.appendChild(scroller)

    this._flyout = flyout
    this._scroller = scroller
    this.element = container

    this.setOptions(options)
  }

  delete() {
    this.items = null
    this._stylesheet.remove()
    this._stylesheet = null
    this.element.remove()
    this.element = null
    this._scroller = null
    this._flyout = null
  }

  setOptions(options: Partial<DropdownOptions>) {
    Object.assign(this.options, options)

    const maxItems = Math.ceil(this.options.maxHeight / this.options.itemHeight) + this.options.buffer * 2
    const entries = this._items

    if (entries.length !== maxItems) {
      for (let i = entries.length; i < maxItems; i++) {
        const entry = this._makeItem(i)
        entries.push(entry)
      }
      for (let i = entries.length; i > maxItems; i--) {
        entries[i - 1].remove()
      }
    }
    this._updateFilter()
  }

  update(items: any[]) {
    this.items = items
    this._textbox.value = ''
    this._keyword = ''

    this._updateFilter()
  }

  _updateFilter() {
    const {getLabel, filterItem} = this.options
    const relevance = this.items.map((item) => {
      const label = getLabel(item)
      return filterItem(label, this._keyword, item)
    })
    const sortedIndices = Array.from(relevance, (_, i) => i).filter((i) => relevance[i])

    sortedIndices.sort((i0, i1) => relevance[i1] - relevance[i0])
    this._filteredItems = sortedIndices.map((i) => this.items[i])

    this.focus = 0
    this._updateUI()
  }

  _select(index: number) {
    const item = this._filteredItems[index]
    if (item) {
      this.options.onSelect(item)
      this._textbox.value = this.options.getLabel(item)
      this._textbox.blur()
    }
  }

  _onScroll = () => {
    const {itemHeight, buffer, getLabel, renderItem} = this.options

    const scrollTop = this._flyout.scrollTop

    this._topOffset = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer)
    this._scroller.style.paddingTop = this._topOffset * itemHeight + 'px'

    // Update labels
    for (let itemIndex = 0; itemIndex < this._items.length; itemIndex++) {
      const entry = this._items[itemIndex]
      const index = itemIndex + this._topOffset
      if (index === this.focus) {
        entry.classList.add('focus')
      } else {
        entry.classList.remove('focus')
      }
      const item = this._filteredItems[index]
      if (item) {
        const label = getLabel(item)
        entry.innerHTML = renderItem(label, this._keyword, item)
      }
    }
  }

  _updateUI() {
    if (!this._active) {
      this._flyout.style.display = 'none'
      return
    }
    this._flyout.style.display = 'block'
    this._flyout.style.maxHeight = this.options.maxHeight + 'px'

    const {itemHeight, maxHeight} = this.options

    const totalItemCount = this._filteredItems.length
    const pageItemCount = Math.floor(maxHeight / itemHeight)

    const minScrollTop = Math.max(0, (this.focus + 2 - pageItemCount) * itemHeight)
    const maxScrollTop = Math.min(Math.max(0, totalItemCount * itemHeight - maxHeight), Math.max(0, this.focus - 1) * itemHeight)

    let top = this._flyout.scrollTop

    if (top < minScrollTop) {
      top = minScrollTop
    }
    if (top > maxScrollTop) {
      top = maxScrollTop
    }

    this._scroller.style.height = totalItemCount * itemHeight + 'px'
    for (let itemIndex = 0; itemIndex < this._items.length; itemIndex++) {
      const entry = this._items[itemIndex] as HTMLDivElement
      entry.style.display = itemIndex < totalItemCount ? 'block' : 'none'
    }

    this._flyout.scrollTo({left: 0, top, behavior: 'smooth'})

    this._onScroll()
  }

  _makeItem(itemIndex: number) {
    const entry = document.createElement('div')
    entry.className = 'search-control-option'
    entry.style.height = this.options.itemHeight + 'px'

    this._scroller.appendChild(entry)
    entry.addEventListener('click', () => {
      this._select(itemIndex + this._topOffset)
    })
    return entry
  }
}
