import {Graph} from 'msagl-js'

import {parseDot, parseJSON, parseSimpleJSON} from '@msagl/parser'

export async function loadGraphFromUrl(url: string): Promise<Graph> {
  const fileName = url.slice(url.lastIndexOf('/') + 1)
  const resp = await fetch(url)
  let graph: Graph

  if (fileName.endsWith('.json')) {
    const json = await resp.json()
    graph = parseJSON(json) ?? parseSimpleJSON(json)
  } else {
    const content = await resp.text()
    graph = parseDot(content)
  }

  graph.id = fileName
  return graph
}

export async function loadGraphFromFile(file: File): Promise<Graph> {
  const content: string = await file.text()
  let graph: Graph

  if (file.name.endsWith('.json')) {
    graph = parseJSON(JSON.parse(content))
  } else {
    graph = parseDot(content)
  }

  graph.id = file.name
  return graph
}
