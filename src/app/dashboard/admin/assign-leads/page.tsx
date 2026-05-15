'use client'

import { useEffect, useState } from 'react'
import { Search, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/AuthProvider'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { fetchLeads } from '@/lib/services/leads'
import { logActivity } from '@/lib/services/activities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { StageBadge, ScoreBadge } from '@/components/ui/status-badges'
import type { Lead, UserProfile } from '@/lib/types'

export default function AssignLeadsPage() {
  const { profile, isAdmin } = useAuth()

  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsTotal, setLeadsTotal] = useState(0)
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [leadsSearch, setLeadsSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [leadsPage, setLeadsPage] = useState(0)
  const LEADS_PAGE_SIZE = 50

  const [salesUsers, setSalesUsers] = useState<UserProfile[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [newOwnerEmail, setNewOwnerEmail] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(leadsSearch), 300)
    return () => clearTimeout(t)
  }, [leadsSearch])

  // Load leads
  useEffect(() => {
    if (!profile || !isAdmin) return
    async function load() {
      setLeadsLoading(true)
      const { leads: data, count } = await fetchLeads({
        search: debouncedSearch,
        ownerEmail: ownerFilter || undefined,
        page: leadsPage,
        pageSize: LEADS_PAGE_SIZE,
        sortBy: 'created_at',
        sortAscending: false,
      })
      setLeads(data)
      setLeadsTotal(count)
      setLeadsLoading(false)
    }
    void load()
  }, [profile, isAdmin, debouncedSearch, ownerFilter, leadsPage])

  // Load sales users for the assignment dropdown
  useEffect(() => {
    if (!profile || !isAdmin) return
    async function loadUsers() {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id,email,name,role,created_at')
        .order('name', { ascending: true })
      setSalesUsers((data as UserProfile[]) ?? [])
    }
    void loadUsers()
  }, [profile, isAdmin])

  function toggleLead(leadId: string) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev)
      if (next.has(leadId)) next.delete(leadId)
      else next.add(leadId)
      return next
    })
  }

  function toggleAll() {
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set())
    } else {
      setSelectedLeadIds(new Set(leads.map((l) => l.lead_id)))
    }
  }

  async function handleAssign() {
    if (!newOwnerEmail || selectedLeadIds.size === 0 || !profile) return
    const newOwner = salesUsers.find((u) => u.email === newOwnerEmail)
    if (!newOwner) return

    setAssigning(true)
    const supabase = getSupabaseBrowserClient()
    const ids = [...selectedLeadIds]

    const { error } = await supabase
      .from('leads')
      .update({
        lead_owner_email: newOwner.email,
        lead_owner_name: newOwner.name ?? newOwner.email,
        last_updated: new Date().toISOString(),
      })
      .in('lead_id', ids)

    if (error) {
      toast.error(`Assignment failed: ${error.message}`)
      setAssigning(false)
      return
    }

    // Log activity for each lead
    const ownerLabel = newOwner.name ?? newOwner.email
    await Promise.all(
      ids.map((leadId) =>
        logActivity(
          leadId,
          'lead_assigned',
          `Lead assigned to ${ownerLabel} by ${profile.name ?? profile.email}`,
          profile.email
        )
      )
    )

    const count = ids.length
    toast.success(`${count} lead${count !== 1 ? 's' : ''} assigned to ${ownerLabel}.`)
    setSelectedLeadIds(new Set())
    setNewOwnerEmail('')

    // Reload leads
    const { leads: refreshed, count: total } = await fetchLeads({
      search: debouncedSearch,
      ownerEmail: ownerFilter || undefined,
      page: leadsPage,
      pageSize: LEADS_PAGE_SIZE,
      sortBy: 'created_at',
      sortAscending: false,
    })
    setLeads(refreshed)
    setLeadsTotal(total)
    setAssigning(false)
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-base font-semibold text-slate-900">Access Denied</h2>
        <p className="mt-1 text-sm text-slate-500">Lead Assignment is only available to admin users.</p>
      </div>
    )
  }

  const totalPages = Math.ceil(leadsTotal / LEADS_PAGE_SIZE)
  const newOwner = salesUsers.find((u) => u.email === newOwnerEmail)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Lead Assignment</h2>
        <p className="mt-0.5 text-xs text-slate-500">Select leads and assign them to a salesperson</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* Lead list */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search name, company, email…"
                value={leadsSearch}
                onChange={(e) => { setLeadsSearch(e.target.value); setLeadsPage(0) }}
                className="pl-8 text-sm"
              />
            </div>
            <div className="relative min-w-[150px]">
              <Input
                placeholder="Filter by current owner…"
                value={ownerFilter}
                onChange={(e) => { setOwnerFilter(e.target.value); setLeadsPage(0) }}
                className="text-sm"
              />
            </div>
            <p className="self-center text-xs text-slate-500">
              {leadsLoading ? '…' : `${leadsTotal} leads`}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            {leadsLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
              </div>
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="w-8 px-3 py-2">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={leads.length > 0 && selectedLeadIds.size === leads.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Contact</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stage</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Score</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                        No leads found.
                      </td>
                    </tr>
                  ) : leads.map((lead) => (
                    <tr
                      key={lead.lead_id}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedLeadIds.has(lead.lead_id) ? 'bg-blue-50' : ''}`}
                      onClick={() => toggleLead(lead.lead_id)}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={selectedLeadIds.has(lead.lead_id)}
                          onChange={() => toggleLead(lead.lead_id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900 max-w-[130px]">
                        <span className="block truncate" title={lead.contact_name ?? undefined}>
                          {lead.contact_name ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-[120px]">
                        <span className="block truncate" title={lead.account ?? undefined}>
                          {lead.account ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2"><StageBadge stage={lead.stage} /></td>
                      <td className="px-3 py-2 text-right"><ScoreBadge score={lead.score} /></td>
                      <td className="px-3 py-2 text-slate-600 max-w-[130px]">
                        <span className="block truncate" title={lead.lead_owner_email ?? undefined}>
                          {lead.lead_owner_name ?? lead.lead_owner_email?.split('@')[0] ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!leadsLoading && totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                disabled={leadsPage === 0}
                onClick={() => setLeadsPage((p) => Math.max(0, p - 1))}
                className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
              >
                ‹ Prev
              </button>
              <span>Page {leadsPage + 1} of {totalPages}</span>
              <button
                type="button"
                disabled={leadsPage >= totalPages - 1}
                onClick={() => setLeadsPage((p) => p + 1)}
                className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
              >
                Next ›
              </button>
            </div>
          )}
        </div>

        {/* Assignment panel */}
        <div className="lg:sticky lg:top-4">
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="border-b border-slate-100 px-5 py-4">
              <CardTitle className="text-sm font-semibold text-slate-900">Assign Selected Leads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Selected</p>
                <p className="text-xl font-bold text-slate-900">
                  {selectedLeadIds.size}
                  <span className="ml-1 text-sm font-normal text-slate-500">lead{selectedLeadIds.size !== 1 ? 's' : ''}</span>
                </p>
                {selectedLeadIds.size === 0 && (
                  <p className="mt-1 text-xs text-slate-400">Check leads in the table to select them.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Assign to</label>
                <Select value={newOwnerEmail} onValueChange={(v) => setNewOwnerEmail(v ?? '')}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select a salesperson…" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesUsers.map((u) => (
                      <SelectItem key={u.user_id} value={u.email}>
                        {u.name ?? u.email}
                        <span className="ml-1 capitalize text-slate-400 text-xs">({u.role})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newOwner && selectedLeadIds.size > 0 && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                  <strong>Confirm:</strong> Assign {selectedLeadIds.size} lead{selectedLeadIds.size !== 1 ? 's' : ''} to{' '}
                  <strong>{newOwner.name ?? newOwner.email}</strong>.
                  <br />This will log an activity for each lead.
                </div>
              )}

              <Button
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                disabled={selectedLeadIds.size === 0 || !newOwnerEmail || assigning}
                onClick={() => void handleAssign()}
              >
                <UserCheck className="h-4 w-4" />
                {assigning ? 'Assigning…' : `Assign ${selectedLeadIds.size > 0 ? selectedLeadIds.size : ''} Lead${selectedLeadIds.size !== 1 ? 's' : ''}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
