import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, Boxes } from 'lucide-react'
import QuickAdd from './QuickAdd'
import { toolsByGroup } from '@/lib/tools'
import { cn } from '@/lib/cn'

interface Props {
  collapsed: boolean
  onToggle: () => void
  /** Auf Mobile wird die Sidebar als Overlay eingeblendet. */
  mobileOpen: boolean
  onCloseMobile: () => void
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: Props) {
  const groups = toolsByGroup()

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-neutral-200 bg-white transition-[width,transform] duration-200',
          'dark:border-neutral-800 dark:bg-neutral-900',
          'lg:static lg:translate-x-0',
          collapsed ? 'w-[68px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
            <Boxes className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Management</div>
              <div className="truncate text-xs text-neutral-500">Workspace</div>
            </div>
          )}
        </div>

        {/* Schnellanlage */}
        <QuickAdd collapsed={collapsed} onNavigate={onCloseMobile} />

        {/* Tool-Liste */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {groups.map(({ group, items }) => (
            <div key={group}>
              {!collapsed && (
                <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                  {group}
                </div>
              )}
              <ul className="space-y-0.5">
                {items.map((tool) => (
                  <li key={tool.id}>
                    <NavLink
                      to={tool.path}
                      end={tool.path === '/'}
                      onClick={onCloseMobile}
                      title={collapsed ? tool.name : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                          collapsed && 'justify-center px-0',
                          isActive
                            ? 'bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white',
                        )
                      }
                    >
                      <tool.icon className="size-[18px] shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{tool.name}</span>
                          {tool.badge ? (
                            <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                              {tool.badge}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Ein-/Ausklappen */}
        <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'hidden w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-500 transition',
              'hover:bg-neutral-100 hover:text-neutral-900 lg:flex dark:hover:bg-neutral-800 dark:hover:text-white',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" />
            ) : (
              <>
                <PanelLeftClose className="size-[18px]" />
                <span>Einklappen</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
