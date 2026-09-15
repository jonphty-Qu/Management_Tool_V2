import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  CalendarPlus,
  Cake,
  FolderKanban,
  Briefcase,
  FileUp,
  Wallet,
  Link2,
  ArrowRight,
  NotebookPen,
} from 'lucide-react'
import { cn } from '@/lib/cn'

/** Die Zielseiten lesen den Parameter `neu` und öffnen den passenden Dialog. */
const items = [
  { label: 'Termin', icon: CalendarPlus, to: '/calendar?neu=termin' },
  { label: 'Tag / Geburtstag', icon: Cake, to: '/calendar?neu=tag' },
  { label: 'Aufgabe', icon: FolderKanban, to: '/projects?neu=aufgabe' },
  { label: 'Notiz', icon: NotebookPen, to: '/notes?neu=notiz' },
  { label: 'Bewerbung', icon: Briefcase, to: '/applications?neu=bewerbung' },
  { label: 'Unterlage hochladen', icon: FileUp, to: '/applications?tab=unterlagen' },
  { label: 'Finanzeintrag', icon: Wallet, to: '/finance?neu=eintrag' },
]

interface Props {
  collapsed: boolean
  /** Auf Mobile die Sidebar nach der Auswahl schließen. */
  onNavigate?: () => void
}

export default function QuickAdd({ collapsed, onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (path: string) => {
    setOpen(false)
    setLink('')
    onNavigate?.()
    navigate(path)
  }

  const importLink = (raw: string) => {
    const url = raw.trim()
    if (url) go(`/applications?import=${encodeURIComponent(url)}`)
  }

  return (
    <div className="relative px-3 pb-2" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Neu anlegen"
        className={cn(
          'flex w-full items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white',
          'transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200',
          collapsed && 'justify-center px-0',
        )}
      >
        <Plus className={cn('size-4 shrink-0 transition', open && 'rotate-45')} />
        {!collapsed && <span>Neu</span>}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-3 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg shadow-black/5 dark:border-neutral-800 dark:bg-neutral-900"
        >
          {/* Stelle per Link – legt die Bewerbung direkt an */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              importLink(link)
            }}
            className="border-b border-neutral-200 p-2 dark:border-neutral-800"
          >
            <span className="block px-1 pb-1 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
              Stelle per Link
            </span>
            <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2 focus-within:border-neutral-400 dark:border-neutral-700 dark:focus-within:border-neutral-500">
              <Link2 className="size-3.5 shrink-0 text-neutral-400" />
              <input
                autoFocus
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text').trim()
                  if (/^(https?:\/\/|www\.)\S+$/i.test(pasted)) {
                    e.preventDefault()
                    importLink(pasted)
                  }
                }}
                placeholder="Link einfügen…"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-neutral-400"
              />
              <button
                type="submit"
                disabled={!link.trim()}
                aria-label="Bewerbung anlegen"
                className="rounded p-0.5 text-neutral-400 transition hover:text-neutral-900 disabled:opacity-30 dark:hover:text-white"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>

          <div className="p-1.5">
            {items.map((item) => (
              <button
                key={item.to}
                type="button"
                role="menuitem"
                onClick={() => go(item.to)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <item.icon className="size-[18px] shrink-0" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
