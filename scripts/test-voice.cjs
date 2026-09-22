/**
 * Regressionstest für die Sprachbefehle.
 *
 * Bündelt den Parser mit esbuild (kommt mit Vite) und prüft die Sätze, die beim
 * Diktieren erfahrungsgemäß auftauchen. Aufruf: node scripts/test-voice.cjs
 */
const { loadModule } = require('./load-module.cjs')

const failures = []

function check(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) failures.push(`${label}: erwartet ${e}, bekam ${a}`)
}

async function main() {
  const commands = await loadModule('src/lib/voiceCommands.ts')
  const answers = await loadModule('src/lib/voiceAnswers.ts')
  const { parseVoiceCommand, parseConfirmation, splitCommands, parseTaskList } = commands

  // Sonntag, 20.09.2026, 10:00 – festes Bezugsdatum für reproduzierbare Ergebnisse
  const base = new Date(2026, 8, 20, 10, 0)
  const day = (d) => (d ? `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}` : null)
  const time = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

  // ---------- Aufgaben ----------
  const task = parseVoiceCommand('Aufgabe Angebot für Kunde X schreiben bis Freitag, hohe Priorität', base)
  check('Aufgabe', [task.kind, task.title, task.priority, day(task.due)], [
    'task',
    'Angebot für Kunde X schreiben',
    'hoch',
    '25.9.2026',
  ])

  const project = parseVoiceCommand('Aufgabe Steuererklärung im Projekt Privat bis zum 31. Oktober', base)
  check('Aufgabe mit Projekt', [project.title, project.project, day(project.due)], [
    'Steuererklärung',
    'Privat',
    '31.10.2026',
  ])

  const reminder = parseVoiceCommand('erinnere mich daran, den Müll rauszubringen', base)
  check('Erinnerung ohne Datum', [reminder.kind, reminder.due], ['task', null])

  const inDays = parseVoiceCommand('leg mir bitte eine Aufgabe an: Präsentation vorbereiten in drei Tagen', base)
  check('in drei Tagen', [inDays.title, day(inDays.due)], ['Präsentation vorbereiten', '23.9.2026'])

  // ---------- Termine ----------
  const appointment = parseVoiceCommand('Termin morgen um 14 Uhr Zahnarzt', base)
  check('Termin', [appointment.kind, appointment.title, day(appointment.start), time(appointment.start), appointment.category], [
    'event',
    'Zahnarzt',
    '21.9.2026',
    '14:00',
    'privat',
  ])

  const halfPast = parseVoiceCommand('Termin am 4. Juni um halb drei Vorstellungsgespräch bei Siemens', base)
  check('halb drei wird nachmittags', [time(halfPast.start), day(halfPast.start), halfPast.category], [
    '14:30',
    '4.6.2027',
    'gespraech',
  ])

  const early = parseVoiceCommand('Termin übermorgen um 8 Uhr früh Physiotherapie', base)
  check('übermorgen früh', [day(early.start), time(early.start)], ['22.9.2026', '8:00'])

  const duration = parseVoiceCommand('Meeting am Dienstag um 9 Uhr 30 Sprint Planning für zwei Stunden', base)
  check('Dauer', [day(duration.start), time(duration.start), time(duration.end)], ['22.9.2026', '9:30', '11:30'])

  const allDay = parseVoiceCommand('Termin am Freitag Betriebsausflug', base)
  check('ganztägig ohne Uhrzeit', [allDay.allDay, day(allDay.start)], [true, '25.9.2026'])

  // ---------- Notizen ----------
  const note = parseVoiceCommand('Notiz Einkaufsliste: Milch, Brot und Kaffee', base)
  check('Notiz', [note.kind, note.title, note.content], ['note', 'Einkaufsliste', 'Milch, Brot und Kaffee'])

  const dictated = parseVoiceCommand('notiere Passwort vom Router steht im Schrank', base)
  check('notiere wird Notiz', dictated.kind, 'note')

  // ---------- Fragen, Navigation, Steuerung ----------
  check('Frage heute', parseVoiceCommand('Was steht heute an?', base).scope, 'today')
  check('Frage morgen', parseVoiceCommand('welche Termine habe ich morgen', base).scope, 'tomorrow')
  check('Frage Woche', parseVoiceCommand('was ist diese Woche los', base).scope, 'week')
  check('Frage Aufgaben', parseVoiceCommand('welche Aufgaben sind fällig', base).scope, 'tasks')
  check('Navigation', parseVoiceCommand('öffne den Kalender', base).path, '/calendar')
  check('Navigation Umlaut-frei', parseVoiceCommand('zeig mir die Projekte', base).path, '/projects')
  check('Abbruch', parseVoiceCommand('abbrechen', base).action, 'cancel')
  check('Rückgängig', parseVoiceCommand('rückgängig', base).action, 'undo')
  check('Füllwort', parseVoiceCommand('ja', base).kind, 'unknown')
  check('Danke', parseVoiceCommand('danke', base).kind, 'unknown')
  check('Bestätigung ja', parseConfirmation('ja genau'), true)
  check('Bestätigung nein', parseConfirmation('nein, lieber nicht'), false)
  check('Bestätigung unklar', parseConfirmation('Zahnarzt morgen'), null)

  // ---------- Gesprochene Antworten ----------
  check(
    'Bestätigungssatz',
    answers.taskConfirmation(task, { projectName: 'Allgemein', createdProject: false }, base),
    'Aufgabe „Angebot für Kunde X schreiben“ angelegt, fällig am Freitag, Priorität hoch, im Projekt Allgemein.',
  )
  check('Terminsatz', answers.eventConfirmation(appointment, base), 'Termin „Zahnarzt“ morgen um 14 Uhr eingetragen.')

  const iso = (d) => new Date(d).toISOString()
  const events = [
    { id: 'a', title: 'Daily Standup', start: iso(new Date(2026, 8, 20, 9)), end: iso(new Date(2026, 8, 20, 9, 15)), allDay: false, category: 'arbeit' },
  ]
  const projects = [
    {
      id: 'p1',
      name: 'Allgemein',
      createdAt: '',
      columns: [
        { id: 'c1', title: 'Offen', order: 0 },
        { id: 'c2', title: 'Erledigt', order: 1 },
      ],
      cards: [
        { id: 'k1', columnId: 'c1', title: 'Angebot schreiben', priority: 'hoch', order: 0, end: iso(new Date(2026, 8, 20)) },
        { id: 'k2', columnId: 'c2', title: 'Fertiges', priority: 'niedrig', order: 0 },
      ],
    },
  ]
  check(
    'Auskunft heute',
    answers.answerQuery('today', events, projects, base),
    'Heute hast du einen Termin: um 9 Uhr Daily Standup. Außerdem ist eine Aufgabe fällig: Angebot schreiben.',
  )
  check('Auskunft morgen', answers.answerQuery('tomorrow', events, projects, base), 'Morgen steht nichts an.')
  check('Erledigte zählen nicht', answers.openTasks(projects).length, 1)

  // ---------- Titel und Einzelheiten ----------
  const shopping = parseVoiceCommand('Aufgabe Einkaufen: Brötchen, Fleisch, Toast und Energy', base)
  check('Beschreibung nach Doppelpunkt', [shopping.title, shopping.description], [
    'Einkaufen',
    'Brötchen, Fleisch, Toast und Energy',
  ])
  check('ohne Doppelpunkt keine Beschreibung', parseVoiceCommand('Aufgabe Prof antworten', base).description, null)

  // ---------- Mehrere Aufträge in einem Diktat ----------
  check(
    'Trennung an „und dann“',
    splitCommands('Aufgabe Einkaufen gehen und dann Aufgabe Bett neu beziehen'),
    ['Aufgabe Einkaufen gehen', 'Aufgabe Bett neu beziehen'],
  )
  check(
    'Trennung an Komma vor Auftragswort',
    splitCommands('Aufgabe Prof antworten, Aufgabe Präsentation anlegen, Termin morgen um 14 Uhr Zahnarzt'),
    ['Aufgabe Prof antworten', 'Aufgabe Präsentation anlegen', 'Termin morgen um 14 Uhr Zahnarzt'],
  )
  check(
    'kein Split innerhalb eines Auftrags',
    splitCommands('Aufgabe Angebot schreiben bis Freitag, hohe Priorität'),
    ['Aufgabe Angebot schreiben bis Freitag, hohe Priorität'],
  )
  check(
    'kein Split in einer Aufzählung',
    splitCommands('Aufgabe Einkaufen: Brötchen, Fleisch und Toast'),
    ['Aufgabe Einkaufen: Brötchen, Fleisch und Toast'],
  )
  check(
    'Sammelantwort',
    answers.batchConfirmation([
      { kind: 'task', title: 'Prof antworten' },
      { kind: 'task', title: 'Einkaufen' },
    ]),
    '2 Aufgaben angelegt: Prof antworten und Einkaufen.',
  )
  check(
    'Sammelantwort mit Rest',
    answers.batchConfirmation(
      ['Werkstatt', 'Versicherung', 'Präsentation', 'Prof', 'Kochen', 'Saugen', 'Müll'].map((title) => ({
        kind: 'task',
        title,
      })),
    ),
    '7 Aufgaben angelegt: Werkstatt, Versicherung, Präsentation, Prof, Kochen und 2 weitere.',
  )

  // ---------- Angesagte Liste ----------
  check(
    'Liste erkannt',
    parseTaskList('kannst du mir bitte die Aufgaben anlegen: Werkstatt anrufen, Versicherung erkundigen, Einkaufen'),
    ['Werkstatt anrufen', 'Versicherung erkundigen', 'Einkaufen'],
  )
  check('Einzelaufgabe ist keine Liste', parseTaskList('Aufgabe Einkaufen: Brötchen, Fleisch'), null)
  check(
    'Bindestrich hält zusammen',
    parseTaskList('Aufgaben: Spülmaschine ein- und ausräumen, Müll wegbringen, Saugen'),
    ['Spülmaschine ein- und ausräumen', 'Müll wegbringen', 'Saugen'],
  )
  check('Frage ist keine Liste', parseTaskList('welche Aufgaben sind offen'), null)
  const forced = parseVoiceCommand('Termin bei der Werkstatt machen', base, 'task')
  check('Listenpunkt bleibt wörtlich', [forced.kind, forced.title], ['task', 'Termin bei der Werkstatt machen'])
  const forced2 = parseVoiceCommand('Präsentation anlegen', base, 'task')
  check('Listenpunkt wird nicht gekürzt', forced2.title, 'Präsentation anlegen')
  const forced3 = parseVoiceCommand('Einkaufen bis morgen', base, 'task')
  check('Datum zählt auch in der Liste', [forced3.title, day(forced3.due)], ['Einkaufen', '21.9.2026'])

  // ---------- Zeiterfassung ----------
  const timerStart = parseVoiceCommand('starte den Timer für Bewerbung schreiben', base)
  check('Timer starten', [timerStart.kind, timerStart.action, timerStart.query], [
    'timer',
    'start',
    'Bewerbung schreiben',
  ])
  check('Timer stoppen', parseVoiceCommand('stopp den Timer', base).action, 'stop')
  check('Timer pausieren', parseVoiceCommand('Timer pausieren', base).action, 'pause')
  check('Timer weiter', parseVoiceCommand('Timer weiter', base).action, 'resume')
  check('Zeiterfassung beenden', parseVoiceCommand('beende die Zeiterfassung', base).action, 'stop')
  check('Aufgabe bleibt Aufgabe', parseVoiceCommand('Aufgabe Wecker stellen', base).kind, 'task')

  // ---------- Ändern ----------
  const moved = parseVoiceCommand('verschiebe Einkaufen auf morgen', base)
  check('Verschieben', [moved.kind, moved.query, day(moved.due)], ['update', 'Einkaufen', '21.9.2026'])
  const raised = parseVoiceCommand('setze Bewerben auf hohe Priorität', base)
  check('Priorität ändern', [raised.kind, raised.query, raised.priority], ['update', 'Bewerben', 'hoch'])
  check(
    'ohne Verb bleibt es eine neue Aufgabe',
    parseVoiceCommand('Einkaufen bis morgen', base).kind,
    'task',
  )
  check(
    'Änderungssatz',
    answers.updateConfirmation('Einkaufen', new Date(2026, 8, 21), null, base),
    '„Einkaufen“ ist jetzt morgen fällig.',
  )

  // ---------- Abhaken ----------
  check('Abhaken', parseVoiceCommand('hake Einkaufen ab', base).kind, 'complete')
  check('ist erledigt', parseVoiceCommand('Die Präsentation ist erledigt', base).query, 'Präsentation')
  check('ich habe … erledigt', parseVoiceCommand('ich habe Prof antworten erledigt', base).query, 'Prof antworten')
  check('Frage bleibt Frage', parseVoiceCommand('welche Aufgaben sind fällig', base).kind, 'query')
  check('Treffer über Teilwort', answers.findOpenTask(projects, 'Angebot')?.card.title, 'Angebot schreiben')
  check('kein Treffer', answers.findOpenTask(projects, 'Rasen mähen'), null)
  check('Erledigt-Spalte', answers.doneColumn(projects[0]).title, 'Erledigt')

  if (failures.length) {
    console.error('Voice checks failed:')
    for (const line of failures) console.error(' -', line)
    process.exit(1)
  }
  console.log('Voice checks passed: Aufgaben, Termine, Notizen, Fragen, Navigation, Antworten.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
