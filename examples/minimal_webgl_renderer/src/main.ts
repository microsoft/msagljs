import {parseJSON} from '@msagl/parser'
import {Renderer} from '@msagl/renderer-webgl'
import {Graph} from '@msagl/core'
//create a renderer
const renderer = new Renderer()
// parse a graph
const graph: Graph = parseJSON({
  nodes: [{id: 'kspacey'}, {id: 'swilliams'}, {id: 'kbacon'}, {id: 'bpitt'}, {id: 'hford'}, {id: 'lwilson'}],
  edges: [
    {source: 'kspacey', target: 'swilliams'},
    {source: 'swilliams', target: 'kbacon'},
    {source: 'bpitt', target: 'kbacon'},
    {source: 'hford', target: 'lwilson'},
    {source: 'lwilson', target: 'kbacon'},
  ],
})
// attach the graph to the renderer: this causes the layout engine to run and the graph to be rendered
renderer.setGraph(graph)
