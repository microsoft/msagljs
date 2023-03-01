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
	'vs/editor/editor.worker.js'
];
const monacoModuleDir = '../../node_modules/monaco-editor'

start(mode);

async function start() {
  fs.rmSync('./dist', { recursive: true })
  fs.mkdirSync('./dist')

  const result = await esbuild.build({
    entryPoints: workerEntryPoints.map((entry) => `${monacoModuleDir}/esm/${entry}`),
    bundle: true,
    format: 'iife',
    outbase: `${monacoModuleDir}/esm/`,
    outdir: './dist'
  });
  handleErrors(result);

  fs.copyFileSync(`${monacoModuleDir}/min/vs/editor/editor.main.css`, 'dist/editor.main.css');

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

    await esbuild.serve({
      servedir: './dist',
      port: 8080
    }, ctx);
    console.log(`serving on http://localhost:8080`);

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
