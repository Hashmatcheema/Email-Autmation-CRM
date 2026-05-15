'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ACTIVITY_TYPE_LABELS, STAGE_LABELS, STAGE_COLORS } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

interface ActivityRow {
  activity_id: string
  lead_id: string
  activity_type: string
  notes: string | null
  activity_date: string
  performed_by: string | null
  leads: {
    contact_name: string | null
    account: string | null
    stage: string | null
  } | null
}

type ViewMode = 'all' | 'sales' | 'system'

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

const PERIOD_LABEL: Record<string, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
}

const ACTIVITY_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'lead_created', label: 'Lead Created' },
  { value: 'lead_updated', label: 'Lead Updated' },
  { value: 'stage_changed', label: 'Stage Changed' },
  { value: 'email_sent', label: 'Email Sent' },
  { value: 'reply_received', label: 'Reply Received' },
  { value: 'note_added', label: 'Note Added' },
  { value: 'lead_imported', label: 'Lead Imported' },
  { value: 'lead_assigned', label: 'Lead Assigned' },
  { value: 'daily_recommended', label: 'Lead Recommended' },
  { value: 'outreach_sent', label: 'Outreach Sent' },
]

const PAGE_SIZE = 50

function getDateFrom(preset: string): string | null {
  const now = new Date()
  if (preset === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  }
  if (preset === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  if (preset === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }
  return null
}

function fmtActivityType(type: string) {
  return ACTIVITY_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function isSystemActivity(performedBy: string | null): boolean {
  if (!performedBy) return true
  return performedBy.toLowerCase().includes('n8n') || performedBy.toLowerCase() === 'system'
}

export default function SalesActivityPage() {
  const { profile, isAdmin } = useAuth()
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshKey] = useState(0)

  const [view, setView] = useState<ViewMode>('all')
  const [datePreset, setDatePreset] = useState('week')
  const [activityTypeFilter, setActivityTypeFilter] = useState('')
  const [performedByFilter, setPerformedByFilter] = useState('')

  const [periodStats, setPeriodStats] = useState({
    total: 0, emails: 0, leadsCreated: 0, stageChanges: 0, notes: 0,
  })

  // Stats re-fetch whenever date preset or view mode changes
  useEffect(() => {
    if (!profile) return
    async function loadStats() {
      const supabase = getSupabaseBrowserClient()
      const dateFrom = getDateFrom(datePreset)
      let query = supabase.from('lead_activities').select('activity_type,performed_by')
      if (dateFrom) query = query.gte('activity_date', dateFrom)
      if (view === 'sales') {
        query = query.not('performed_by', 'is', null).not('performed_by', 'ilike', '%n8n%')
      } else if (view === 'system') {
        query = query.or('performed_by.is.null,performed_by.ilike.%n8n%')
      }
      const { data } = await query
      const acts = (data as { activity_type: string; performed_by: string | null }[]) ?? []
      setPeriodStats({
        total: acts.length,
        emails: acts.filter((a) => a.activity_type === 'email_sent' || a.activity_type === 'outreach_sent').length,
        leadsCreated: acts.filter((a) => a.activity_type === 'lead_created').length,
        stageChanges: acts.filter((a) => a.activity_type === 'stage_changed').length,
        notes: acts.filter((a) => a.activity_type === 'note_added').length,
      })
    }
    void loadStats()
  }, [profile, datePreset, view])

  useEffect(() => {
    if (!profile) return
    async function load() {
      setLoading(true)
      const supabase = getSupabaseBrowserClient()
      const dateFrom = getDateFrom(datePreset)

      let query = supabase
        .from('lead_activities')
        .select(
          'activity_id,lead_id,activity_type,notes,activity_date,performed_by,leads(contact_name,account,stage)',
          { count: 'exact' }
        )
        .order('activity_date', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (dateFrom) query = query.gte('activity_date', dateFrom)
      if (activityTypeFilter) query = query.eq('activity_type', activityTypeFilter)
      if (performedByFilter.trim()) {
        query = query.ilike('performed_by', `%${performedByFilter.trim()}%`)
      }

      // View mode filter
      if (view === 'sales') {
        query = query.not('performed_by', 'is', null).not('performed_by', 'ilike', '%n8n%')
      } else if (view === 'system') {
        query = query.or('performed_by.is.null,performed_by.ilike.%n8n%')
      }

      const { data, count, error } = await query
      if (!error) {
        setActivities((data as ActivityRow[]) ?? [])
        setTotal(count ?? 0)
      }
      setLoading(false)
    }
    void load()
  }, [profile, page, datePreset, activityTypeFilter, performedByFilter, view, refreshKey])

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-3">
          <span className="text-xl font-bold text-red-600">✕</span>
        </div>
        <h2 className="text-base font-semibold text-slate-900">Access Denied</h2>
        <p className="mt-1 text-sm text-slate-500">Sales Activity is only available to admin users.</p>
      </div>
    )
  }

  const period = PERIOD_LABEL[datePreset] ?? datePreset
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const STAT_CARDS = [
    { label: `Activities ${period}`, value: periodStats.total, color: 'text-slate-700' },
    { label: `Emails Sent ${period}`, value: periodStats.emails, color: 'text-blue-700' },
    { label: `Leads Created ${period}`, value: periodStats.leadsCreated, color: 'text-emerald-700' },
    { label: `Stage Changes ${period}`, value: periodStats.stageChanges, color: 'text-amber-700' },
    { label: `Notes Added ${period}`, value: periodStats.notes, color: 'text-violet-700' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Sales Activity</h2>
        <p className="mt-0.5 text-xs text-slate-500">All activity across the CRM</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_CARDS.map(({ label, value, color }) => (
          <Card key={label} className="border-slate-200 shadow-none">
            <CardContent className="p-4">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white w-fit overflow-hidden text-xs">
        {([
          { value: 'all', label: 'All Activity' },
          { value: 'sales', label: 'Sales Activity' },
          { value: 'system', label: 'System Activity' },
        ] as { value: ViewMode; label: string }[]).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setView(t.value); setPage(0) }}
            className={`px-3 py-1.5 font-medium transition-colors ${
              view === t.value
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => { setDatePreset(p.value); setPage(0) }}
              className={`px-3 py-1.5 font-medium transition-colors ${
                datePreset === p.value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Select value={activityTypeFilter} onValueChange={(v) => { setActivityTypeFilter(v ?? ''); setPage(0) }}>
          <SelectTrigger className="w-[170px] text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Filter by salesperson…"
            value={performedByFilter}
            onChange={(e) => { setPerformedByFilter(e.target.value); setPage(0) }}
            className="pl-8 text-sm"
          />
        </div>

        <p className="self-center text-xs text-slate-500">
          {loading ? '…' : `${total} record${total !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No activity found for the selected filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Date / Time</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Salesperson</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Activity</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lead / Contact</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account</th>
                <th className="min-w-[200px] px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stage</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activities.map((act, idx) => {
                const system = isSystemActivity(act.performed_by)
                return (
                  <tr key={act.activity_id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                      {new Date(act.activity_date).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2 max-w-[140px]">
                      {system ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          System
                        </span>
                      ) : (
                        <span className="block truncate text-slate-700 font-medium" title={act.performed_by ?? undefined}>
                          {act.performed_by ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{fmtActivityType(act.activity_type)}</span>
                    </td>
                    <td className="px-4 py-2 max-w-[150px]">
                      {act.leads?.contact_name ? (
                        <Link
                          href={`/dashboard/leads/${act.lead_id}`}
                          className="block truncate text-blue-600 hover:text-blue-800"
                          title={act.leads.contact_name}
                        >
                          {act.leads.contact_name}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 max-w-[140px]">
                      <span className="block truncate text-slate-600" title={act.leads?.account ?? undefined}>
                        {act.leads?.account ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {act.notes ? (
                        <span className="text-slate-600" title={act.notes}>
                          {act.notes.length > 60 ? `${act.notes.slice(0, 60)}…` : act.notes}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {act.leads?.stage ? (
                        <Badge
                          variant="secondary"
                          className={`border text-[10px] font-medium ${STAGE_COLORS[act.leads.stage] ?? ''}`}
                        >
                          {STAGE_LABELS[act.leads.stage] ?? act.leads.stage}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/dashboard/leads/${act.lead_id}`}
                        className="text-blue-500 hover:text-blue-700"
                        title="Open lead"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {page + 1} of {totalPages} · {total} total
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon"
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
