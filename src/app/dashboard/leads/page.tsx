'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import { LeadsTable } from '@/components/leads/LeadsTable'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Lead } from '@/lib/types'

export default function LeadsPage() {
  const supabase = getSupabaseBrowserClient()
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return

    async function load() {
      setError(null)
      let query = supabase.from('leads').select('*').order('created_at', { ascending: false })
      if (profile!.role === 'sales') {
        query = query.eq('lead_owner_email', profile!.email)
      }
      const { data, error: err } = await query
      if (err) { setError(err.message); setLoading(false); return }
      setLeads((data as Lead[]) ?? [])
      setLoading(false)
    }
    load()
  }, [supabase, profile])

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase()
    return (
      !q ||
      l.contact_name?.toLowerCase().includes(q) ||
      l.account?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.category?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Leads</h2>
          <p className="text-xs text-slate-500 mt-0.5">{loading ? '…' : `${filtered.length} leads`}</p>
        </div>
        <Link
          href="/dashboard/leads/new"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 bg-blue-600 hover:bg-blue-700')}
        >
          <Plus className="h-4 w-4" />
          Add Lead
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 text-sm"
        />
      </div>

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
        <LeadsTable leads={filtered} />
      )}
    </div>
  )
}
