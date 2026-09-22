import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import CommandPalette from './components/CommandPalette'
import VoiceDialog from './components/VoiceDialog'
import Dashboard from './pages/Dashboard'
import SettingsPage from './pages/Settings'
import Calendar from './pages/Calendar'
import Projects from './pages/Projects'
import Finance from './pages/Finance'
import Applications from './pages/Applications'
import MailPage from './pages/Mail'
import Notes from './pages/Notes'
import Documents from './pages/Documents'
import Reports from './pages/Reports'
import Time from './pages/Time'
import Bookmarks from './pages/Bookmarks'
import Contacts from './pages/Contacts'
import Habits from './pages/Habits'
import ToolPage from './pages/ToolPage'
import { useTheme } from './lib/useTheme'
import { useSettings } from './lib/settings'
import { matchesHotkey } from './lib/hotkeys'

/** Seiten, die selbst scrollen. */
function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
}

/** Seiten, die die volle Höhe füllen (Kalender). */
function Fill({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col p-4 lg:p-6">{children}</div>
}

export default function App() {
  const { theme, setTheme, isDark } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const { settings } = useSettings()
  const shortcuts = settings.shortcuts

  // Kürzel für Suche und Spracheingabe – beide sind in den Einstellungen änderbar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchesHotkey(e, shortcuts.search)) {
        e.preventDefault()
        setSearchOpen(true)
      } else if (matchesHotkey(e, shortcuts.voice)) {
        e.preventDefault()
        setVoiceOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts.search, shortcuts.voice])

  return (
    <div className="flex h-full">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
        onOpenVoice={() => setVoiceOpen(true)}
        voiceShortcut={shortcuts.voice}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenSearch={() => setSearchOpen(true)}
          onOpenVoice={() => setVoiceOpen(true)}
          shortcuts={shortcuts}
          onOpenMobileNav={() => setMobileNav(true)}
          theme={theme}
          onThemeChange={setTheme}
          isDark={isDark}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={
                <Scroll>
                  <Dashboard />
                </Scroll>
              }
            />
            <Route
              path="/calendar"
              element={
                <Fill>
                  <Calendar />
                </Fill>
              }
            />
            <Route
              path="/projects"
              element={
                <Fill>
                  <Projects />
                </Fill>
              }
            />
            <Route
              path="/finance"
              element={
                <Scroll>
                  <Finance />
                </Scroll>
              }
            />
            <Route path="/time" element={<Scroll><Time /></Scroll>} />
            <Route path="/bookmarks" element={<Scroll><Bookmarks /></Scroll>} />
            <Route path="/contacts" element={<Scroll><Contacts /></Scroll>} />
            <Route path="/habits" element={<Scroll><Habits /></Scroll>} />
            <Route
              path="/applications"
              element={
                <Scroll>
                  <Applications />
                </Scroll>
              }
            />
            <Route
              path="/mail"
              element={
                <Fill>
                  <MailPage />
                </Fill>
              }
            />
            <Route
              path="/notes"
              element={
                <Fill>
                  <Notes />
                </Fill>
              }
            />
            <Route
              path="/documents"
              element={
                <Scroll>
                  <Documents />
                </Scroll>
              }
            />
            <Route
              path="/reports"
              element={
                <Scroll>
                  <Reports />
                </Scroll>
              }
            />
            <Route
              path="/settings"
              element={
                <Scroll>
                  <SettingsPage theme={theme} onThemeChange={setTheme} />
                </Scroll>
              }
            />
            <Route
              path="*"
              element={
                <Scroll>
                  <ToolPage />
                </Scroll>
              }
            />
          </Routes>
        </main>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      {/* Nur im offenen Zustand gemountet: so startet jede Sitzung mit frischem Mikrofon */}
      {voiceOpen && <VoiceDialog onClose={() => setVoiceOpen(false)} />}
    </div>
  )
}
