'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { fetchLeads } from '@/lib/services/leads'
import { LeadsTable } from '@/components/leads/LeadsTable'
import type { Lead } from '@/lib/types'

export default function RecommendedPage() {
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!profile) return
    async function load() {
      setLoading(true)
      const { leads: data, count } = await fetchLeads({
        isRecommended: true,
        roleFilter: { role: profile!.role, email: profile!.email },
        pageSize: 100,
        sortBy: 'score',
        sortAscending: false,
      })
      setLeads(data)
      setTotal(count)
      setLoading(false)
    }
    void load()
  }, [profile, refreshKey])

  const title = profile?.role === 'admin' ? 'Recommended Leads' : "Today's Recommended Leads"

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {loading
            ? 'Loading…'
            : total === 0
            ? 'No leads marked for outreach today'
            : `${total} lead${total !== 1 ? 's' : ''} recommended for outreach`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <Star className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">No recommended leads today.</p>
          <p className="mt-1 text-xs text-slate-400">
            Leads are flagged as recommended by the automation system.
          </p>
        </div>
      ) : (
        <LeadsTable leads={leads} onRefresh={() => setRefreshKey((k) => k + 1)} />
      )}
    </div>
  )
}
