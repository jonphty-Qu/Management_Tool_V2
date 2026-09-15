import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings,
  User,
  Bell,
  Keyboard,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Theme } from '@/lib/useTheme'
import { useSettings } from '@/lib/settings'

interface Props {
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'dark', label: 'Dunkel', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export default function ProfileMenu({ theme, onThemeChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { settings } = useSettings()
  const initials = settings.profileName.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
          {initials}
        </span>
        <ChevronDown
          className={cn('size-4 text-neutral-400 transition', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg shadow-black/5 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{settings.profileName || 'Profil'}</div>
              <div className="truncate text-xs text-neutral-500">{settings.profileEmail || 'Keine E-Mail'}</div>
            </div>
          </div>

          <div className="p-1.5">
            <MenuItem icon={User} label="Profil" onClick={() => go('/settings')} />
            <MenuItem icon={Settings} label="Einstellungen" onClick={() => go('/settings')} />
            <MenuItem icon={Bell} label="Benachrichtigungen" onClick={() => go('/settings')} />
            <MenuItem icon={Keyboard} label="Tastenkürzel" shortcut="⌘K" onClick={() => setOpen(false)} />
          </div>

          <div className="border-t border-neutral-200 p-1.5 dark:border-neutral-800">
            <div className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
              Darstellung
            </div>
            <div className="flex gap-1 px-1.5 pb-1.5">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onThemeChange(opt.value)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[11px] transition',
                    theme === opt.value
                      ? 'bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                  )}
                >
                  <opt.icon className="size-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-neutral-200 p-1.5 dark:border-neutral-800">
            <MenuItem icon={LogOut} label="Abmelden" danger onClick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  danger,
  onClick,
}: {
  icon: typeof User
  label: string
  shortcut?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
          : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
      )}
    >
      <Icon className="size-[18px]" />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-xs text-neutral-400">{shortcut}</span>}
    </button>
  )
}
