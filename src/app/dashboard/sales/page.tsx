'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users, Star, PhoneCall, MessageSquare, ThumbsUp, Ban, TrendingUp, ArrowRight,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STAGE_LABELS, STAGE_COLORS, type Lead } from '@/lib/types'

export default function SalesDashboard() {
  const supabase = getSupabaseBrowserClient()
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.email) return
    supabase
      .from('leads')
      .select('*')
      .eq('lead_owner_email', profile.email)
      .order('created_at', { ascending: false })
      .then((result: { data: unknown }) => {
        setLeads((result.data as Lead[]) ?? [])
        setLoading(false)
      })
  }, [supabase, profile?.email])

  const scores = leads.filter((l) => l.score !== null).map((l) => l.score as number)
  const statCards = [
    { label: 'My Leads', value: leads.length, icon: Users, color: 'text-slate-600', bg: 'bg-slate-100' },
    { label: 'Recommended', value: leads.filter((l) => l.stage === 'recommended').length, icon: Star, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Contacted', value: leads.filter((l) => l.stage === 'contacted').length, icon: PhoneCall, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'Replied', value: leads.filter((l) => l.stage === 'replied').length, icon: MessageSquare, color: 'text-cyan-600', bg: 'bg-cyan-100' },
    { label: 'Interested', value: leads.filter((l) => l.stage === 'interested').length, icon: ThumbsUp, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Do Not Contact', value: leads.filter((l) => l.stage === 'do_not_contact').length, icon: Ban, color: 'text-red-600', bg: 'bg-red-100' },
    {
      label: 'Avg Score',
      value: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
      icon: TrendingUp,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
    },
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
              <p className="text-xl font-bold text-slate-900">{value}</p>
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
          ) : leads.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No leads assigned to you yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {leads.slice(0, 8).map((lead, idx) => (
                <Link
                  key={lead.id || idx}
                  href={`/dashboard/leads/${lead.id}`}
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
