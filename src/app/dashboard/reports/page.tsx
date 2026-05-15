'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LEAD_STAGES, STAGE_LABELS, STAGE_COLORS, isHiringActive, type Lead } from '@/lib/types'
import Link from 'next/link'

const REPORT_COLUMNS = 'lead_id,contact_name,account,stage,category,score,hiring_signal,lead_owner_email,next_followup_date'

export default function ReportsPage() {
  const supabase = getSupabaseBrowserClient()
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    async function load() {
      let query = supabase.from('leads').select(REPORT_COLUMNS)
      if (profile!.role === 'sales') query = query.eq('lead_owner_email', profile!.email)
      const { data } = await query
      setLeads((data as Lead[]) ?? [])
      setLoading(false)
    }
    load()
  }, [supabase, profile])

  const total = leads.length
  const byStage = LEAD_STAGES.map((s) => {
    const count = leads.filter((l) => l.stage === s).length
    return { stage: s, count, pct: total ? Math.round((count / total) * 100) : 0 }
  })

  const ownerMap: Record<string, number> = {}
  leads.forEach((l) => {
    const k = l.lead_owner_email ?? 'Unassigned'
    ownerMap[k] = (ownerMap[k] ?? 0) + 1
  })
  const byOwner = Object.entries(ownerMap).sort((a, b) => b[1] - a[1])

  const scores = leads.filter((l) => l.score !== null).map((l) => l.score as number)
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null

  const hiringCount = leads.filter((l) => isHiringActive(l.hiring_signal)).length
  const hotLeads = leads.filter((l) => l.score !== null && (l.score as number) >= 70).length
  const doNotContact = leads.filter((l) => l.stage === 'do_not_contact').length

  const categoryMap: Record<string, number> = {}
  leads.forEach((l) => {
    const k = l.category ?? 'Uncategorized'
    categoryMap[k] = (categoryMap[k] ?? 0) + 1
  })
  const byCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])

  const topScored = [...leads]
    .filter((l) => l.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10)

  const today = new Date().toISOString().slice(0, 10)
  const overdueFollowups = leads
    .filter((l) => l.next_followup_date && l.next_followup_date < today)
    .sort((a, b) => (a.next_followup_date ?? '').localeCompare(b.next_followup_date ?? ''))
    .slice(0, 10)


  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="Total Leads" value={String(total)} loading={loading} />
        <SummaryCard label="Average Score" value={avgScore !== null ? String(avgScore) : '—'} loading={loading} />
        <SummaryCard label="Hiring Signal" value={String(hiringCount)} sub={`of ${total} leads`} loading={loading} />
        <SummaryCard label="Hot Leads (≥70)" value={String(hotLeads)} loading={loading} />
        <SummaryCard label="Do Not Contact" value={String(doNotContact)} loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Stage */}
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="border-b border-slate-100 px-6 py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Leads by Stage
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {byStage.map(({ stage, count, pct }) => (
                  <li key={stage} className="flex items-center gap-3 px-6 py-3">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${STAGE_COLORS[stage]?.split(' ')[0] ?? 'bg-slate-200'}`}
                    />
                    <span className="flex-1 text-sm text-slate-700">{STAGE_LABELS[stage]}</span>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:block w-24 h-1.5 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-sm font-semibold text-slate-900">{count}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* By Owner — admin only */}
        {profile?.role === 'admin' && (
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="border-b border-slate-100 px-6 py-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Leads by Owner
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
                </div>
              ) : byOwner.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-slate-500">No data yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {byOwner.map(([owner, count]) => {
                    const pct = total ? Math.round((count / total) * 100) : 0
                    return (
                      <li key={owner} className="flex items-center gap-3 px-6 py-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                          {owner[0].toUpperCase()}
                        </div>
                        <span className="flex-1 truncate text-sm text-slate-700">{owner}</span>
                        <div className="flex items-center gap-3">
                          <div className="hidden sm:block w-24 h-1.5 rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-right text-sm font-semibold text-slate-900">{count}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Category */}
        {byCategory.length > 0 && (
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="border-b border-slate-100 px-6 py-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Leads by Category
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {byCategory.map(([cat, count]) => {
                    const pct = total ? Math.round((count / total) * 100) : 0
                    return (
                      <li key={cat} className="flex items-center gap-3 px-6 py-3">
                        <span className="flex-1 text-sm text-slate-700">{cat}</span>
                        <div className="flex items-center gap-3">
                          <div className="hidden sm:block w-24 h-1.5 rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-6 text-right text-sm font-semibold text-slate-900">{count}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Overdue Follow-ups */}
        {overdueFollowups.length > 0 && (
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="border-b border-slate-100 px-6 py-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Overdue Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {overdueFollowups.map((l) => (
                  <li key={l.lead_id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/leads/${l.lead_id}`}
                        className="truncate text-sm font-medium text-slate-900 hover:text-blue-600"
                      >
                        {l.contact_name ?? '—'}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{l.account ?? '—'}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-red-600">
                      {new Date(l.next_followup_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Scored Leads */}
      {topScored.length > 0 && (
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="border-b border-slate-100 px-6 py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Top Scored Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {topScored.map((l, i) => (
                <li key={l.lead_id} className="flex items-center gap-4 px-6 py-3">
                  <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/leads/${l.lead_id}`}
                      className="truncate text-sm font-medium text-slate-900 hover:text-blue-600"
                    >
                      {l.contact_name ?? '—'}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{l.account ?? '—'}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span
                      className={`text-sm font-bold ${
                        (l.score ?? 0) >= 70 ? 'text-green-600' : (l.score ?? 0) >= 40 ? 'text-amber-600' : 'text-red-500'
                      }`}
                    >
                      {l.score}
                    </span>
                    <span className={`text-[11px] border rounded px-1.5 py-0.5 font-medium ${STAGE_COLORS[l.stage ?? 'new'] ?? STAGE_COLORS.new}`}>
                      {STAGE_LABELS[l.stage ?? 'new'] ?? l.stage}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {loading ? (
          <div className="mt-2 h-7 w-12 animate-pulse rounded bg-slate-100" />
        ) : (
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        )}
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  )
}
