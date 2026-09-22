import { Menu, Mic, Search, Sun, Moon } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import ProfileMenu from './ProfileMenu'
import NotificationMenu from './NotificationMenu'
import FullscreenButton from './FullscreenButton'
import { findTool } from '@/lib/tools'
import { formatHotkey } from '@/lib/hotkeys'
import type { AppSettings } from '@/lib/settings'
import type { Theme } from '@/lib/useTheme'

interface Props {
  onOpenSearch: () => void
  onOpenVoice: () => void
  onOpenMobileNav: () => void
  shortcuts: AppSettings['shortcuts']
  theme: Theme
  onThemeChange: (theme: Theme) => void
  isDark: boolean
}

export default function Topbar({
  onOpenSearch,
  onOpenVoice,
  onOpenMobileNav,
  shortcuts,
  theme,
  onThemeChange,
  isDark,
}: Props) {
  const { pathname } = useLocation()
  const current = findTool(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/80 px-4 backdrop-blur-md lg:px-6 dark:border-neutral-800 dark:bg-neutral-900/80">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 lg:hidden dark:hover:bg-neutral-800"
        aria-label="Navigation öffnen"
      >
        <Menu className="size-5" />
      </button>

      <div className="hidden min-w-0 shrink-0 md:block">
        <h1 className="truncate text-sm font-semibold">{current?.name ?? 'Übersicht'}</h1>
      </div>

      {/* Suche */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="mx-auto flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-400 transition hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-800/50 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">Suchen…</span>
        <kbd className="hidden shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] whitespace-nowrap sm:inline dark:border-neutral-700">
          {formatHotkey(shortcuts.search)}
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onOpenVoice}
          className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title={`Sprache (${formatHotkey(shortcuts.voice)})`}
          aria-label="Spracheingabe öffnen"
        >
          <Mic className="size-[18px]" />
        </button>

        <FullscreenButton />
        <button
          type="button"
          onClick={() => onThemeChange(isDark ? 'light' : 'dark')}
          className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Design wechseln"
        >
          {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>

        <NotificationMenu />

        <div className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-800" />

        <ProfileMenu theme={theme} onThemeChange={onThemeChange} />
      </div>
    </header>
  )
}
