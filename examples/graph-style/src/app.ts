import {dropZone} from './drag-n-drop'
import {Renderer as WebGLRenderer} from '@msagl/renderer-webgl'
import {loadGraphFromFile, loadGraphFromUrl} from '@msagl/parser'
import {createEditor} from './editor'
import defaultStyle from './default-style'

//const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/JSONfiles/composers.json'
const defaultGraph = 'https://raw.githubusercontent.com/microsoft/msagljs/main/modules/core/test/data/graphvis/p2.gv'

const renderer = new WebGLRenderer(document.getElementById('viewer'), null)
renderer.setStyle(defaultStyle)
;(async () => {
  const editor = createEditor(document.getElementById('editor'))
  editor.setValue(JSON.stringify(defaultStyle, null, 2))

  const graph = await loadGraphFromUrl(defaultGraph)
  await renderer.setGraph(graph)

  const updateMessage = document.querySelector('#update-btn .error') as HTMLDivElement
  document.getElementById('update-btn').addEventListener('click', () => {
    try {
      const newStyle = JSON.parse(editor.getValue())
      renderer.setStyle(newStyle)
      updateMessage.innerText = ''
    } catch (ex) {
      updateMessage.innerText = ex.message
    }
  })
})()
// File selector
dropZone('drop-target', async (f: File) => {
  const graph = await loadGraphFromFile(f)
  renderer.setGraph(graph)
})
