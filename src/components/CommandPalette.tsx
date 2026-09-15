import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft, ExternalLink } from 'lucide-react'
import { searchTools, tools, type Tool } from '@/lib/tools'
import { byUsage, hostOf, loadBookmarks, recordOpen, searchBookmarks, type Bookmark } from '@/lib/bookmarks'
import { openExternal } from '@/lib/external'
import { cn } from '@/lib/cn'

interface Props {
  open: boolean
  onClose: () => void
}

type Item = { kind: 'tool'; key: string; tool: Tool } | { kind: 'bookmark'; key: string; bookmark: Bookmark }

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Beim Öffnen frisch laden – Lesezeichen können sich inzwischen geändert haben
  const bookmarks = useMemo(() => (open ? loadBookmarks() : []), [open])

  const { toolItems, bookmarkItems } = useMemo(() => {
    const q = query.trim()
    const foundTools = q ? searchTools(q) : tools.slice(0, 6)
    // Ohne Suchbegriff: die angehefteten Favoriten als Schnellzugriff
    const foundBookmarks = (q ? searchBookmarks(bookmarks, q) : bookmarks.filter((b) => b.pinned))
      .sort(byUsage)
      .slice(0, q ? 6 : 4)
    return {
      toolItems: foundTools.map((tool): Item => ({ kind: 'tool', key: `tool-${tool.id}`, tool })),
      bookmarkItems: foundBookmarks.map((bookmark): Item => ({ kind: 'bookmark', key: bookmark.id, bookmark })),
    }
  }, [query, bookmarks])

  const items = useMemo(() => [...toolItems, ...bookmarkItems], [toolItems, bookmarkItems])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => setActive(0), [query])

  if (!open) return null

  const select = (index: number) => {
    const item = items[index]
    if (!item) return
    if (item.kind === 'tool') {
      navigate(item.tool.path)
    } else {
      recordOpen(item.bookmark.id)
      void openExternal(item.bookmark.url)
    }
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % Math.max(items.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + items.length) % Math.max(items.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      select(active)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const renderItem = (item: Item, index: number) => {
    const isActive = index === active
    return (
      <li key={item.key}>
        <button
          type="button"
          onMouseEnter={() => setActive(index)}
          onClick={() => select(index)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition',
            isActive ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
          )}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {item.kind === 'tool' ? (
              <item.tool.icon className="size-4" />
            ) : (
              <ExternalLink className="size-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {item.kind === 'tool' ? item.tool.name : item.bookmark.title}
            </span>
            <span className="block truncate text-xs text-neutral-500">
              {item.kind === 'tool'
                ? item.tool.description
                : `${hostOf(item.bookmark.url)} · ${item.bookmark.group}`}
            </span>
          </span>
          {isActive && <CornerDownLeft className="size-4 shrink-0 text-neutral-400" />}
        </button>
      </li>
    )
  }

  const heading = (text: string) => (
    <div className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">{text}</div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
          <Search className="size-[18px] shrink-0 text-neutral-400" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Tools und Lesezeichen durchsuchen…"
            className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-neutral-400"
          />
          <kbd className="rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-400 dark:border-neutral-700">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-neutral-500">Keine Treffer für „{query}“</div>
          ) : (
            <>
              {toolItems.length > 0 && (
                <>
                  {heading(query.trim() ? 'Tools' : 'Schnellzugriff')}
                  <ul>{toolItems.map((item, i) => renderItem(item, i))}</ul>
                </>
              )}
              {bookmarkItems.length > 0 && (
                <>
                  {heading(query.trim() ? 'Lesezeichen' : 'Favoriten')}
                  <ul>{bookmarkItems.map((item, i) => renderItem(item, toolItems.length + i))}</ul>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-neutral-200 px-4 py-2.5 text-[11px] text-neutral-400 dark:border-neutral-800">
          <span>↑↓ Navigieren</span>
          <span>↵ Öffnen</span>
          <span>ESC Schließen</span>
        </div>
      </div>
    </div>
  )
}
