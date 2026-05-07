'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'
import { LeadsTable } from '@/components/leads/LeadsTable'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { fetchLeads, LEADS_PAGE_SIZE } from '@/lib/services/leads'
import { LEAD_STAGES, STAGE_LABELS, type Lead } from '@/lib/types'

export default function LeadsPage() {
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [hiringFilter, setHiringFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [ownerFilter, setOwnerFilter] = useState('')

  // Debounce search — resets page handled in onChange
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!profile) return
    async function load() {
      setLoading(true)
      setError(null)
      const hiringSignal =
        hiringFilter === 'yes' ? 'Yes' : hiringFilter === 'no' ? 'No' : null
      const { leads: data, count, error: err } = await fetchLeads({
        page,
        search: debouncedSearch,
        stage: stageFilter || undefined,
        ownerEmail: ownerFilter || undefined,
        hiringSignal: hiringSignal ?? undefined,
        roleFilter: { role: profile!.role, email: profile!.email },
      })
      if (err) { setError(err.message); setLoading(false); return }
      setLeads(data)
      setTotal(count)
      setLoading(false)
    }
    load()
  }, [profile, page, debouncedSearch, stageFilter, hiringFilter, ownerFilter])

  const totalPages = Math.ceil(total / LEADS_PAGE_SIZE)
  const isAdmin = profile?.role === 'admin'

  const hasFilters = stageFilter || hiringFilter !== 'all' || ownerFilter || debouncedSearch

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Leads</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading ? '…' : `${total} lead${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/dashboard/leads/new"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 bg-blue-600 hover:bg-blue-700')}
        >
          <Plus className="h-4 w-4" />
          Add Lead
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, company, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-8 text-sm"
          />
        </div>

        <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v ?? ''); setPage(0) }}>
          <SelectTrigger className="w-[160px] text-sm">
            <Filter className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Stages</SelectItem>
            {LEAD_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={hiringFilter} onValueChange={(v) => { setHiringFilter((v ?? 'all') as typeof hiringFilter); setPage(0) }}>
          <SelectTrigger className="w-[140px] text-sm">
            <SelectValue placeholder="Hiring Signal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hiring: All</SelectItem>
            <SelectItem value="yes">Hiring: Yes</SelectItem>
            <SelectItem value="no">Hiring: No</SelectItem>
          </SelectContent>
        </Select>

        {isAdmin && (
          <div className="relative min-w-[160px]">
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
              setHiringFilter('all')
              setOwnerFilter('')
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
        <LeadsTable leads={leads} />
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {page + 1} of {totalPages} · {total} total
          </p>
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
        </div>
      )}
    </div>
  )
}
