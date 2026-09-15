import { useLocation } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { findTool } from '@/lib/tools'

/** Platzhalter für alle noch nicht gebauten Tools. */
export default function ToolPage() {
  const { pathname } = useLocation()
  const tool = findTool(pathname)

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {tool ? <tool.icon className="size-7" /> : <Construction className="size-7" />}
        </span>
        <h2 className="mt-4 text-lg font-semibold">{tool?.name ?? 'Nicht gefunden'}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {tool?.description ?? 'Diese Seite existiert nicht.'}
        </p>
        <p className="mt-4 text-xs text-neutral-400">
          Dieses Tool ist noch nicht gebaut – sag mir, womit wir anfangen sollen.
        </p>
      </div>
    </div>
  )
}
