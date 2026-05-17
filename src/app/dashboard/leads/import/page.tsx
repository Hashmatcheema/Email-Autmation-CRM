'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { ArrowLeft, Upload, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/services/activities'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { buttonVariants } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  COMPANY_TYPE_OPTIONS,
  CLIENT_RELATIONSHIP_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  HIRING_SIGNAL_OPTIONS,
} from '@/lib/types'

const CRM_FIELDS = [
  { value: '', label: '— Skip —' },
  { value: 'contact_name', label: 'Contact Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'account', label: 'Account / Company' },
  { value: 'company_domain', label: 'Website / Domain' },
  { value: 'company_type', label: 'Company Type' },
  { value: 'industry', label: 'Industry' },
  { value: 'size', label: 'Company Size' },
  { value: 'client_relationship', label: 'Relationship' },
  { value: 'lead_source', label: 'Lead Source' },
  { value: 'lead_owner_email', label: 'Owner Email' },
  { value: 'lead_owner_name', label: 'Owner Name' },
  { value: 'hiring_signal', label: 'Hiring Signal' },
  { value: 'score', label: 'Score' },
  { value: 'notes', label: 'Notes' },
  { value: 'category', label: 'Category' },
]

function autoDetectMapping(headers: string[]): Record<number, string> {
  const hints: Record<string, string> = {
    name: 'contact_name', contact: 'contact_name', 'contact name': 'contact_name',
    email: 'email', 'email address': 'email',
    phone: 'phone', mobile: 'phone', telephone: 'phone',
    company: 'account', account: 'account', organization: 'account', organisation: 'account',
    domain: 'company_domain', website: 'company_domain',
    type: 'company_type', 'company type': 'company_type',
    industry: 'industry', sector: 'industry',
    size: 'size', 'company size': 'size',
    relationship: 'client_relationship',
    source: 'lead_source', 'lead source': 'lead_source',
    owner: 'lead_owner_email', 'owner email': 'lead_owner_email',
    'owner name': 'lead_owner_name',
    hiring: 'hiring_signal', 'hiring signal': 'hiring_signal',
    score: 'score',
    notes: 'notes', note: 'notes', description: 'notes',
    category: 'category',
  }
  const mapping: Record<number, string> = {}
  headers.forEach((h, i) => {
    const key = h.toLowerCase().replace(/[_-]/g, ' ')
    if (hints[key]) mapping[i] = hints[key]
  })
  return mapping
}

const CONSTRAINED: Record<string, string[]> = {
  company_type: [...COMPANY_TYPE_OPTIONS],
  client_relationship: [...CLIENT_RELATIONSHIP_OPTIONS],
  lead_source: [...LEAD_SOURCE_OPTIONS],
  hiring_signal: [...HIRING_SIGNAL_OPTIONS],
}

function sanitize(field: string, value: string): string {
  const allowed = CONSTRAINED[field]
  if (!allowed) return value
  const lower = value.toLowerCase()
  return allowed.includes(lower) ? lower : (field === 'lead_source' ? 'csv_import' : 'unknown')
}

interface ImportResult {
  imported: number
  failed: number
  errors: string[]
  automationOk: boolean | null
  automationMessage: string | null
}

const ACCEPTED_EXTS = ['.csv', '.tsv', '.xlsx', '.xls']
const ACCEPT_ATTR = '.csv,text/csv,.tsv,text/tab-separated-values,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'

function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function parseDelimited(text: string, delimiter: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }

  function parseRow(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQuotes = !inQuotes }
      else if (c === delimiter && !inQuotes) { result.push(current.trim()); current = '' }
      else { current += c }
    }
    result.push(current.trim())
    return result
  }

  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) }
}

function parseWorkbook(buf: ArrayBuffer): { headers: string[]; rows: string[][]; sheetName: string; sheetCount: number } {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [], sheetName: '', sheetCount: 0 }
  const sheet = wb.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: '' })
  const headers = (aoa[0] ?? []).map((v) => String(v ?? '').trim())
  const rows = aoa.slice(1).map((r) => r.map((v) => String(v ?? '').trim()))
  return { headers, rows, sheetName, sheetCount: wb.SheetNames.length }
}

export default function ImportCSVPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = getSupabaseBrowserClient()

  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [fileMeta, setFileMeta] = useState<{ name: string; ext: string; sheetName?: string; sheetCount?: number } | null>(null)
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  function handleFile(file: File) {
    const ext = getExt(file.name)
    if (!ACCEPTED_EXTS.includes(ext)) {
      toast.error(`Unsupported file type: ${ext || 'unknown'}. Use CSV, TSV, XLSX or XLS.`)
      return
    }

    if (ext === '.xlsx' || ext === '.xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const buf = e.target?.result as ArrayBuffer
        const { headers, rows, sheetName, sheetCount } = parseWorkbook(buf)
        if (headers.length === 0) {
          toast.error('Could not read sheet — no headers found in first row')
          return
        }
        setCsvData({ headers, rows })
        setFileMeta({ name: file.name, ext, sheetName, sheetCount })
        setMapping(autoDetectMapping(headers))
        setResult(null)
        if (sheetCount > 1) {
          toast.message(`Workbook has ${sheetCount} sheets — using "${sheetName}"`)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const delimiter = ext === '.tsv' ? '\t' : ','
        const parsed = parseDelimited(text, delimiter)
        if (parsed.headers.length === 0) {
          toast.error('Could not parse file — no headers found')
          return
        }
        setCsvData(parsed)
        setFileMeta({ name: file.name, ext })
        setMapping(autoDetectMapping(parsed.headers))
        setResult(null)
      }
      reader.readAsText(file)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    if (!csvData) return
    setImporting(true)

    const now = new Date().toISOString()
    const rows: Record<string, unknown>[] = []
    const errors: string[] = []

    csvData.rows.forEach((row, idx) => {
      const obj: Record<string, unknown> = {}
      Object.entries(mapping).forEach(([colIdx, crmField]) => {
        if (!crmField) return
        const raw = row[Number(colIdx)] ?? ''
        if (!raw) return
        if (CONSTRAINED[crmField]) {
          obj[crmField] = sanitize(crmField, raw)
        } else if (crmField === 'score') {
          const n = parseFloat(raw)
          if (!isNaN(n)) obj[crmField] = n
        } else {
          obj[crmField] = raw
        }
      })

      if (!obj.contact_name && !obj.email) {
        errors.push(`Row ${idx + 2}: skipped — no contact name or email`)
        return
      }
      if (obj.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(obj.email))) {
        errors.push(`Row ${idx + 2}: invalid email "${obj.email}" — skipped`)
        return
      }

      rows.push({
        ...obj,
        stage: (obj.stage as string) || 'new',
        lead_source: (obj.lead_source as string) || 'csv_import',
        company_type: (obj.company_type as string) || 'unknown',
        client_relationship: (obj.client_relationship as string) || 'unknown',
        hiring_signal: (obj.hiring_signal as string) || 'unknown',
        created_at: now,
        last_updated: now,
        created_by_email: profile?.email ?? null,
        created_by_name: profile?.name ?? null,
      })
    })

    let imported = 0
    let failed = 0
    const importedIds: string[] = []

    if (rows.length > 0) {
      const BATCH = 50
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH)
        const { data, error } = await supabase
          .from('leads')
          .insert(batch)
          .select('lead_id')
        if (error) {
          failed += batch.length
          errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`)
        } else {
          imported += batch.length
          // Log activity for each imported lead
          const ids = (data as { lead_id: string }[]).map((r) => r.lead_id)
          importedIds.push(...ids)
          await Promise.all(
            ids.map((id) =>
              logActivity(id, 'lead_created', `Imported from CSV by ${profile?.email ?? 'unknown'}`, profile?.email ?? 'unknown')
            )
          )
        }
      }
    }

    // Best-effort: notify n8n CSV import workflow for enrichment / scoring.
    // DB inserts above are the source of truth; webhook failure does not block.
    let automationOk: boolean | null = null
    let automationMessage: string | null = null
    if (importedIds.length > 0) {
      automationOk = false
      try {
        const res = await fetch('/api/n8n/leads/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'csv_import',
            created_by_email: profile?.email ?? null,
            created_by_name: profile?.name ?? null,
            default_lead_owner_email: profile?.email ?? null,
            default_lead_owner_name: profile?.name ?? null,
            lead_ids: importedIds,
            records: rows,
          }),
        })
        if (res.ok) {
          automationOk = true
        } else {
          const j = (await res.json().catch(() => ({}))) as { error?: string; upstream_status?: number }
          if (res.status === 503) {
            automationMessage = 'Automation is not configured on this server.'
          } else if (j.upstream_status === 404 || res.status === 404) {
            automationMessage = 'n8n import webhook returned 404 (test webhook not armed).'
          } else {
            automationMessage = j.error ?? `n8n import webhook returned ${res.status}.`
          }
        }
      } catch {
        automationMessage = 'Could not reach the automation webhook.'
      }
    }

    setResult({
      imported,
      failed: failed + errors.filter((e) => e.includes('skipped')).length,
      errors,
      automationOk,
      automationMessage,
    })
    setImporting(false)

    if (imported > 0) {
      toast.success(`${imported} lead${imported !== 1 ? 's' : ''} imported`)
    }
  }

  const mappedFields = new Set(Object.values(mapping).filter(Boolean))
  const hasMandatory = mappedFields.has('contact_name') || mappedFields.has('email')

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/leads" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8')}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h2 className="text-base font-semibold text-slate-900">Import Results</h2>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-slate-900">{result.imported}</p>
                <p className="text-xs text-slate-500">Imported</p>
              </div>
            </div>
            {result.failed > 0 && (
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{result.failed}</p>
                  <p className="text-xs text-slate-500">Skipped / Failed</p>
                </div>
              </div>
            )}
          </div>

          {result.imported > 0 && result.automationOk === false && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                {result.imported} lead{result.imported !== 1 ? 's' : ''} imported successfully.
                Automation did not run, so scoring/enrichment may need to be refreshed.
              </p>
              {result.automationMessage && (
                <p className="mt-1 text-xs text-amber-700">{result.automationMessage}</p>
              )}
            </div>
          )}

          {result.imported > 0 && result.automationOk === true && (
            <p className="text-xs text-slate-500">Automation notified — enrichment will run in the background.</p>
          )}

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-2">Issues:</p>
              <ul className="space-y-1">
                {result.errors.slice(0, 20).map((e, i) => (
                  <li key={i} className="text-xs text-amber-700">{e}</li>
                ))}
                {result.errors.length > 20 && (
                  <li className="text-xs text-amber-600">…and {result.errors.length - 20} more</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={() => router.push('/dashboard/leads')} className="bg-blue-600 hover:bg-blue-700">
              View Leads
            </Button>
            <Button variant="outline" onClick={() => { setCsvData(null); setFileMeta(null); setResult(null) }}>
              Import Another
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/leads" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8')}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Import Leads</h2>
          <p className="text-xs text-slate-500">Upload a CSV, TSV, or Excel file, map columns, then import</p>
        </div>
      </div>

      {!csvData ? (
        <div
          className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center cursor-pointer hover:border-blue-400 transition-colors"
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mx-auto h-10 w-10 text-slate-300 mb-4" />
          <p className="text-sm font-medium text-slate-700">Drop a spreadsheet here or click to browse</p>
          <p className="mt-1 text-xs text-slate-400">CSV · TSV · XLSX · XLS — first row must be headers</p>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple={false}
            className="hidden"
            onChange={onFileChange}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {fileMeta && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-500" />
              <p className="text-xs text-slate-700">
                <span className="font-medium">{fileMeta.name}</span>
                <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 border border-slate-200">
                  {fileMeta.ext.replace('.', '')}
                </span>
                {fileMeta.sheetName && (
                  <span className="ml-2 text-slate-500">
                    sheet: <span className="font-medium text-slate-700">{fileMeta.sheetName}</span>
                    {fileMeta.sheetCount && fileMeta.sheetCount > 1 ? ` (1 of ${fileMeta.sheetCount})` : ''}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Column Mapping */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Map Columns</h3>
            <p className="text-xs text-slate-500">
              {csvData.rows.length} rows detected. Match CSV columns to CRM fields.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {csvData.headers.map((h, idx) => (
                <div key={idx} className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{h}</Label>
                  <Select
                    value={mapping[idx] ?? ''}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [idx]: v ?? '' }))}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="— Skip —" />
                    </SelectTrigger>
                    <SelectContent>
                      {CRM_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!hasMandatory && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">Map at least <strong>Contact Name</strong> or <strong>Email</strong> to enable import.</p>
              </div>
            )}
          </div>

          {/* Preview Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview (first 5 rows)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {csvData.headers.map((h, i) => (
                      <th key={i} className="px-4 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">
                        {h}
                        {mapping[i] && (
                          <span className="ml-1 text-blue-500">→ {CRM_FIELDS.find((f) => f.value === mapping[i])?.label}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {csvData.rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri}>
                      {csvData.headers.map((_, ci) => (
                        <td key={ci} className="px-4 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                          {row[ci] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvData.rows.length > 5 && (
              <p className="px-6 py-2 text-xs text-slate-400 border-t border-slate-100">
                …and {csvData.rows.length - 5} more rows
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={importing || !hasMandatory}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {importing ? 'Importing…' : `Import ${csvData.rows.length} Rows`}
            </Button>
            <Button variant="outline" onClick={() => { setCsvData(null); setFileMeta(null); setMapping({}) }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
