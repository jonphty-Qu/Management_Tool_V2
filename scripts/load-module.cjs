/**
 * Lädt ein TypeScript-Modul der App für die Testskripte.
 *
 * esbuild kommt mit Vite mit; lucide-react wird nur für Icons gebraucht und
 * bekommt im Test einen Platzhalter.
 */
const path = require('node:path')
const esbuild = require('esbuild')

const root = path.join(__dirname, '..')

const iconStub = {
  name: 'icon-stub',
  setup(build) {
    build.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'lucide', namespace: 'stub' }))
    build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'module.exports = new Proxy({}, { get: () => function Icon() {} })',
      loader: 'js',
    }))
  },
}

/** @param entry Pfad relativ zum Projektordner, z. B. `src/lib/hotkeys.ts` */
async function loadModule(entry) {
  const result = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    external: ['react'],
    plugins: [iconStub],
    logLevel: 'silent',
  })
  const module = { exports: {} }
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require)
  return module.exports
}

module.exports = { loadModule }
