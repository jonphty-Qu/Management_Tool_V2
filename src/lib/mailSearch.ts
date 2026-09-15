import type { Application, LinkedMail } from './applications'

/** Treffer der Postfach-Suche – mit erkannten Absagen/Einladungen. */
export interface MailHit extends LinkedMail {
  rejection: boolean
  invitation: boolean
}

// Absenderdomains von Portalen sagen nichts über das Unternehmen
const portalHosts =
  /(linkedin|stepstone|indeed|xing|arbeitsagentur|glassdoor|monster|jobware|kununu|personio|greenhouse|lever\.co|myworkdayjobs|smartrecruiters|softgarden|recruitee|join\.com|workable|bamboohr)/

function registrableDomain(host: string): string {
  return host.replace(/^www\./, '').split('.').slice(-2).join('.')
}

function domainsOf(app: Application): string[] {
  const out = new Set<string>()
  for (const link of [app.companyUrl, app.jobUrl]) {
    if (!link) continue
    try {
      const host = new URL(link).hostname
      if (!portalHosts.test(host)) out.add(registrableDomain(host))
    } catch {
      /* kein gültiger Link */
    }
  }
  return [...out]
}

/** Firmenname ohne Rechtsform – „Beispiel GmbH“ → „Beispiel“. */
function companyTerms(company: string): string[] {
  const cleaned = company
    .replace(/\b(gmbh|ag|se|kg|ug|mbh|co\.?|inc\.?|ltd\.?|e\.\s?v\.)(?=\s|$)/gi, '')
    .replace(/&\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length >= 3 ? [cleaned] : []
}

export async function searchMailsFor(app: Application): Promise<{ hits: MailHit[]; errors: string[] }> {
  const res = await fetch('/api/mail/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'management-tool' },
    body: JSON.stringify({ terms: companyTerms(app.company), domains: domainsOf(app) }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    results?: MailHit[]
    errors?: Array<{ error: string }>
    error?: string
  }
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
  return { hits: data.results ?? [], errors: (data.errors ?? []).map((e) => e.error) }
}
