const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const mode = process.argv[2];

// https://github.com/microsoft/monaco-editor/blob/main/samples/browser-esm-esbuild/build.js
const workerEntryPoints = [
	'vs/language/json/json.worker.js',
	'vs/language/css/css.worker.js',
	'vs/language/html/html.worker.js',
	'vs/language/typescript/ts.worker.js',
	'vs/editor/editor.worker.js',
];

const monacoModuleDir = '../../node_modules/monaco-editor'

start(mode);

async function start() {
  if (fs.existsSync('./dist')) {
    fs.rmSync('./dist', { recursive: true })
  }
  fs.mkdirSync('./dist')

  let result = await esbuild.build({
    entryPoints: workerEntryPoints.map((entry) => `${monacoModuleDir}/esm/${entry}`),
    bundle: true,
    format: 'iife',
    outbase: `${monacoModuleDir}/esm/`,
    outdir: './dist'
  });
  handleErrors(result);

  const ctx = {
    entryPoints: ['src/app.ts'],
    sourcemap: true,
    bundle: true,
    format: 'iife',
    outdir: './dist',
    loader: {
      '.ttf': 'file'
    }
  }

  if (mode === 'watch') {
    fs.linkSync('./index.html', './dist/index.html')

    result = await esbuild.serve({
      servedir: './dist',
    }, ctx);
    console.log(`> Local: \thttp://localhost:${result.port}`);

  } else {
    fs.copyFileSync('./index.html', './dist/index.html')
    result = await esbuild.build(ctx);

    handleErrors(result);
  }  
}

function handleErrors(buildResult) {
  if (buildResult.errors.length) {
    console.error(result.errors);
    process.exit(1);
  }
}
