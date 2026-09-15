import DocumentsPanel from '@/components/applications/DocumentsPanel'
import { useDocuments } from '@/lib/documents'

/** Allgemeine Ablage – Dateien einfach irgendwo ins Fenster ziehen. */
export default function Documents() {
  const docs = useDocuments()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Dokumente</h2>
        <p className="text-sm text-neutral-500">
          Verträge, Rechnungen, Bescheide … Einfach eine Datei ins Fenster ziehen – sie wird sofort abgelegt.
        </p>
      </div>

      <DocumentsPanel docs={docs} space="ablage" dropScope="window" />
    </div>
  )
}
