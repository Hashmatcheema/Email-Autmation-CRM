'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Upload, Search, ChevronLeft, ChevronRight, Filter, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'
import { LeadsTable } from '@/components/leads/LeadsTable'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { fetchLeads } from '@/lib/services/leads'
import { LEAD_STAGES, STAGE_LABELS, type Lead } from '@/lib/types'

const DEFAULT_PAGE_SIZE = 50
const PAGE_SIZE_OPTIONS = [25, 50, 100]

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'created_at:asc', label: 'Oldest First' },
  { value: 'score:desc', label: 'Score High → Low' },
  { value: 'score:asc', label: 'Score Low → High' },
  { value: 'next_followup_date:asc', label: 'Follow-up Soonest' },
  { value: 'last_updated:desc', label: 'Last Updated' },
  { value: 'contact_name:asc', label: 'Name A–Z' },
  { value: 'account:asc', label: 'Account A–Z' },
]

const CATEGORY_OPTIONS = ['Hot', 'Warm', 'Cold', 'Not Relevant']

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

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stageFilter, setStageFilter] = useState(() => searchParams.get('stage') ?? '')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [sort, setSort] = useState('created_at:desc')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!profile) return
    async function load() {
      setLoading(true)
      setError(null)
      const [sortField, sortDir] = sort.split(':')
      const { leads: data, count, error: err } = await fetchLeads({
        page,
        pageSize,
        search: debouncedSearch,
        stage: stageFilter || undefined,
        category: categoryFilter || undefined,
        ownerEmail: ownerFilter || undefined,
        roleFilter: { role: profile!.role, email: profile!.email },
        sortBy: sortField,
        sortAscending: sortDir === 'asc',
      })
      if (err) { setError(err.message); setLoading(false); return }
      setLeads(data)
      setTotal(count)
      setLoading(false)
    }
    void load()
  }, [profile, page, pageSize, debouncedSearch, stageFilter, categoryFilter, ownerFilter, sort, refreshKey])

  const totalPages = Math.ceil(total / pageSize)
  const isAdmin = profile?.role === 'admin'
  const hasFilters = stageFilter || categoryFilter || ownerFilter || debouncedSearch || sort !== 'created_at:desc'

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
              Import CSV
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

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, company, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-8 text-sm"
          />
        </div>

        <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v ?? ''); setPage(0) }}>
          <SelectTrigger className="w-[150px] text-sm">
            <Filter className="mr-1 h-3.5 w-3.5 text-slate-400" />
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Stages</SelectItem>
            {LEAD_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v ?? ''); setPage(0) }}>
          <SelectTrigger className="w-[130px] text-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => { setSort(v ?? 'created_at:desc'); setPage(0) }}>
          <SelectTrigger className="w-[170px] text-sm">
            <ArrowUpDown className="mr-1 h-3.5 w-3.5 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <div className="relative min-w-[150px]">
            <Input
              placeholder="Filter by owner email…"
              value={ownerFilter}
              onChange={(e) => { setOwnerFilter(e.target.value); setPage(0) }}
              className="text-sm"
            />
          </div>
        )}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700"
            onClick={() => {
              setSearch('')
              setStageFilter('')
              setCategoryFilter('')
              setOwnerFilter('')
              setSort('created_at:desc')
              setPage(0)
            }}
          >
            Clear
          </Button>
        )}
      </div>

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
        <LeadsTable leads={leads} onRefresh={() => setRefreshKey((k) => k + 1)} />
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
