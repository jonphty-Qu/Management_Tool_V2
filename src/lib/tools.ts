import {
  LayoutDashboard,
  Mail,
  FolderKanban,
  CalendarDays,
  NotebookPen,
  Users,
  Wallet,
  FileText,
  Timer,
  Briefcase,
  Bookmark,
  Target,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type ToolGroup = 'Übersicht' | 'Arbeit' | 'Wissen' | 'Persönlich' | 'System'

export interface Tool {
  id: string
  name: string
  path: string
  icon: LucideIcon
  group: ToolGroup
  description: string
  /** Zusätzliche Begriffe, über die das Tool gefunden werden soll. */
  keywords?: string[]
  badge?: number
}

export const tools: Tool[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    group: 'Übersicht',
    description: 'Überblick über alles Wichtige',
    keywords: ['start', 'home', 'übersicht'],
  },
  {
    id: 'mail',
    name: 'E-Mails',
    path: '/mail',
    icon: Mail,
    group: 'Übersicht',
    description: 'Neue Mails aus allen Postfächern',
    keywords: ['mail', 'email', 'posteingang', 'inbox', 'gmail', 'postfach'],
  },
  {
    id: 'projects',
    name: 'Projekte',
    path: '/projects',
    icon: FolderKanban,
    group: 'Arbeit',
    description: 'Mehrere Projekte mit Aufgaben-Boards',
    keywords: ['kanban', 'board', 'aufgabe', 'todo', 'task'],
  },
  {
    id: 'applications',
    name: 'Bewerbungen',
    path: '/applications',
    icon: Briefcase,
    group: 'Arbeit',
    description: 'Stellen, Status und Links im Blick',
    keywords: ['bewerbung', 'job', 'stelle', 'absage', 'zusage'],
  },
  {
    id: 'calendar',
    name: 'Kalender',
    path: '/calendar',
    icon: CalendarDays,
    group: 'Arbeit',
    description: 'Termine, Deadlines und Planung',
    keywords: ['termin', 'event', 'planung'],
  },
  {
    id: 'time',
    name: 'Zeiterfassung',
    path: '/time',
    icon: Timer,
    group: 'Arbeit',
    description: 'Arbeitszeiten und Auswertung',
    keywords: ['timer', 'tracking', 'stunden'],
  },
  {
    id: 'notes',
    name: 'Notizen',
    path: '/notes',
    icon: NotebookPen,
    group: 'Wissen',
    description: 'Notizen, Ideen und Snippets',
    keywords: ['note', 'idee', 'markdown'],
  },
  {
    id: 'documents',
    name: 'Dokumente',
    path: '/documents',
    icon: FileText,
    group: 'Wissen',
    description: 'Dateien, Verträge und Ablage',
    keywords: ['datei', 'file', 'ablage', 'pdf', 'upload', 'vertrag', 'rechnung'],
  },
  {
    id: 'bookmarks',
    name: 'Lesezeichen',
    path: '/bookmarks',
    icon: Bookmark,
    group: 'Wissen',
    description: 'Links und Ressourcen sammeln',
    keywords: ['link', 'url', 'favoriten'],
  },
  {
    id: 'contacts',
    name: 'Kontakte',
    path: '/contacts',
    icon: Users,
    group: 'Persönlich',
    description: 'Personen, Firmen und Verläufe',
    keywords: ['crm', 'person', 'adressbuch'],
  },
  {
    id: 'finance',
    name: 'Finanzen',
    path: '/finance',
    icon: Wallet,
    group: 'Persönlich',
    description: 'Einnahmen, Ausgaben und Budgets',
    keywords: ['geld', 'budget', 'rechnung', 'ausgaben'],
  },
  {
    id: 'habits',
    name: 'Gewohnheiten',
    path: '/habits',
    icon: Target,
    group: 'Persönlich',
    description: 'Routinen und Streaks verfolgen',
    keywords: ['habit', 'routine', 'streak', 'ziele'],
  },
  {
    id: 'reports',
    name: 'Berichte',
    path: '/reports',
    icon: BarChart3,
    group: 'System',
    description: 'Auswertungen über alle Bereiche',
    keywords: ['statistik', 'analytics', 'auswertung'],
  },
  {
    id: 'settings',
    name: 'Einstellungen',
    path: '/settings',
    icon: Settings,
    group: 'System',
    description: 'Profil, Darstellung und Daten',
    keywords: ['config', 'profil', 'theme', 'optionen'],
  },
]

export const groupOrder: ToolGroup[] = ['Übersicht', 'Arbeit', 'Wissen', 'Persönlich', 'System']

export function toolsByGroup() {
  return groupOrder
    .map((group) => ({ group, items: tools.filter((t) => t.group === group) }))
    .filter((g) => g.items.length > 0)
}

export function searchTools(query: string): Tool[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return tools.filter((t) => {
    const haystack = [t.name, t.description, ...(t.keywords ?? [])].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}

export function findTool(pathname: string): Tool | undefined {
  return tools.find((t) => t.path === pathname)
}
