'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/AuthProvider'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { UserProfile } from '@/lib/types'

interface UserWithLeads extends UserProfile {
  leadsOwned: number
}

export default function UserManagementPage() {
  const { profile, isAdmin } = useAuth()
  const [users, setUsers] = useState<UserWithLeads[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!profile || !isAdmin) return
    async function load() {
      setLoading(true)
      const supabase = getSupabaseBrowserClient()

      const [{ data: userRows }, { data: leadsData }] = await Promise.all([
        supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('leads').select('lead_owner_email'),
      ])

      const leadsCountByOwner: Record<string, number> = {}
      for (const l of (leadsData ?? []) as { lead_owner_email: string | null }[]) {
        if (l.lead_owner_email) {
          leadsCountByOwner[l.lead_owner_email] = (leadsCountByOwner[l.lead_owner_email] ?? 0) + 1
        }
      }

      const combined: UserWithLeads[] = ((userRows as UserProfile[]) ?? []).map((u) => ({
        ...u,
        leadsOwned: leadsCountByOwner[u.email] ?? 0,
      }))

      setUsers(combined)
      setLoading(false)
    }
    void load()
  }, [profile, isAdmin])

  async function handleRoleChange(userId: string, newRole: 'admin' | 'sales') {
    if (userId === profile?.user_id && newRole !== 'admin') {
      toast.error("You cannot remove your own admin role.")
      return
    }
    setSaving(userId)
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('user_id', userId)

    if (error) {
      toast.error(`Failed to update role: ${error.message}`)
    } else {
      toast.success('Role updated.')
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, role: newRole } : u))
    }
    setSaving(null)
  }

  async function handleToggleActive(userId: string, currentIsActive: boolean | null | undefined) {
    if (userId === profile?.user_id) {
      toast.error("You cannot deactivate your own account.")
      return
    }
    const newActive = currentIsActive === false ? true : false
    setSaving(userId + '_active')
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: newActive })
      .eq('user_id', userId)

    if (error) {
      if (error.message.includes('column') && error.message.includes('is_active')) {
        toast.error("The is_active column does not exist in user_profiles. Add it to the database to enable this feature.")
      } else {
        toast.error(`Failed to update status: ${error.message}`)
      }
    } else {
      const label = newActive ? 'activated' : 'deactivated'
      toast.success(`User account ${label}.`)
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, is_active: newActive } : u))
    }
    setSaving(null)
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-base font-semibold text-slate-900">Access Denied</h2>
        <p className="mt-1 text-sm text-slate-500">User Management is only available to admin users.</p>
      </div>
    )
  }

  const activeCount = users.filter((u) => u.is_active !== false).length
  const adminCount = users.filter((u) => u.role === 'admin').length
  const salesCount = users.filter((u) => u.role === 'sales').length

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">User Management</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {loading ? 'Loading…' : `${users.length} users · ${activeCount} active · ${adminCount} admin · ${salesCount} sales`}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 max-w-sm">
        {[
          { label: 'Total Users', value: users.length },
          { label: 'Admin', value: adminCount },
          { label: 'Sales', value: salesCount },
        ].map(({ label, value }) => (
          <Card key={label} className="border-slate-200 shadow-none">
            <CardContent className="p-4">
              <p className="text-xl font-bold text-slate-900">{loading ? '…' : value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No users found in user_profiles.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Role</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Leads Owned</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Created</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isCurrentUser = u.user_id === profile?.user_id
                const isActive = u.is_active !== false
                return (
                  <tr key={u.user_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                          {(u.name?.[0] ?? u.email[0]).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">
                          {u.name ?? '—'}
                          {isCurrentUser && (
                            <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">You</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={u.role}
                        onValueChange={(v) => {
                          if (v) void handleRoleChange(u.user_id, v as 'admin' | 'sales')
                        }}
                      >
                        <SelectTrigger className="h-7 w-[90px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="sales">Sales</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isActive
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{u.leadsOwned}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={saving === u.user_id + '_active' || isCurrentUser}
                        title={isCurrentUser ? 'Cannot deactivate your own account' : undefined}
                        onClick={() => void handleToggleActive(u.user_id, u.is_active)}
                      >
                        {saving === u.user_id + '_active' ? '…' : isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Role changes take effect on the user&apos;s next page load. Account activation requires the{' '}
        <code className="rounded bg-slate-100 px-1">is_active</code> column in{' '}
        <code className="rounded bg-slate-100 px-1">user_profiles</code>.
      </p>
    </div>
  )
}
