'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  MoreVertical, FileText, Mail, Phone, Pencil, Send, Clock, ChevronDown, ExternalLink,
  Trash2, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button, buttonVariants } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { StageBadge, CategoryBadge, ScoreBadge, HiringSignalBadge } from '@/components/ui/status-badges'
import { fetchActivities } from '@/lib/services/activities'
import { fetchActiveTemplates } from '@/lib/services/templates'
import { updateLeadStage, updateLeadNotes, deleteLeads } from '@/lib/services/leads'
import {
  LEAD_STAGES, STAGE_LABELS, TEMPLATE_TYPE_LABELS,
  CLIENT_RELATIONSHIP_LABELS, CLIENT_RELATIONSHIP_OPTIONS,
  COMPANY_TYPE_LABELS, COMPANY_TYPE_OPTIONS,
  LEAD_SOURCE_LABELS, LEAD_SOURCE_OPTIONS,
  type Lead, type LeadActivity, type EmailTemplate,
} from '@/lib/types'

export interface ColFilters {
  stage: string
  category: string
  score: string
  hiring: string
  source: string
  relationship: string
  companyType: string
  followup: string
  owner: string
}

const QUICK_STAGES = [
  { value: 'contacted', label: 'Mark Contacted' },
  { value: 'follow_up', label: 'Mark Follow Up' },
  { value: 'replied', label: 'Mark Replied' },
  { value: 'interested', label: 'Mark Interested' },
  { value: 'not_interested', label: 'Mark Not Interested' },
  { value: 'do_not_contact', label: 'Mark Do Not Contact' },
] as const

const CATEGORY_FILTER_OPTIONS = ['Hot', 'Warm', 'Not Relevant', 'Do Not Contact']

const SCORE_FILTER_OPTIONS = [
  { value: '80plus', label: '80+' },
  { value: '90plus', label: '90+' },
  { value: '100', label: '100 only' },
  { value: '1to79', label: '1–79' },
  { value: '0', label: '0 / No score' },
]

const FOLLOWUP_FILTER_OPTIONS = [
  { value: 'today', label: 'Due Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'none', label: 'No Date' },
]

const HIRING_FILTER_OPTIONS = [
  { value: 'active_contract_hiring', label: 'Contract' },
  { value: 'active_fulltime_hiring', label: 'Full-Time' },
  { value: 'active_hiring', label: 'Active Hiring' },
  { value: 'weak_hiring', label: 'Weak Hiring' },
  { value: 'no_signal', label: 'No Signal' },
  { value: 'unknown', label: 'Unknown' },
]

function getEmailBlockReason(lead: Lead): string | null {
  if (!lead.email) return 'No email address'
  if (lead.stage === 'do_not_contact') return 'Do Not Contact'
  if (lead.unsubscribed) return 'Unsubscribed'
  if (lead.bounce_status && lead.bounce_status.toLowerCase().includes('hard')) return 'Hard bounce'
  if (lead.complaint_status && !['none', ''].includes(lead.complaint_status.toLowerCase())) return 'Spam complaint'
  if (lead.email_opt_in_status === false) return 'Not opted in'
  return null
}

function interpolate(text: string, lead: Lead, senderName: string) {
  const firstName = lead.contact_name?.split(' ')[0] ?? ''
  return text
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{contact_name\}\}/g, lead.contact_name ?? '')
    .replace(/\{\{company_name\}\}/g, lead.account ?? '')
    .replace(/\{\{sender_name\}\}/g, senderName)
    .replace(/\{\{industry\}\}/g, lead.industry ?? '')
    .replace(/\{\{hiring_signal\}\}/g, lead.hiring_signal ?? '')
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtFollowup(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ownerDisplay(lead: Lead) {
  if (lead.lead_owner_name) return lead.lead_owner_name
  if (lead.lead_owner_email) return lead.lead_owner_email.split('@')[0]
  return '—'
}

// Standard column header with dropdown filter
function ColHeader({
  label,
  active,
  onClear,
  children,
}: {
  label: string
  active: boolean
  onClear: () => void
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:text-blue-600 cursor-pointer select-none rounded px-0.5 py-0.5',
          active ? 'text-blue-600' : 'text-slate-500',
        )}
      >
        {label}
        <ChevronDown className={cn('ml-0.5 h-3 w-3 shrink-0', active && 'text-blue-500')} />
        {active && <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[150px]">
        {children}
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-slate-500" onClick={onClear}>
              Clear filter
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Owner column header with inline text search
function OwnerColHeader({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const active = !!value
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:text-blue-600 cursor-pointer select-none rounded px-0.5 py-0.5',
          active ? 'text-blue-600' : 'text-slate-500',
        )}
      >
        Owner
        <ChevronDown className={cn('ml-0.5 h-3 w-3 shrink-0', active && 'text-blue-500')} />
        {active && <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[190px] p-2">
        <input
          type="text"
          placeholder="Filter by owner email…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400"
          autoFocus
        />
        {active && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="mt-1.5 w-full rounded px-1 py-0.5 text-left text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            Clear filter
          </button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface Props {
  leads: Lead[]
  onRefresh: () => void
  colFilters: ColFilters
  onColFilterChange: (key: keyof ColFilters, value: string) => void
  isAdmin: boolean
  /** Selection is optional — pages that don't use bulk actions can omit these. */
  selectedIds?: Set<string>
  onToggleSelect?: (leadId: string) => void
  onToggleSelectAll?: (leadIds: string[]) => void
  /** When false, hides the checkbox column entirely. Defaults to true when selection handlers are supplied. */
  selectable?: boolean
}

const EMPTY_SELECTION = new Set<string>()

export function LeadsTable({
  leads, onRefresh, colFilters, onColFilterChange, isAdmin,
  selectedIds = EMPTY_SELECTION,
  onToggleSelect,
  onToggleSelectAll,
  selectable,
}: Props) {
  const showSelect = selectable ?? !!(onToggleSelect && onToggleSelectAll)
  const handleToggleSelect = (id: string) => onToggleSelect?.(id)
  const handleToggleSelectAll = (ids: string[]) => onToggleSelectAll?.(ids)
  const { profile } = useAuth()
  const router = useRouter()

  // Notes / activity modal
  const [notesLead, setNotesLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [editedNotes, setEditedNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  // Outreach modal
  const [outreachLead, setOutreachLead] = useState<Lead | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)

  // Single-row delete confirm (admin)
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState(false)

  const pageLeadIds = leads.map((l) => l.lead_id)
  const allOnPageSelected = pageLeadIds.length > 0 && pageLeadIds.every((id) => selectedIds.has(id))
  const someOnPageSelected = !allOnPageSelected && pageLeadIds.some((id) => selectedIds.has(id))

  const selectedTemplate = templates.find((t) => t.template_id === selectedTemplateId) ?? null

  async function openNotesModal(lead: Lead) {
    setNotesLead(lead)
    setEditedNotes(lead.notes ?? '')
    setActivities([])
    setActivitiesLoading(true)
    const { activities: acts } = await fetchActivities(lead.lead_id)
    setActivities(acts)
    setActivitiesLoading(false)
  }

  async function handleSaveNotes() {
    if (!notesLead || !profile) return
    setNotesSaving(true)
    const { error } = await updateLeadNotes(notesLead.lead_id, editedNotes, profile.email)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Notes saved')
      setNotesLead((prev) => prev ? { ...prev, notes: editedNotes } : null)
      onRefresh()
    }
    setNotesSaving(false)
  }

  async function openOutreachModal(lead: Lead) {
    setOutreachLead(lead)
    setSelectedTemplateId('')
    if (templates.length === 0) {
      setTemplatesLoading(true)
      const { templates: t } = await fetchActiveTemplates()
      setTemplates(t)
      setTemplatesLoading(false)
    }
  }

  async function handleDeleteSingle() {
    if (!deleteLead) return
    setDeleting(true)
    const res = await deleteLeads([deleteLead.lead_id])
    setDeleting(false)
    if (res.error) {
      toast.error(`Delete failed: ${res.error}`)
    } else {
      toast.success(`Deleted ${deleteLead.contact_name ?? 'lead'}`)
      setDeleteLead(null)
      onRefresh()
    }
  }

  async function handleStageChange(leadId: string, newStage: string) {
    if (!profile) return
    const { error } = await updateLeadStage(leadId, newStage, profile.email)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Marked as ${STAGE_LABELS[newStage]}`)
      onRefresh()
    }
  }

  async function handleSendOutreach() {
    if (!selectedTemplate || !outreachLead || sendLoading || !profile) return
    setSendLoading(true)
    const senderName = profile.name ?? profile.email ?? ''
    const subject = interpolate(selectedTemplate.subject, outreachLead, senderName)
    const body = interpolate(selectedTemplate.body, outreachLead, senderName)

    const res = await fetch('/api/outreach/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: outreachLead.lead_id,
        template_id: selectedTemplate.template_id,
        to_email: outreachLead.email,
        subject,
        body,
        sender_email: profile.email,
      }),
    })

    const json = (await res.json()) as { error?: string }

    if (!res.ok) {
      toast.error(json.error ?? 'Failed to send outreach')
      setSendLoading(false)
      return
    }

    await updateLeadStage(outreachLead.lead_id, 'contacted', profile.email)
    toast.success('Outreach sent! Stage updated to Contacted.')
    setOutreachLead(null)
    onRefresh()
    setSendLoading(false)
  }

  // Suppress repeated daily_recommended noise in activity list
  function dedupeActivities(acts: LeadActivity[]) {
    let seenRecommended = false
    return acts.filter((a) => {
      if (a.activity_type === 'daily_recommended') {
        if (seenRecommended) return false
        seenRecommended = true
      }
      return true
    })
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-500">No leads found</p>
        <p className="mt-1 text-xs text-slate-400">Try adjusting your search or add a new lead.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[1480px] text-xs">
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
              {showSelect && (
                <TableHead className="w-[36px] py-2 sticky left-0 z-20 bg-slate-50 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={allOnPageSelected}
                    ref={(el) => { if (el) el.indeterminate = someOnPageSelected }}
                    onChange={() => handleToggleSelectAll(pageLeadIds)}
                  />
                </TableHead>
              )}
              {/* Sticky: Actions */}
              <TableHead className={cn(
                'w-[130px] py-2 sticky z-20 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500',
                showSelect ? 'left-[36px]' : 'left-0',
              )}>
                Actions
              </TableHead>
              <TableHead className="w-[60px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Created</TableHead>
              {/* Sticky: Contact */}
              <TableHead className={cn(
                'min-w-[130px] py-2 sticky z-20 bg-slate-50 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] text-[11px] font-semibold uppercase tracking-wide text-slate-500',
                showSelect ? 'left-[166px]' : 'left-[130px]',
              )}>
                Contact
              </TableHead>
              <TableHead className="min-w-[120px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account</TableHead>
              <TableHead className="min-w-[150px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</TableHead>
              <TableHead className="w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</TableHead>

              <TableHead className="w-[110px] py-2">
                <ColHeader label="Stage" active={!!colFilters.stage} onClear={() => onColFilterChange('stage', '')}>
                  <DropdownMenuItem onClick={() => onColFilterChange('stage', '')}>All Stages</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {LEAD_STAGES.map(s => (
                    <DropdownMenuItem key={s} onClick={() => onColFilterChange('stage', s)}>
                      {STAGE_LABELS[s]}
                    </DropdownMenuItem>
                  ))}
                </ColHeader>
              </TableHead>

              <TableHead className="w-[80px] py-2">
                <ColHeader label="Cat." active={!!colFilters.category} onClear={() => onColFilterChange('category', '')}>
                  <DropdownMenuItem onClick={() => onColFilterChange('category', '')}>All</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {CATEGORY_FILTER_OPTIONS.map(c => (
                    <DropdownMenuItem key={c} onClick={() => onColFilterChange('category', c)}>{c}</DropdownMenuItem>
                  ))}
                </ColHeader>
              </TableHead>

              <TableHead className="w-[52px] py-2">
                <ColHeader label="Score" active={!!colFilters.score} onClear={() => onColFilterChange('score', '')}>
                  <DropdownMenuItem onClick={() => onColFilterChange('score', '')}>All Scores</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {SCORE_FILTER_OPTIONS.map(o => (
                    <DropdownMenuItem key={o.value} onClick={() => onColFilterChange('score', o.value)}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </ColHeader>
              </TableHead>

              <TableHead className="w-[72px] py-2">
                <ColHeader label="Hiring" active={!!colFilters.hiring} onClear={() => onColFilterChange('hiring', '')}>
                  <DropdownMenuItem onClick={() => onColFilterChange('hiring', '')}>All</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {HIRING_FILTER_OPTIONS.map(o => (
                    <DropdownMenuItem key={o.value} onClick={() => onColFilterChange('hiring', o.value)}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </ColHeader>
              </TableHead>

              <TableHead className="w-[72px] py-2">
                <ColHeader label="Source" active={!!colFilters.source} onClear={() => onColFilterChange('source', '')}>
                  <DropdownMenuItem onClick={() => onColFilterChange('source', '')}>All</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {LEAD_SOURCE_OPTIONS.map(s => (
                    <DropdownMenuItem key={s} onClick={() => onColFilterChange('source', s)}>
                      {LEAD_SOURCE_LABELS[s]}
                    </DropdownMenuItem>
                  ))}
                </ColHeader>
              </TableHead>

              <TableHead className="w-[96px] py-2">
                <ColHeader label="Relationship" active={!!colFilters.relationship} onClear={() => onColFilterChange('relationship', '')}>
                  <DropdownMenuItem onClick={() => onColFilterChange('relationship', '')}>All</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {CLIENT_RELATIONSHIP_OPTIONS.map(r => (
                    <DropdownMenuItem key={r} onClick={() => onColFilterChange('relationship', r)}>
                      {CLIENT_RELATIONSHIP_LABELS[r]}
                    </DropdownMenuItem>
                  ))}
                </ColHeader>
              </TableHead>

              <TableHead className="w-[76px] py-2">
                <ColHeader label="Co. Type" active={!!colFilters.companyType} onClear={() => onColFilterChange('companyType', '')}>
                  <DropdownMenuItem onClick={() => onColFilterChange('companyType', '')}>All</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {COMPANY_TYPE_OPTIONS.map(t => (
                    <DropdownMenuItem key={t} onClick={() => onColFilterChange('companyType', t)}>
                      {COMPANY_TYPE_LABELS[t]}
                    </DropdownMenuItem>
                  ))}
                </ColHeader>
              </TableHead>

              <TableHead className="w-[80px] py-2">
                <ColHeader label="Follow-up" active={!!colFilters.followup} onClear={() => onColFilterChange('followup', '')}>
                  <DropdownMenuItem onClick={() => onColFilterChange('followup', '')}>All</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {FOLLOWUP_FILTER_OPTIONS.map(o => (
                    <DropdownMenuItem key={o.value} onClick={() => onColFilterChange('followup', o.value)}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </ColHeader>
              </TableHead>

              <TableHead className="min-w-[90px] py-2">
                {isAdmin ? (
                  <OwnerColHeader value={colFilters.owner} onChange={(v) => onColFilterChange('owner', v)} />
                ) : (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Owner</span>
                )}
              </TableHead>

              <TableHead className="min-w-[150px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {leads.map((lead, idx) => {
              const isSelected = selectedIds.has(lead.lead_id)
              const rowBgClass = isSelected ? 'bg-blue-50' : 'bg-white'
              const rowHoverClass = isSelected ? 'group-hover:bg-blue-100' : 'group-hover:bg-slate-50'
              return (
              <TableRow
                key={lead.lead_id || idx}
                className={cn(
                  'group border-slate-100 transition-colors',
                  isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50',
                )}
              >
                {showSelect && (
                  <TableCell className={cn('py-1.5 sticky left-0 z-10 text-center', rowBgClass, rowHoverClass)}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${lead.contact_name ?? lead.email ?? 'lead'}`}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(lead.lead_id)}
                    />
                  </TableCell>
                )}
                {/* Sticky: Actions */}
                <TableCell className={cn(
                  'py-1.5 pr-1 sticky z-10',
                  showSelect ? 'left-[36px]' : 'left-0',
                  rowBgClass, rowHoverClass,
                )}>
                  <div className="flex items-center gap-0.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-slate-500 hover:text-slate-800')}
                        title="More Actions"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        <DropdownMenuItem onClick={() => router.push(`/dashboard/leads/${lead.lead_id}`)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {QUICK_STAGES.map((s) => (
                          <DropdownMenuItem
                            key={s.value}
                            disabled={lead.stage === s.value}
                            onClick={() => { void handleStageChange(lead.lead_id, s.value) }}
                          >
                            {s.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!lead.email}
                          onClick={() => {
                            if (!lead.email) return
                            navigator.clipboard.writeText(lead.email).then(
                              () => toast.success('Email copied'),
                              () => toast.error('Could not copy email'),
                            )
                          }}
                        >
                          Copy Email
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-700"
                              onClick={() => setDeleteLead(lead)}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Delete Lead
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                      title="Notes & Activity"
                      onClick={() => { void openNotesModal(lead) }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>

                    {(() => {
                      const blockReason = getEmailBlockReason(lead)
                      return (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 disabled:text-slate-300"
                          title={blockReason ? `Cannot email: ${blockReason}` : 'Send Outreach Email'}
                          disabled={!!blockReason}
                          onClick={() => { if (!blockReason) void openOutreachModal(lead) }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      )
                    })()}

                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-green-600 hover:text-green-800 hover:bg-green-50')}
                        title={`Call ${lead.phone}`}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled
                        title="No phone number"
                        className="text-slate-300"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Link
                      href={`/dashboard/leads/${lead.lead_id}/edit`}
                      className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-violet-500 hover:text-violet-700 hover:bg-violet-50')}
                      title="Edit Lead"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </TableCell>

                {/* Created */}
                <TableCell
                  className="py-1.5 text-slate-500 whitespace-nowrap"
                  title={new Date(lead.created_at).toLocaleString()}
                >
                  {fmtDate(lead.created_at)}
                </TableCell>

                {/* Sticky: Contact */}
                <TableCell className={cn(
                  'py-1.5 max-w-[160px] sticky z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]',
                  showSelect ? 'left-[166px]' : 'left-[130px]',
                  rowBgClass, rowHoverClass,
                )}>
                  <Link
                    href={`/dashboard/leads/${lead.lead_id}`}
                    className="group/contact inline-flex max-w-full items-center gap-1 font-medium text-blue-700 hover:text-blue-900 hover:underline underline-offset-2 cursor-pointer transition-colors"
                    title={lead.contact_name ? `${lead.contact_name} — open lead` : 'Open lead'}
                  >
                    <span className="truncate">{lead.contact_name ?? '—'}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/contact:opacity-100 transition-opacity" />
                  </Link>
                </TableCell>

                {/* Account */}
                <TableCell className="py-1.5 max-w-[140px]">
                  <span className="block truncate text-slate-600" title={lead.account ?? undefined}>
                    {lead.account ?? '—'}
                  </span>
                </TableCell>

                {/* Email */}
                <TableCell className="py-1.5 max-w-[170px]">
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="block truncate text-blue-600 hover:text-blue-800"
                      title={lead.email}
                    >
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>

                {/* Phone */}
                <TableCell className="py-1.5 whitespace-nowrap">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="text-slate-600 hover:text-blue-600">
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>

                {/* Stage */}
                <TableCell className="py-1.5">
                  <StageBadge stage={lead.stage} />
                </TableCell>

                {/* Category */}
                <TableCell className="py-1.5">
                  <CategoryBadge category={lead.category} />
                </TableCell>

                {/* Score */}
                <TableCell className="py-1.5 text-right">
                  <ScoreBadge score={lead.score} />
                </TableCell>

                {/* Hiring */}
                <TableCell className="py-1.5">
                  <HiringSignalBadge signal={lead.hiring_signal} />
                </TableCell>

                {/* Source */}
                <TableCell className="py-1.5 whitespace-nowrap text-slate-600">
                  {lead.lead_source ? (LEAD_SOURCE_LABELS[lead.lead_source] ?? lead.lead_source) : '—'}
                </TableCell>

                {/* Relationship */}
                <TableCell className="py-1.5 whitespace-nowrap text-slate-600">
                  {lead.client_relationship ? (CLIENT_RELATIONSHIP_LABELS[lead.client_relationship] ?? lead.client_relationship) : '—'}
                </TableCell>

                {/* Company Type */}
                <TableCell className="py-1.5 whitespace-nowrap text-slate-600">
                  {lead.company_type ? (COMPANY_TYPE_LABELS[lead.company_type] ?? lead.company_type) : '—'}
                </TableCell>

                {/* Next Follow-up */}
                <TableCell className="py-1.5 whitespace-nowrap text-slate-600">
                  {fmtFollowup(lead.next_followup_date)}
                </TableCell>

                {/* Owner */}
                <TableCell className="py-1.5 max-w-[110px]">
                  <span className="block truncate text-slate-600" title={lead.lead_owner_email ?? undefined}>
                    {ownerDisplay(lead)}
                  </span>
                </TableCell>

                {/* Notes */}
                <TableCell className="py-1.5 max-w-[180px]">
                  {lead.notes ? (
                    <span
                      className="block cursor-pointer truncate text-slate-500 hover:text-slate-800"
                      title={lead.notes}
                      onClick={() => { void openNotesModal(lead) }}
                    >
                      {lead.notes.length > 45 ? `${lead.notes.slice(0, 45)}…` : lead.notes}
                    </span>
                  ) : (
                    <span
                      className="cursor-pointer text-slate-300 hover:text-slate-500"
                      title="Add notes"
                      onClick={() => { void openNotesModal(lead) }}
                    >
                      Add note…
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Notes / Activity Modal */}
      <Dialog open={!!notesLead} onOpenChange={(open) => { if (!open) setNotesLead(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="text-base">
                {notesLead?.contact_name ?? 'Lead'} — Notes &amp; Activity
              </DialogTitle>
              {notesLead && (
                <Link
                  href={`/dashboard/leads/${notesLead.lead_id}`}
                  className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  onClick={() => setNotesLead(null)}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open full lead
                </Link>
              )}
            </div>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            {/* Editable notes */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes</p>
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                rows={4}
                placeholder="Add notes about this lead…"
                className="resize-none text-sm"
              />
              <Button
                size="sm"
                onClick={() => { void handleSaveNotes() }}
                disabled={notesSaving || editedNotes === (notesLead?.notes ?? '')}
                className="mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {notesSaving ? 'Saving…' : 'Save Notes'}
              </Button>
            </div>

            {/* Activity timeline */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recent Activity</p>
              {activitiesLoading ? (
                <div className="flex justify-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
                </div>
              ) : activities.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">No activity recorded yet.</p>
              ) : (
                <ul className="max-h-52 space-y-3 overflow-y-auto">
                  {dedupeActivities(activities).slice(0, 12).map((act, i) => (
                    <li key={act.activity_id || i} className="flex gap-2">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <div>
                        <p className="text-xs font-medium text-slate-800 capitalize">
                          {act.activity_type.replace(/_/g, ' ')}
                        </p>
                        {act.notes && <p className="text-xs text-slate-500">{act.notes}</p>}
                        <p className="text-[11px] text-slate-400">
                          {new Date(act.activity_date).toLocaleString()}
                          {act.performed_by && ` · ${act.performed_by}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Outreach Modal */}
      <Dialog open={!!outreachLead} onOpenChange={(open) => { if (!open) { setOutreachLead(null); setSendLoading(false) } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Send Outreach — {outreachLead?.contact_name ?? outreachLead?.email ?? 'Lead'}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            {outreachLead && getEmailBlockReason(outreachLead) && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-700">Cannot send outreach</p>
                <p className="mt-0.5 text-xs text-red-600">{getEmailBlockReason(outreachLead)}</p>
              </div>
            )}
            {templatesLoading ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-slate-500">
                No active email templates found. Create one in Email Templates.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Template</label>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={(v) => setSelectedTemplateId(v ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.template_id} value={t.template_id}>
                          {t.template_name}
                          {t.template_type ? ` · ${TEMPLATE_TYPE_LABELS[t.template_type] ?? t.template_type}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTemplate && outreachLead && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Subject</p>
                      <p className="mt-1 text-sm text-slate-900">
                        {interpolate(selectedTemplate.subject, outreachLead, profile?.name ?? profile?.email ?? '')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Body Preview</p>
                      <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-slate-700">
                        {interpolate(selectedTemplate.body, outreachLead, profile?.name ?? profile?.email ?? '')}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="text-xs text-slate-500">
              Recipient: <span className="font-medium">{outreachLead?.email ?? '—'}</span>
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { setOutreachLead(null); setSendLoading(false) }}
                disabled={sendLoading}
              >
                Close
              </Button>
              <Button
                onClick={() => { void handleSendOutreach() }}
                disabled={!selectedTemplate || sendLoading || templates.length === 0 || !!(outreachLead && getEmailBlockReason(outreachLead))}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {sendLoading ? 'Sending…' : 'Send via Automation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single-lead Delete confirm */}
      <Dialog open={!!deleteLead} onOpenChange={(open) => { if (!open) setDeleteLead(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" /> Delete this lead?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-700">
            {deleteLead?.contact_name ?? deleteLead?.email ?? 'This lead'} and all of its activity history will be permanently removed. This cannot be undone.
          </p>
          <DialogFooter className="mt-2 flex justify-end gap-2">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteLead(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={() => void handleDeleteSingle()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
