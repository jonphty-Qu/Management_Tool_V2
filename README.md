# Management Tool

Ein lokales Dashboard für Aufgaben, Termine, Bewerbungen und Arbeitszeiten.
Organisiere Projekte auf einem Kanban-Board, erfasse Zeit direkt an Aufgaben und
verwalte Notizen, Dokumente und Kontakte an einem Ort.

Die Anwendung läuft auf deinem Rechner. Ein Download dieses Repositories enthält
den Programmcode und Beispieldaten, aber nicht die im Browser gespeicherten Einträge
anderer Nutzer. Technische Grundlage: React, TypeScript, Vite und Tailwind CSS.

## Installation

Benötigt werden Node.js mit npm und ein moderner Browser. Die Desktop-Starter und
die Windows-Verschlüsselung für Mail-Zugangsdaten sind für Windows vorgesehen.
Prüfe im Terminal mit `node --version` und `npm --version`, ob beide verfügbar sind.

Mit Git:

```powershell
git clone https://github.com/jonphty-Qu/Management_Tool_V2.git
cd Management_Tool_V2
npm ci
npm run dev
```

Alternativ auf GitHub **Code → Download ZIP** wählen, entpacken und im entpackten
Ordner ein Terminal öffnen. Dort `npm ci` und anschließend `npm run dev` ausführen.
Bei einem privaten Repository ist Zugriff über das angemeldete GitHub-Konto nötig.

Öffne anschließend [die lokale Anwendung](http://localhost:5180).
Das Terminal muss geöffnet bleiben; mit **Strg+C** beendest du den Server.

## Starten

Unter Windows kannst du `scripts/launch.vbs` starten oder eine Verknüpfung auf diese
Datei erstellen. Der Starter startet den Server bei Bedarf unsichtbar im
Hintergrund und öffnet die App als eigenes Fenster (Edge/Chrome im App-Modus).
Der Server läuft nach dem Schließen des Fensters weiter, damit der nächste Start sofort geht.

Manuell:

```
npm install
npm run dev
```

Läuft auf http://localhost:5180 (fester Port – localStorage hängt am Origin).

## Erste Schritte

1. Unter **Einstellungen → Profil** eigene Angaben hinterlegen und unter **Darstellung** das Design wählen.
2. Unter **Projekte** ein Projekt und Aufgaben anlegen. Karten lassen sich zwischen Spalten verschieben; ein Klick öffnet ihre Details.
3. Den Timer unten auf einer Aufgabenkarte starten. **Pause/Weiter** unterbricht bzw. setzt die Messung fort; **Stopp** speichert die Zeit. Die zentrale Timer-Anzeige bietet dieselben Steuerungen.
4. Unter **Zeiterfassung** eine Board-Aufgabe oder eine freie Tätigkeit auswählen. Dort findest du die Tagesübersicht und das Diagramm der letzten sieben Tage.
5. Im **Kalender** zwischen Tag, Arbeitswoche, Woche und Monat wechseln. Für Tag und Woche stehen **Kompakt** (Einträge pro Tag) und **Stunden** (Zeitraster) zur Verfügung. Ein Klick auf einen Termin öffnet die Bearbeitung.
6. Unter **Bewerbungen** eine Stellenadresse einfügen oder Angaben manuell eintragen. Importierte Angaben vor dem Speichern prüfen.
7. Unter **Einstellungen → Daten** regelmäßig eine Sicherung exportieren.

## Persönliche Daten und Sicherungen

- Profil, Aufgaben, Termine und Zeiteinträge liegen im lokalen Browser-Speicher.
- Dokumente und Mail-Kontodaten liegen zusätzlich lokal unter `data/`. Dieser Ordner ist von Git ausgeschlossen.
- Ein anderer Browser oder Browserprofil hat einen eigenen Datenbestand. Das Löschen der Website-Daten kann deine Einträge entfernen.
- Der Export unter **Einstellungen → Daten** sichert App-Daten und Dokumente. Mail-Zugangsdaten sind nicht Teil des Exports; Konten müssen auf einem anderen Rechner erneut eingerichtet werden.
- Bewahre Exporte außerhalb des Repository-Ordners auf. Ein Backup enthält persönliche Daten und sollte nicht auf GitHub hochgeladen werden.
- Es gibt keine automatische Synchronisierung deiner Einträge über GitHub. Git überträgt nur versionierte Projektdateien.

## Aktualisieren und Probleme beheben

Vor einem Update eine Sicherung exportieren. Bei einer Installation mit Git den
Server beenden und im Projektordner ausführen:

```powershell
git pull --ff-only
npm ci
npm run dev
```

**Seite nicht erreichbar:** Prüfe, ob `npm run dev` noch läuft, und verwende Port 5180.
Beim Windows-Starter stehen Fehlermeldungen in `scripts/server.log`.

**Einträge fehlen:** Verwende denselben Browser, dasselbe Browserprofil und dieselbe
Adresse wie zuvor. Bei Bedarf eine Sicherung unter **Einstellungen → Daten** wiederherstellen.

**Stellenimport blockiert:** Einige Portale erlauben keinen automatischen Abruf.
Öffne die Anzeige im Browser und übernimm die Angaben manuell.

**GitHub Pages:** Die Anwendung benötigt für Mail, Dokumente und Sicherungen ihren
lokalen Server. Ein reiner Upload der statischen Build-Dateien ersetzt diesen nicht.

## Module

| Bereich | Was es kann |
|---|---|
| **Dashboard** | Tool-Kacheln, heutige Aufgaben, letzte Aktivität |
| **E-Mails** | Ungelesene Mails aus allen IMAP-Postfächern in einer Liste, nur lesend |
| **Kalender** | Tag / Arbeitswoche / Woche / Monat, Termin per Klick oder Ziehen, Geburtstage mit Erinnerungen |
| **Projekte** | Kanban-Board mit Drag & Drop, eigene Spalten, Aufgaben mit Beschreibung, Zeitraum, Priorität |
| **Bewerbungen** | Link einfügen → Angaben werden ausgelesen; Status, Links, Unterlagen, E-Mail-Verlauf und Gespräche |
| **Finanzen** | Einnahmen, Fixkosten, flexible Kosten je Unternehmen, auf den Monat gerechnet |
| **Zeiterfassung** | Start/Stopp-Timer, Aufgaben und Tagesgesamtzeit |
| **Notizen** | Lokale Notizen mit Suche und Bearbeitung |
| **Dokumente** | Lokale Dateiablage und Anschreiben-Vorlagen |
| **Lesezeichen** | Links mit Titel, Notiz und Suche |
| **Kontakte** | Kontakte mit Firma, E-Mail, Telefon und Notizen |
| **Gewohnheiten** | Tägliche oder wöchentliche Routinen mit Serienstand |
| **Berichte** | Auswertungen zu Finanzen und Bewerbungen |
| **Einstellungen** | Profil, Darstellung, Benachrichtigungen, Daten und Browserwahl |

Alle Einträge der Sidebar sind als lokale Module verfügbar; neue Bereiche können später ergänzt werden.

## E-Mails

Konten werden per IMAP eingebunden (Gmail, GMX, WEB.DE, iCloud, T-Online, Yahoo, eigene Server).
Viele Anbieter verlangen dafür ein **App-Passwort** – der Dialog erklärt je Anbieter, wo es herkommt.

- Passwörter liegen in `data/mail-accounts.json`, verschlüsselt per Windows-DPAPI
  (nur mit deinem Windows-Konto auf diesem Rechner lesbar). `data/` ist in `.gitignore`.
- Abgefragt wird nur der Posteingang, schreibgeschützt – nichts wird als gelesen markiert.
- Neueste 50 ungelesene Mails pro Konto, Aktualisierung alle 5 Minuten oder per Knopf.
- Outlook.com/Hotmail: Microsoft lässt Passwort-Anmeldungen per IMAP kaum noch zu.

## Link-Import bei Bewerbungen

Link in die Leiste einfügen – Unternehmen, Position, Ort, Firmen-Link, Anstellungsart, Gehalt,
Fristen und ein Auszug der Beschreibung werden ausgelesen und als Entwurf zum Prüfen geöffnet.

Quelle sind die strukturierten `JobPosting`-Daten (schema.org), die die meisten Portale und
Karriereseiten für Google for Jobs mitliefern; sonst Titel- und Open-Graph-Tags.
LinkedIn und Indeed blockieren automatische Abrufe häufig – dann öffnet sich der Dialog mit
Link und Quelle, der Rest wird von Hand ergänzt.

Stellenlinks können über die Einstellung „Browser für externe Links“ direkt in Firefox geöffnet
werden. Wenn Firefox nicht installiert ist oder der lokale Aufruf fehlschlägt, öffnet sich der
Link wie gewohnt im Standardbrowser.

Das Profil in den Einstellungen wird lokal gespeichert und kann in Anschreiben-Vorlagen über die
Platzhalter `{{name}}`, `{{email}}`, `{{telefon}}`, `{{standort}}`, `{{beruf}}` und `{{profil}}`
verwendet werden.

## Aufbau

```
server/
  mailPlugin.ts       IMAP-Abfrage + Kontoverwaltung (/api/mail/*)
  jobPlugin.ts        Stellenanzeigen auslesen (/api/jobs/parse)
scripts/
  launch.vbs/.ps1     Starter für die Desktop-Verknüpfung
  app.ico             Programm-Icon
src/
  lib/                Datenmodelle und Hooks (tools, date, events, board, finance,
                      applications, mail, notifications, store, settings, useTheme)
  components/         Sidebar, Topbar, Menüs, Suche, DateInput, Kalender- und Board-Teile
  pages/              Dashboard, Mail, Calendar, Projects, Applications, Finance, Time, Notes,
                      Documents, Bookmarks, Contacts, Habits, Reports, Settings
```

Die API-Endpunkte verlangen den Header `X-Requested-With: management-tool` –
fremde Webseiten können sie dadurch nicht aus dem Browser heraus aufrufen.

## Datumseingabe

`04062026` · `040626` · `0406` · `4.6.2026` · `4.6.26` · `04/06/2026` · `heute` · `morgen` · `übermorgen`
– oder das Kalendersymbol im Feld. Uhrzeiten: `1430`, `14:30`, `14`.

## Neues Tool hinzufügen

Eintrag in `src/lib/tools.ts` ergänzen – erscheint automatisch in Sidebar, Suche und Dashboard.
Danach in `src/App.tsx` eine Route setzen, sonst greift der Platzhalter.

## Stand

Kalender-Erinnerungen werden in Minuten gespeichert. Der Termindialog unterstützt
feste und eigene Zeitabstände; ältere Tages-Erinnerungen werden beim Laden übernommen.

Prüfungen: `npm run build` prüft TypeScript und erstellt den Produktionsbuild.
`node scripts/test-calendar.cjs` prüft die Migration alter Erinnerungen, das Bearbeiten,
eigene Zeitabstände, ausgeschaltete Erinnerungen nach erneutem Laden und die
Geburtstags-Schnellanlage ausschließlich mit Testdaten im Arbeitsspeicher.
`node scripts/test-integrations.cjs` prüft die lokalen Stellenimport-, E-Mail- und
Sicherung-Endpunkte ohne Zugangsdaten (der Entwicklungsserver muss auf Port 5180 laufen).

Termine, Board, Finanzen und Bewerbungen liegen im localStorage des Browsers.
E-Mail-Konten liegen lokal in `data/`. Kein Cloud-Backend.
