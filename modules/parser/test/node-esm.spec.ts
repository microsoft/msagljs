import {execFileSync} from 'child_process'
import {copyFileSync, mkdtempSync, mkdirSync, rmSync} from 'fs'
import {tmpdir} from 'os'
import {basename, join, resolve} from 'path'

const root = resolve(__dirname, '../../..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const packageDirs = ['core', 'drawing', 'parser'].map((name) => resolve(root, 'modules', name))

const runNpm = (args: string[], options: {cwd: string; env?: typeof process.env; timeout?: number}) =>
  execFileSync(npmCommand, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'pipe',
    ...options,
  })

beforeAll(() => {
  runNpm(['run', 'build', '--workspace=@msagl/core', '--workspace=@msagl/drawing', '--workspace=@msagl/parser'], {
    cwd: root,
    timeout: 120000,
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

test('packages produced by npm pack work in an isolated consumer', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'msagl-node-esm-'))
  const packDir = join(tempDir, 'packs')
  const consumerDir = join(tempDir, 'consumer')
  mkdirSync(packDir)
  mkdirSync(consumerDir)

  try {
    const tarballs = packageDirs.map((packageDir) => {
      const output = runNpm(['pack'], {
        cwd: packageDir,
        env: {...process.env, npm_config_pack_destination: packDir},
        timeout: 120000,
      })
      return basename(output.trim())
    })

    for (const tarball of tarballs) {
      copyFileSync(join(packDir, tarball), join(consumerDir, tarball))
    }

    runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-save', ...tarballs.map((tarball) => `./${tarball}`)], {
      cwd: consumerDir,
      timeout: 180000,
    })

    const output = execFileSync(
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
      {cwd: consumerDir, encoding: 'utf8'},
    )
    expect(output).toBe('')
  } finally {
    rmSync(tempDir, {recursive: true, force: true})
  }
}, 300000)
