// https://github.com/microsoft/monaco-editor/blob/main/samples/browser-esm-esbuild/index.js
import * as monaco from 'monaco-editor/esm/vs/editor/editor.main.js'
import graphStyleSchema from '@msagl/renderer-webgl/graph-style-schema.json'

export function createEditor(container: HTMLElement) {
  // @ts-ignore
  globalThis.MonacoEnvironment = {
    getWorkerUrl: function (moduleId: string, label: string) {
      if (label === 'json') {
        return './vs/language/json/json.worker.js'
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return './vs/language/css/css.worker.js'
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return './vs/language/html/html.worker.js'
      }
      if (label === 'typescript' || label === 'javascript') {
        return './vs/language/typescript/ts.worker.js'
      }
      return './vs/editor/editor.worker.js'
    }
  }

  var modelUri = monaco.Uri.parse("http://msagl/graph-style.json"); // a made up unique URI for our model
  var model = monaco.editor.createModel('', "json", modelUri);

  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    schemas: [{
      uri: "http://msagl/graph-style-schema.json", // id of the first schema
      fileMatch: [modelUri.toString()], // associate with our model
      schema: graphStyleSchema
    }]
  });

  return monaco.editor.create(container, {
    model,
    tabSize: 2
  })
}
