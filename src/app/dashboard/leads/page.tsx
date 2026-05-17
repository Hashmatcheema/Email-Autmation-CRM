'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Upload, Search, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'
import { LeadsTable, type ColFilters } from '@/components/leads/LeadsTable'
import { BulkActionBar } from '@/components/leads/BulkActionBar'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { fetchLeads } from '@/lib/services/leads'
import {
  STAGE_LABELS, LEAD_SOURCE_LABELS,
  CLIENT_RELATIONSHIP_LABELS, COMPANY_TYPE_LABELS,
  type Lead,
} from '@/lib/types'

const DEFAULT_PAGE_SIZE = 50
const PAGE_SIZE_OPTIONS = [25, 50, 100]

const DEFAULT_COL_FILTERS: ColFilters = {
  stage: '',
  category: '',
  score: '',
  hiring: '',
  source: '',
  relationship: '',
  companyType: '',
  followup: '',
  owner: '',
}

// Human-readable label for each filter value
const SCORE_LABELS: Record<string, string> = {
  '80plus': 'Score 80+',
  '90plus': 'Score 90+',
  '100': 'Score 100',
  '1to79': 'Score 1–79',
  '0': 'Score 0',
}

const HIRING_LABELS: Record<string, string> = {
  active_contract_hiring: 'Contract Hiring',
  active_fulltime_hiring: 'Full-Time Hiring',
  active_hiring: 'Active Hiring',
  weak_hiring: 'Weak Hiring',
  no_signal: 'No Hiring Signal',
  unknown: 'Hiring Unknown',
}

const FOLLOWUP_LABELS: Record<string, string> = {
  today: 'Follow-up: Today',
  overdue: 'Follow-up: Overdue',
  upcoming: 'Follow-up: Upcoming',
  none: 'No Follow-up Date',
}

function getChipLabel(key: keyof ColFilters, value: string): string {
  if (!value) return ''
  switch (key) {
    case 'stage': return `Stage: ${STAGE_LABELS[value] ?? value}`
    case 'category': return `Cat: ${value}`
    case 'score': return SCORE_LABELS[value] ?? value
    case 'hiring': return HIRING_LABELS[value] ?? value
    case 'source': return `Source: ${LEAD_SOURCE_LABELS[value] ?? value}`
    case 'relationship': return `Rel: ${CLIENT_RELATIONSHIP_LABELS[value] ?? value}`
    case 'companyType': return `Type: ${COMPANY_TYPE_LABELS[value] ?? value}`
    case 'followup': return FOLLOWUP_LABELS[value] ?? value
    case 'owner': return `Owner: ${value}`
    default: return value
  }
}

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsPageContent />
    </Suspense>
  )
}

function LeadsPageContent() {
  const searchParams = useSearchParams()
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [colFilters, setColFilters] = useState<ColFilters>(() => ({
    ...DEFAULT_COL_FILTERS,
    stage: searchParams.get('stage') ?? '',
    followup: searchParams.get('followup') ?? '',
  }))

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  function setColFilter(key: keyof ColFilters, value: string) {
    setColFilters(prev => ({ ...prev, [key]: value }))
    setPage(0)
  }

  function toggleSelect(leadId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(leadId)) next.delete(leadId)
      else next.add(leadId)
      return next
    })
  }

  function toggleSelectAllOnPage(pageLeadIds: string[]) {
    setSelectedIds((prev) => {
      const allSelected = pageLeadIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        for (const id of pageLeadIds) next.delete(id)
      } else {
        for (const id of pageLeadIds) next.add(id)
      }
      return next
    })
  }

  function clearSelection() { setSelectedIds(new Set()) }

  function handleBulkApplied() {
    clearSelection()
    setRefreshKey((k) => k + 1)
  }

  useEffect(() => {
    if (!profile) return
    async function load() {
      setLoading(true)
      setError(null)
      const { leads: data, count, error: err } = await fetchLeads({
        page,
        pageSize,
        search: debouncedSearch,
        stage: colFilters.stage || undefined,
        category: colFilters.category || undefined,
        ownerEmail: colFilters.owner || undefined,
        hiringSignal: colFilters.hiring || undefined,
        companyType: colFilters.companyType || undefined,
        clientRelationship: colFilters.relationship || undefined,
        leadSource: colFilters.source || undefined,
        scoreFilter: colFilters.score || undefined,
        followupFilter: colFilters.followup || undefined,
        roleFilter: { role: profile!.role, email: profile!.email },
        sortBy: 'created_at',
        sortAscending: false,
      })
      if (err) { setError(err.message); setLoading(false); return }
      setLeads(data)
      setTotal(count)
      setLoading(false)
    }
    void load()
  }, [profile, page, pageSize, debouncedSearch, colFilters, refreshKey])

  const totalPages = Math.ceil(total / pageSize)
  const isAdmin = profile?.role === 'admin'

  const hasFilters = !!debouncedSearch || Object.values(colFilters).some(v => v !== '')

  // Active filter chips (only column filters, not search)
  const activeChips = (Object.entries(colFilters) as [keyof ColFilters, string][])
    .filter(([, v]) => v !== '')
    .map(([key, value]) => ({ key, label: getChipLabel(key, value) }))

  function clearAllFilters() {
    setSearch('')
    setColFilters(DEFAULT_COL_FILTERS)
    setPage(0)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Leads</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {loading ? '…' : `${total} lead${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/dashboard/leads/import"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            >
              <Upload className="h-4 w-4" />
              Import
            </Link>
          )}
          <Link
            href="/dashboard/leads/new"
            className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 bg-blue-600 hover:bg-blue-700')}
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </Link>
        </div>
      </div>

      {/* Filter bar — single search input */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, company, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-8 text-sm"
          />
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-slate-500 hover:text-slate-700"
            onClick={clearAllFilters}
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChips.map(({ key, label }) => (
            <span
              key={key}
              className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
            >
              {label}
              <button
                type="button"
                onClick={() => setColFilter(key, '')}
                className="ml-0.5 rounded-full hover:bg-blue-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load leads</p>
          <p className="mt-1 text-xs text-red-500">{error}</p>
        </div>
      ) : (
        <>
          {selectedIds.size > 0 && profile && (
            <BulkActionBar
              selectedIds={Array.from(selectedIds)}
              performedBy={profile.email}
              isAdmin={isAdmin}
              onClear={clearSelection}
              onApplied={handleBulkApplied}
            />
          )}
          <LeadsTable
            leads={leads}
            onRefresh={() => setRefreshKey((k) => k + 1)}
            colFilters={colFilters}
            onColFilterChange={setColFilter}
            isAdmin={isAdmin}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAllOnPage}
          />
        </>
      )}

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">
              {totalPages > 0
                ? `Page ${page + 1} of ${totalPages} · ${total} total`
                : `${total} total`}
            </p>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v ?? DEFAULT_PAGE_SIZE)); setPage(0) }}
            >
              <SelectTrigger className="h-7 w-[80px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
