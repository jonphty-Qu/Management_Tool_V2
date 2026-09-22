/**
 * Prüft die einstellbaren Tastenkürzel: aufnehmen, anzeigen, vergleichen.
 * Aufruf: node scripts/test-hotkeys.cjs
 */
const { loadModule } = require('./load-module.cjs')

const failures = []

function check(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) failures.push(`${label}: erwartet ${e}, bekam ${a}`)
}

/** Ereignis wie es der Browser liefert – der Code liest nur diese Felder. */
function keyEvent(key, mods = {}) {
  return {
    key,
    ctrlKey: Boolean(mods.ctrl),
    shiftKey: Boolean(mods.shift),
    altKey: Boolean(mods.alt),
    metaKey: Boolean(mods.meta),
  }
}

async function main() {
  const { formatHotkey, hotkeyFromEvent, matchesHotkey, reservedFor } = await loadModule('src/lib/hotkeys.ts')

  // ---------- Aufnehmen ----------
  check('Strg + M', hotkeyFromEvent(keyEvent('m', { ctrl: true })), 'ctrl+m')
  check('Großschreibung egal', hotkeyFromEvent(keyEvent('M', { ctrl: true, shift: true })), 'ctrl+shift+m')
  check('Alt + Leertaste', hotkeyFromEvent(keyEvent(' ', { alt: true })), 'alt+space')
  check('F-Taste ohne Modifier', hotkeyFromEvent(keyEvent('F4')), 'f4')
  check('Buchstabe allein zählt nicht', hotkeyFromEvent(keyEvent('m')), null)
  check('Modifier allein zählt nicht', hotkeyFromEvent(keyEvent('Control', { ctrl: true })), null)

  // ---------- Anzeigen ----------
  check('Anzeige einfach', formatHotkey('ctrl+m'), 'Strg + M')
  check('Anzeige mehrfach', formatHotkey('ctrl+shift+f2'), 'Strg + Umschalt + F2')
  check('Anzeige Sondertaste', formatHotkey('alt+space'), 'Alt + Leertaste')

  // ---------- Vergleichen ----------
  check('Treffer', matchesHotkey(keyEvent('m', { ctrl: true }), 'ctrl+m'), true)
  check('Cmd zählt wie Strg', matchesHotkey(keyEvent('m', { meta: true }), 'ctrl+m'), true)
  check('falscher Modifier', matchesHotkey(keyEvent('m', { ctrl: true, shift: true }), 'ctrl+m'), false)
  check('andere Taste', matchesHotkey(keyEvent('k', { ctrl: true }), 'ctrl+m'), false)
  check('ohne Modifier kein Treffer', matchesHotkey(keyEvent('m'), 'ctrl+m'), false)
  check('F-Taste trifft', matchesHotkey(keyEvent('F4'), 'f4'), true)

  // ---------- Belegte Kombinationen ----------
  check('Browser-Kürzel erkannt', typeof reservedFor('ctrl+w'), 'string')
  check('freie Kombination', reservedFor('ctrl+m'), null)

  if (failures.length) {
    console.error('Hotkey checks failed:')
    for (const line of failures) console.error(' -', line)
    process.exit(1)
  }
  console.log('Hotkey checks passed: Aufnahme, Anzeige, Vergleich, belegte Kombinationen.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
