'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users, Star, PhoneCall, MessageSquare, ThumbsUp, Ban, TrendingUp, ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { fetchLeadStats, type LeadStatsResult } from '@/lib/services/leads'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STAGE_LABELS, STAGE_COLORS, type Lead } from '@/lib/types'

const EMPTY: LeadStatsResult = {
  total: 0, recommended: 0, contacted: 0, replied: 0,
  interested: 0, doNotContact: 0, avgScore: 0, recentLeads: [],
}

export default function SalesDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<LeadStatsResult>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.email) return
    async function load() {
      const result = await fetchLeadStats(profile!.email)
      setStats(result)
      setLoading(false)
    }
    load()
  }, [profile])

  const statCards = [
    { label: 'My Leads', value: stats.total, icon: Users, color: 'text-slate-600', bg: 'bg-slate-100' },
    { label: 'Recommended', value: stats.recommended, icon: Star, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Contacted', value: stats.contacted, icon: PhoneCall, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'Replied', value: stats.replied, icon: MessageSquare, color: 'text-cyan-600', bg: 'bg-cyan-100' },
    { label: 'Interested', value: stats.interested, icon: ThumbsUp, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Do Not Contact', value: stats.doNotContact, icon: Ban, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Avg Score', value: stats.avgScore, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-slate-200 shadow-none">
            <CardContent className="p-4">
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              {loading ? (
                <div className="h-6 w-10 animate-pulse rounded bg-slate-100 mb-1" />
              ) : (
                <p className="text-xl font-bold text-slate-900">{value}</p>
              )}
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-6 py-4">
          <CardTitle className="text-sm font-semibold text-slate-900">My Leads</CardTitle>
          <Link href="/dashboard/leads" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
            </div>
          ) : stats.recentLeads.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No leads assigned to you yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recentLeads.map((lead: Lead, idx: number) => (
                <Link
                  key={lead.lead_id || idx}
                  href={`/dashboard/leads/${lead.lead_id}`}
                  className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {(lead.contact_name?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{lead.contact_name ?? '—'}</p>
                      <p className="truncate text-xs text-slate-500">{lead.account ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {lead.score !== null && (
                      <span className="text-xs font-semibold text-slate-500">{lead.score}</span>
                    )}
                    <Badge
                      variant="secondary"
                      className={`border text-[11px] font-medium ${STAGE_COLORS[lead.stage ?? 'new'] ?? STAGE_COLORS.new}`}
                    >
                      {STAGE_LABELS[lead.stage ?? 'new'] ?? lead.stage}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
