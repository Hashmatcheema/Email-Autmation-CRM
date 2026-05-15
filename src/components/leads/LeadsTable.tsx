'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreVertical, FileText, Mail, Phone, Pencil, Send, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
import { updateLeadStage } from '@/lib/services/leads'
import {
  STAGE_LABELS, TEMPLATE_TYPE_LABELS,
  CLIENT_RELATIONSHIP_LABELS, COMPANY_TYPE_LABELS, LEAD_SOURCE_LABELS,
  type Lead, type LeadActivity, type EmailTemplate,
} from '@/lib/types'

const QUICK_STAGES = [
  { value: 'contacted', label: 'Mark Contacted' },
  { value: 'follow_up', label: 'Mark Follow Up' },
  { value: 'replied', label: 'Mark Replied' },
  { value: 'interested', label: 'Mark Interested' },
  { value: 'not_interested', label: 'Mark Not Interested' },
  { value: 'do_not_contact', label: 'Mark Do Not Contact' },
] as const

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

interface Props {
  leads: Lead[]
  onRefresh: () => void
}

export function LeadsTable({ leads, onRefresh }: Props) {
  const { profile } = useAuth()
  const router = useRouter()

  // Notes / activity modal
  const [notesLead, setNotesLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  // Outreach modal
  const [outreachLead, setOutreachLead] = useState<Lead | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)

  const selectedTemplate = templates.find((t) => t.template_id === selectedTemplateId) ?? null

  async function openNotesModal(lead: Lead) {
    setNotesLead(lead)
    setActivities([])
    setActivitiesLoading(true)
    const { activities: acts } = await fetchActivities(lead.lead_id)
    setActivities(acts)
    setActivitiesLoading(false)
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
              <TableHead className="w-[130px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Actions</TableHead>
              <TableHead className="w-[60px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Created</TableHead>
              <TableHead className="min-w-[130px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Contact</TableHead>
              <TableHead className="min-w-[120px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account</TableHead>
              <TableHead className="min-w-[150px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</TableHead>
              <TableHead className="w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</TableHead>
              <TableHead className="w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stage</TableHead>
              <TableHead className="w-[80px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cat.</TableHead>
              <TableHead className="w-[52px] py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Score</TableHead>
              <TableHead className="w-[72px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hiring</TableHead>
              <TableHead className="w-[72px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Source</TableHead>
              <TableHead className="w-[96px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Relationship</TableHead>
              <TableHead className="w-[76px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Co. Type</TableHead>
              <TableHead className="w-[80px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Follow-up</TableHead>
              <TableHead className="min-w-[90px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Owner</TableHead>
              <TableHead className="min-w-[150px] py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {leads.map((lead, idx) => (
              <TableRow
                key={lead.lead_id || idx}
                className="border-slate-100 transition-colors hover:bg-slate-50"
              >
                {/* Actions */}
                <TableCell className="py-1.5 pr-1">
                  <div className="flex items-center gap-0.5">
                    {/* More actions — slate */}
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
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Notes — amber */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                      title="Notes & Activity"
                      onClick={() => { void openNotesModal(lead) }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>

                    {/* Email — blue; disabled with reason if blocked */}
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

                    {/* Call — green */}
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

                    {/* Edit — violet */}
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

                {/* Contact */}
                <TableCell className="py-1.5 max-w-[160px]">
                  <Link
                    href={`/dashboard/leads/${lead.lead_id}`}
                    className="block truncate font-medium text-slate-900 hover:text-blue-700 transition-colors"
                    title={lead.contact_name ?? undefined}
                  >
                    {lead.contact_name ?? '—'}
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
                  {lead.lead_source
                    ? (LEAD_SOURCE_LABELS[lead.lead_source] ?? lead.lead_source)
                    : '—'}
                </TableCell>

                {/* Relationship */}
                <TableCell className="py-1.5 whitespace-nowrap text-slate-600">
                  {lead.client_relationship
                    ? (CLIENT_RELATIONSHIP_LABELS[lead.client_relationship] ?? lead.client_relationship)
                    : '—'}
                </TableCell>

                {/* Company Type */}
                <TableCell className="py-1.5 whitespace-nowrap text-slate-600">
                  {lead.company_type
                    ? (COMPANY_TYPE_LABELS[lead.company_type] ?? lead.company_type)
                    : '—'}
                </TableCell>

                {/* Next Follow-up */}
                <TableCell className="py-1.5 whitespace-nowrap text-slate-600">
                  {fmtFollowup(lead.next_followup_date)}
                </TableCell>

                {/* Owner */}
                <TableCell className="py-1.5 max-w-[110px]">
                  <span
                    className="block truncate text-slate-600"
                    title={lead.lead_owner_email ?? undefined}
                  >
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
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Notes / Activity Modal */}
      <Dialog open={!!notesLead} onOpenChange={(open) => { if (!open) setNotesLead(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {notesLead?.contact_name ?? 'Lead'} — Notes &amp; Activity
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            {notesLead?.notes && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{notesLead.notes}</p>
              </div>
            )}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recent Activity</p>
              {activitiesLoading ? (
                <div className="flex justify-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
                </div>
              ) : activities.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">No activity recorded yet.</p>
              ) : (
                <ul className="max-h-60 space-y-3 overflow-y-auto">
                  {activities.slice(0, 10).map((act, i) => (
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
                          {t.template_type
                            ? ` · ${TEMPLATE_TYPE_LABELS[t.template_type] ?? t.template_type}`
                            : ''}
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
    </>
  )
}
