import {execFileSync} from 'child_process'
import {resolve} from 'path'

const root = resolve(__dirname, '../../..')

beforeAll(() => {
  execFileSync('npm', ['run', 'build', '--workspace=@msagl/core', '--workspace=@msagl/drawing', '--workspace=@msagl/parser'], {
    cwd: root,
    timeout: 120000,
    stdio: 'pipe',
  })
}, 120000)

test.each([
  ['@msagl/core', 'GeomGraph'],
  ['@msagl/drawing', 'DrawingGraph'],
  ['@msagl/parser', 'parseDot'],
])('loads %s in Node as ESM', (pkg, exportedName) => {
  const output = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `import {${exportedName}} from '${pkg}'; console.log(typeof ${exportedName});`],
    {cwd: root, encoding: 'utf8'},
  )
  expect(output.trim()).toBe('function')
})

test('built packages share graph types and support parsing and layout in Node', () => {
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
        import assert from 'node:assert/strict';
        import {Graph, GeomGraph, layoutGeomGraph} from '@msagl/core';
        import {DrawingGraph, Color} from '@msagl/drawing';
        import {parseDot} from '@msagl/parser';

        const graph = parseDot('digraph { a [color=red]; a -> b }');
        assert.ok(graph instanceof Graph);
        const drawing = DrawingGraph.getDrawingObj(graph);
        assert.ok(drawing instanceof DrawingGraph);
        assert.deepEqual(drawing.findNode('a').color, Color.Red);
        drawing.createGeometry();
        const geometry = GeomGraph.getGeom(graph);
        assert.ok(geometry instanceof GeomGraph);
        layoutGeomGraph(geometry);
        assert.equal(geometry.graph.deepEdgesCount, 1);
        assert.ok(geometry.boundingBox.width > 0);
        assert.ok(geometry.boundingBox.height > 0);
      `,
    ],
    {cwd: root},
  )
})
