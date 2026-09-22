/**
 * Tastenkürzel: aufnehmen, speichern, vergleichen.
 *
 * Gespeichert wird eine schlichte Zeichenkette wie `ctrl+m` oder `ctrl+shift+f2`.
 * Angezeigt wird sie deutsch („Strg + M“).
 */

export interface ParsedHotkey {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  /** Taste in Kleinschreibung, z. B. `m`, `f4`, `space`. */
  key: string
}

/** Tasten, die allein kein Kürzel ergeben. */
const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta', 'os', 'altgraph', 'capslock', 'dead'])

const KEY_LABELS: Record<string, string> = {
  space: 'Leertaste',
  enter: 'Enter',
  escape: 'Esc',
  tab: 'Tab',
  backspace: 'Rücktaste',
  delete: 'Entf',
  insert: 'Einfg',
  home: 'Pos1',
  end: 'Ende',
  pageup: 'Bild ↑',
  pagedown: 'Bild ↓',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  ',': 'Komma',
  '.': 'Punkt',
  '-': 'Minus',
  '+': 'Plus',
}

export function parseHotkey(value: string): ParsedHotkey | null {
  const parts = value
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  const key = parts.pop()
  if (!key) return null
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta'),
    key,
  }
}

/** Anzeige: „Strg + Umschalt + M“. */
export function formatHotkey(value: string): string {
  const parsed = parseHotkey(value)
  if (!parsed) return '—'
  const parts: string[] = []
  if (parsed.ctrl) parts.push('Strg')
  if (parsed.shift) parts.push('Umschalt')
  if (parsed.alt) parts.push('Alt')
  if (parsed.meta) parts.push('Win')
  parts.push(KEY_LABELS[parsed.key] ?? parsed.key.toUpperCase())
  return parts.join(' + ')
}

/** Taste aus einem Ereignis lesen – `null`, wenn nur ein Modifier gedrückt wurde. */
function eventKey(event: KeyboardEvent): string | null {
  const key = event.key.toLowerCase()
  if (MODIFIER_KEYS.has(key)) return null
  if (key === ' ' || key === 'spacebar') return 'space'
  return key
}

/**
 * Ereignis in ein speicherbares Kürzel umwandeln. Ohne Modifier sind nur die
 * F-Tasten erlaubt – sonst würde ein einzelner Buchstabe jede Eingabe abfangen.
 */
export function hotkeyFromEvent(event: KeyboardEvent): string | null {
  const key = eventKey(event)
  if (!key) return null

  const parts: string[] = []
  if (event.ctrlKey) parts.push('ctrl')
  if (event.shiftKey) parts.push('shift')
  if (event.altKey) parts.push('alt')
  if (event.metaKey) parts.push('meta')

  const isFunctionKey = /^f\d{1,2}$/.test(key)
  if (!parts.length && !isFunctionKey) return null

  parts.push(key)
  return parts.join('+')
}

/** Passt das Ereignis zum gespeicherten Kürzel? Strg gilt auch für Cmd. */
export function matchesHotkey(event: KeyboardEvent, value: string): boolean {
  const wanted = parseHotkey(value)
  if (!wanted) return false
  const key = eventKey(event)
  if (key !== wanted.key) return false

  const ctrl = event.ctrlKey || event.metaKey
  if (wanted.ctrl !== ctrl && !(wanted.meta && event.metaKey)) return false
  if (wanted.shift !== event.shiftKey) return false
  if (wanted.alt !== event.altKey) return false
  return true
}

/** Kürzel, die das Tool selbst schon belegt. */
export const RESERVED_HOTKEYS: Record<string, string> = {
  'ctrl+r': 'Neu laden',
  'ctrl+w': 'Fenster schließen',
  'ctrl+t': 'Neuer Tab',
  'ctrl+n': 'Neues Fenster',
  'ctrl+p': 'Drucken',
  'ctrl+shift+m': 'Profilwechsel im Browser',
  f5: 'Neu laden',
  f11: 'Vollbild',
  f12: 'Entwicklertools',
}

/** Warnt vor Kombinationen, die der Browser selbst abfängt. */
export function reservedFor(value: string): string | null {
  return RESERVED_HOTKEYS[value.toLowerCase()] ?? null
}
