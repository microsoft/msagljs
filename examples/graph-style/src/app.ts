import {Renderer as WebGLRenderer} from '@msagl/renderer-webgl'
import {loadGraphFromUrl} from '@msagl/parser'
import {createEditor} from './editor'
import defaultStyle from './default-style'

const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/JSONfiles/gameofthrones.json'
// const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/p2.gv'

const renderer = new WebGLRenderer(document.getElementById('viewer'), null)
renderer.setStyle(defaultStyle)

;(async () => {
  const editor = createEditor(document.getElementById('editor'))
  editor.setValue(JSON.stringify(defaultStyle, null, 2))

  const graph = await loadGraphFromUrl(defaultGraph)
  await renderer.setGraph(graph)

  document.getElementById('update-btn').addEventListener('click', () => {
    try {
      const newStyle = JSON.parse(editor.getValue())
      renderer.setStyle(newStyle)
      document.querySelector('#update-btn .error').innerText = ''
    } catch (ex) {
      document.querySelector('#update-btn .error').innerText = ex.message
    }
  })
})()
