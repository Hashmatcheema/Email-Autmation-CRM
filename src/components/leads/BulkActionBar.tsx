'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  X, ChevronDown, Tag, UserCog, Calendar, Star, Trash2, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { bulkUpdateLeads, deleteLeads } from '@/lib/services/leads'
import { LEAD_STAGES, STAGE_LABELS, type UserProfile } from '@/lib/types'

const STAGE_ACTIONS: { value: string; label: string }[] = LEAD_STAGES
  .filter((s) => !['recommended', 'closed_won', 'closed_lost'].includes(s))
  .map((s) => ({ value: s, label: `Mark as ${STAGE_LABELS[s]}` }))

interface Props {
  selectedIds: string[]
  onClear: () => void
  onApplied: () => void
  performedBy: string
  isAdmin: boolean
}

export function BulkActionBar({ selectedIds, onClear, onApplied, performedBy, isAdmin }: Props) {
  const count = selectedIds.length

  const [working, setWorking] = useState(false)
  const [users, setUsers] = useState<Pick<UserProfile, 'email' | 'name' | 'role'>[]>([])
  const [followupOpen, setFollowupOpen] = useState(false)
  const [followupDate, setFollowupDate] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!isAdmin || users.length > 0) return
    async function loadUsers() {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase
        .from('user_profiles')
        .select('email,name,role,is_active')
        .order('name', { ascending: true })
      const rows = ((data as (Pick<UserProfile, 'email' | 'name' | 'role'> & { is_active?: boolean | null })[]) ?? [])
        .filter((u) => u.is_active !== false)
      setUsers(rows)
    }
    void loadUsers()
  }, [isAdmin, users.length])

  async function applyStage(stage: string) {
    setWorking(true)
    const res = await bulkUpdateLeads(selectedIds, { stage }, performedBy, {
      activityType: 'stage_changed',
      activityNote: `Bulk: stage changed to ${stage.replace(/_/g, ' ')}`,
    })
    setWorking(false)
    if (res.errors.length > 0) toast.error(res.errors[0])
    else { toast.success(`Updated ${res.updated} lead${res.updated !== 1 ? 's' : ''}`); onApplied() }
  }

  async function assignTo(email: string, name: string | null) {
    setWorking(true)
    const res = await bulkUpdateLeads(
      selectedIds,
      { lead_owner_email: email, lead_owner_name: name },
      performedBy,
      { activityType: 'lead_assigned', activityNote: `Bulk: assigned to ${name ?? email}` },
    )
    setWorking(false)
    if (res.errors.length > 0) toast.error(res.errors[0])
    else { toast.success(`Assigned ${res.updated} lead${res.updated !== 1 ? 's' : ''}`); onApplied() }
  }

  async function applyFollowupDate(date: string | null) {
    setWorking(true)
    const res = await bulkUpdateLeads(
      selectedIds,
      { next_followup_date: date },
      performedBy,
      {
        activityType: 'note_added',
        activityNote: date ? `Bulk: follow-up set to ${date}` : 'Bulk: follow-up date cleared',
      },
    )
    setWorking(false)
    if (res.errors.length > 0) toast.error(res.errors[0])
    else {
      toast.success(date
        ? `Set follow-up for ${res.updated} lead${res.updated !== 1 ? 's' : ''}`
        : `Cleared follow-up on ${res.updated} lead${res.updated !== 1 ? 's' : ''}`)
      setFollowupOpen(false); setFollowupDate(''); onApplied()
    }
  }

  async function applyRecommended(flag: boolean) {
    setWorking(true)
    const res = await bulkUpdateLeads(
      selectedIds,
      { is_daily_recommended: flag },
      performedBy,
      { activityType: 'daily_recommended', activityNote: flag ? 'Bulk: marked daily recommended' : 'Bulk: cleared recommendation' },
    )
    setWorking(false)
    if (res.errors.length > 0) toast.error(res.errors[0])
    else { toast.success(`Updated ${res.updated} lead${res.updated !== 1 ? 's' : ''}`); onApplied() }
  }

  async function handleDelete() {
    setWorking(true)
    const res = await deleteLeads(selectedIds)
    setWorking(false)
    setConfirmDelete(false)
    if (res.error) {
      toast.error(`Delete failed: ${res.error}`)
    } else {
      toast.success(`Deleted ${res.deleted} lead${res.deleted !== 1 ? 's' : ''}`)
      onApplied()
    }
  }

  if (count === 0) return null

  return (
    <>
      <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-blue-300 bg-blue-50/90 px-4 py-2.5 shadow-sm backdrop-blur">
        <span className="text-sm font-semibold text-blue-900">
          You are performing a batch action on {count} selected lead{count !== 1 ? 's' : ''}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* Stage actions */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={working}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-100 disabled:opacity-50',
              )}
            >
              <Tag className="h-3.5 w-3.5" />
              Stage
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STAGE_ACTIONS.map((s) => (
                <DropdownMenuItem key={s.value} onClick={() => void applyStage(s.value)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={working || users.length === 0}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-100 disabled:opacity-50"
                title={users.length === 0 ? 'No active users to assign to' : undefined}
              >
                <UserCog className="h-3.5 w-3.5" />
                Assign
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                {users.map((u) => (
                  <DropdownMenuItem key={u.email} onClick={() => void assignTo(u.email, u.name)}>
                    {u.name ?? u.email}
                    <span className="ml-2 text-[10px] text-slate-400">{u.role}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={working}
              className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-100 disabled:opacity-50"
            >
              <Calendar className="h-3.5 w-3.5" />
              Follow-up
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFollowupOpen(true)}>
                Set follow-up date…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void applyFollowupDate(null)}>
                Clear follow-up date
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={working}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <Star className="h-3.5 w-3.5" />
                Recommend
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void applyRecommended(true)}>
                  Mark as daily recommended
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void applyRecommended(false)}>
                  Clear recommendation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isAdmin && (
            <>
              <div className="h-5 w-px bg-blue-200 mx-1" />
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={working}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-slate-600 hover:text-slate-900"
            disabled={working}
            onClick={onClear}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Follow-up date modal */}
      <Dialog open={followupOpen} onOpenChange={(open) => { if (!open) { setFollowupOpen(false); setFollowupDate('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set follow-up date</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">
            Applies to all {count} selected lead{count !== 1 ? 's' : ''}.
          </p>
          <Input
            type="date"
            value={followupDate}
            onChange={(e) => setFollowupDate(e.target.value)}
            className="mt-2"
          />
          <DialogFooter className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setFollowupOpen(false); setFollowupDate('') }}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!followupDate || working}
              onClick={() => void applyFollowupDate(followupDate)}
            >
              {working ? 'Saving…' : 'Set date'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" /> Delete {count} lead{count !== 1 ? 's' : ''}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-700">
            This permanently removes the selected lead{count !== 1 ? 's' : ''} and {count !== 1 ? 'their' : 'its'} activity history. This cannot be undone.
          </p>
          <DialogFooter className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={working}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={working}
              onClick={() => void handleDelete()}
            >
              {working ? 'Deleting…' : `Delete ${count} lead${count !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
