const base = process.env.MT_URL || 'http://localhost:5180'
async function call(path, body) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'management-tool' }, body: JSON.stringify(body) })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}
;(async () => {
const job = await call('/api/jobs/parse', { url: 'https://example.com' })
if (job.status !== 200 || !job.body.url) throw new Error(`Stellenimport fehlgeschlagen: ${job.status}`)
const ftp = await call('/api/jobs/parse', { url: 'ftp://example.com/job' })
if (ftp.status !== 400) throw new Error(`FTP-Ablehnung fehlgeschlagen: ${ftp.status}`)
const mail = await call('/api/mail/search', { terms: ['Example'], domains: ['example.com'] })
if (![200, 409].includes(mail.status)) throw new Error(`E-Mail-Endpunkt unerwartet: ${mail.status}`)
const backup = await call('/api/backup/export', { storage: { 'mt.theme': 'light', 'mt.applications': '[]' } })
if (backup.status !== 200 || backup.body.format !== 'management-tool' || !Array.isArray(backup.body.files)) throw new Error(`Sicherungsexport fehlgeschlagen: ${backup.status}`)
console.log(`Integration checks passed: job import (${job.body.via}), FTP rejection, mail endpoint (${mail.status}), backup export.`)
})().catch((error) => { console.error(error.message); process.exitCode = 1 })
