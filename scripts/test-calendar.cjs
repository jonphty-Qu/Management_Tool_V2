// Regression checks run entirely in memory; no browser or personal data is touched.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
let cells = [], cursor = 0
const storage = new Map()
const cache = new Map()
const react = {
  ...require('react'),
  useState(initial) {
    const index = cursor++
    if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial
    return [cells[index], next => { cells[index] = typeof next === 'function' ? next(cells[index]) : next }]
  },
  useEffect() {},
  useCallback: fn => fn,
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const localRequire = name => {
    if (name === 'react') return react
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name)
    const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(file), name)
    const resolved = ['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate))
    return load(resolved)
  }
  vm.runInThisContext('(function(require,module,exports,localStorage){' + code + '\n})', { filename: file })(
    localRequire, module, module.exports,
    { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  )
  return module.exports
}
const events = load(path.join(root, 'src/lib/events.ts'))
const EventDialog = load(path.join(root, 'src/components/calendar/EventDialog.tsx')).default
const QuickDayDialog = load(path.join(root, 'src/components/calendar/QuickDayDialog.tsx')).default
function render(component, props, reset = false) {
  if (reset) cells = []
  cursor = 0
  return component(props)
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return
  if (predicate(node)) return node
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, predicate)
    if (result) return result
  }
}
const draft = { id: 'test', title: 'Test', category: 'geburtstag', start: '2026-09-15T00:00:00Z', end: '2026-09-15T23:59:00Z', allDay: true }
function edit(event, nextAlerts) {
  let saved
  const props = { draft: event, onSave: value => { saved = value }, onClose() {} }
  let tree = render(EventDialog, props, true)
  if (nextAlerts !== undefined) {
    find(tree, node => node.type?.name === 'AlertPicker').props.onChange(nextAlerts)
    tree = render(EventDialog, props)
  }
  find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  return saved
}
assert.deepEqual(edit({ ...draft, reminders: [3, 0] }).alerts, [4320, 0], 'Legacy days become minutes')
assert.deepEqual(edit({ ...draft, alerts: [30, 300] }).alerts, [30, 300], 'Editing preserves minute and custom alerts')
const cleared = edit({ ...draft, alerts: [4320, 0], reminders: [3, 0] }, [])
assert.deepEqual(cleared.alerts, [], 'Birthday alerts can be disabled')
assert.equal('reminders' in cleared, false, 'Saving removes stale legacy values')
storage.set('mt.events', JSON.stringify([cleared]))
assert.deepEqual(render(events.useEvents, undefined, true).events[0].alerts, [], 'Disabled alerts remain disabled after reloading')
storage.set('mt.events', JSON.stringify([{ ...draft, reminders: [7, 1, 0] }]))
assert.deepEqual(render(events.useEvents, undefined, true).events[0].alerts, [10080, 1440, 0], 'Stored legacy events migrate on load')
let quick
const tree = render(QuickDayDialog, { initialDate: new Date(draft.start), onSave: value => { quick = value }, onClose() {} }, true)
find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} })
assert.deepEqual(quick.alerts, [4320, 0], 'Quick birthday uses minute-based alerts immediately')
assert.equal('reminders' in quick, false)
console.log('Calendar regression checks passed: migration, editing, custom alerts, disabled alerts, reload, quick birthday.')
