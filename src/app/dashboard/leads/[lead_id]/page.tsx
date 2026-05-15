'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Pencil, CheckCircle2, XCircle, Clock, Mail, Building2,
  Phone, Globe, Send, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'
import { fetchLeadById, updateLeadStage } from '@/lib/services/leads'
import { fetchActivities, logActivity } from '@/lib/services/activities'
import { fetchActiveTemplates } from '@/lib/services/templates'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  STAGE_LABELS, STAGE_COLORS, TEMPLATE_TYPE_LABELS, HIRING_SIGNAL_LABELS,
  ACTIVITY_TYPE_LABELS,
  isHiringActive, type Lead, type LeadActivity, type EmailTemplate,
} from '@/lib/types'

const QUICK_STAGES = [
  'contacted',
  'follow_up',
  'replied',
  'interested',
  'not_interested',
  'do_not_contact',
] as const

const STAGE_GUIDANCE: Record<string, { title: string; description: string; colorClass: string }> = {
  new: { title: 'New Lead', description: 'This lead has not been contacted yet. Review their info and prepare an outreach email.', colorClass: 'bg-slate-50 border-slate-200 text-slate-700' },
  recommended: { title: 'Recommended for Outreach', description: 'This lead is recommended for outreach today. Send an initial email or make a call.', colorClass: 'bg-blue-50 border-blue-200 text-blue-700' },
  contacted: { title: 'Outreach Sent', description: 'Initial outreach has been sent. Wait for a reply or set a follow-up date.', colorClass: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  follow_up: { title: 'Follow-up Due', description: 'A follow-up is scheduled for this lead. Review the last interaction and reach out.', colorClass: 'bg-amber-50 border-amber-200 text-amber-700' },
  replied: { title: 'Lead Replied', description: "This lead replied to your outreach. Review their response and take the next step.", colorClass: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
  interested: { title: 'Lead Is Interested', description: 'This lead has shown interest. Qualify the opportunity and move toward a deal.', colorClass: 'bg-green-50 border-green-200 text-green-700' },
  not_interested: { title: 'Not Interested', description: 'This lead indicated they are not interested at this time. No further outreach needed.', colorClass: 'bg-rose-50 border-rose-200 text-rose-700' },
  do_not_contact: { title: 'Do Not Contact', description: 'This lead is suppressed. Do not send any outreach. Contact admin if this is in error.', colorClass: 'bg-red-50 border-red-200 text-red-700' },
  closed_won: { title: 'Closed Won', description: 'This deal has been won. Log any handoff notes or next steps.', colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  closed_lost: { title: 'Closed Lost', description: 'This deal has been closed and lost. No further action required.', colorClass: 'bg-gray-50 border-gray-200 text-gray-600' },
}

function getOutreachBlockReason(lead: Lead): string | null {
  if (!lead.email) return 'This lead has no email address on file.'
  if (lead.stage === 'do_not_contact') return 'This lead is marked Do Not Contact.'
  if (lead.unsubscribed) return 'This lead has unsubscribed from emails.'
  if (lead.bounce_status && lead.bounce_status.toLowerCase().includes('hard')) return 'This lead has a hard email bounce on record.'
  if (lead.complaint_status && !['none', ''].includes(lead.complaint_status.toLowerCase())) return 'This lead has a spam complaint on file.'
  if (lead.email_opt_in_status === false) return 'This lead has not opted in to email communications.'
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
    .replace(/\{\{hiring_signal\}\}/g, lead.hiring_signal ?? 'No')
}

function scoreColor(score: number | null) {
  if (score === null) return 'text-slate-400'
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-500'
}

export default function LeadDetailPage() {
  const { lead_id } = useParams<{ lead_id: string }>()
  const router = useRouter()
  const { profile } = useAuth()
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [stageLoading, setStageLoading] = useState<string | null>(null)

  // Outreach modal state
  const [outreachOpen, setOutreachOpen] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [sendLoading, setSendLoading] = useState(false)

  // Note input state
  const [noteText, setNoteText] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)

  const selectedTemplate = templates.find((t) => t.template_id === selectedTemplateId) ?? null

  useEffect(() => {
    async function load() {
      const [{ lead: l }, { activities: acts }] = await Promise.all([
        fetchLeadById(lead_id),
        fetchActivities(lead_id),
      ])
      if (!l) { router.replace('/dashboard/leads'); return }
      setLead(l)
      setActivities(acts)
      setLoading(false)
    }
    load()
  }, [lead_id, router])

  async function handleStageChange(newStage: string) {
    if (!profile || stageLoading) return
    setStageLoading(newStage)
    const { error } = await updateLeadStage(lead_id, newStage, profile.email)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Marked as ${STAGE_LABELS[newStage]}`)
      const [{ lead: l }, { activities: acts }] = await Promise.all([
        fetchLeadById(lead_id),
        fetchActivities(lead_id),
      ])
      if (l) { setLead(l); setActivities(acts) }
    }
    setStageLoading(null)
  }

  async function openOutreach() {
    if (templates.length === 0) {
      const { templates: t } = await fetchActiveTemplates()
      setTemplates(t)
    }
    setOutreachOpen(true)
  }

  async function handleSendOutreach() {
    if (!selectedTemplate || !lead || sendLoading) return
    setSendLoading(true)
    const senderName = profile?.name ?? profile?.email ?? ''
    const subject = interpolate(selectedTemplate.subject, lead, senderName)
    const body = interpolate(selectedTemplate.body, lead, senderName)

    const res = await fetch('/api/outreach/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: lead.lead_id,
        template_id: selectedTemplate.template_id,
        to_email: lead.email,
        subject,
        body,
        sender_email: profile?.email,
      }),
    })

    const json = (await res.json()) as { error?: string }

    if (!res.ok) {
      toast.error(json.error ?? 'Failed to send outreach')
      setSendLoading(false)
      return
    }

    await updateLeadStage(lead_id, 'contacted', profile?.email ?? 'unknown')
    toast.success('Outreach sent! Stage updated to Contacted.')
    setOutreachOpen(false)
    const [{ lead: l }, { activities: acts }] = await Promise.all([
      fetchLeadById(lead_id),
      fetchActivities(lead_id),
    ])
    if (l) { setLead(l); setActivities(acts) }
    setSendLoading(false)
  }

  async function handleAddNote() {
    if (!noteText.trim() || !profile || noteLoading) return
    setNoteLoading(true)
    const { error } = await logActivity(lead_id, 'note_added', noteText.trim(), profile.email)
    if (error) {
      toast.error('Failed to add note.')
    } else {
      toast.success('Note added to activity timeline.')
      setNoteText('')
      const { activities: acts } = await fetchActivities(lead_id)
      setActivities(acts)
    }
    setNoteLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
      </div>
    )
  }

  if (!lead) return null

  const outreachBlockReason = getOutreachBlockReason(lead)
  const guidance = STAGE_GUIDANCE[lead.stage ?? 'new'] ?? STAGE_GUIDANCE.new

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/leads"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8 text-slate-500')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-900 truncate">{lead.contact_name ?? '—'}</h2>
          {lead.account && <p className="text-xs text-slate-500">{lead.account}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-1.5', outreachBlockReason ? 'text-slate-400' : 'text-slate-700')}
          onClick={openOutreach}
          title={outreachBlockReason ?? 'Send outreach email'}
        >
          <Send className="h-3.5 w-3.5" />
          Send Outreach
        </Button>
        <Link
          href={`/dashboard/leads/${lead_id}/edit`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 text-slate-700')}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
      </div>

      {/* Action guidance card */}
      <div className={cn('rounded-lg border px-4 py-3', guidance.colorClass)}>
        <p className="text-xs font-semibold">{guidance.title}</p>
        <p className="mt-0.5 text-xs opacity-80">{guidance.description}</p>
      </div>

      {/* Quick stage actions */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_STAGES.map((s) => {
          const isCurrent = lead.stage === s
          return (
            <button
              key={s}
              type="button"
              disabled={isCurrent || !!stageLoading}
              onClick={() => handleStageChange(s)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                isCurrent
                  ? `${STAGE_COLORS[s]} cursor-default opacity-100`
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50'
              )}
            >
              {stageLoading === s ? '…' : STAGE_LABELS[s]}
            </button>
          )
        })}
      </div>

      <Tabs defaultValue="details">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">
            Activity ({activities.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          {/* Hero card */}
          <Card className="border-slate-200 shadow-none">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                  {(lead.contact_name?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`border text-xs font-medium ${STAGE_COLORS[lead.stage ?? 'new'] ?? STAGE_COLORS.new}`}
                    >
                      {STAGE_LABELS[lead.stage ?? 'new'] ?? lead.stage}
                    </Badge>
                    {lead.category && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {lead.category}
                      </span>
                    )}
                    {isHiringActive(lead.hiring_signal) && (
                      <span className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        <CheckCircle2 className="h-3 w-3" />
                        {HIRING_SIGNAL_LABELS[lead.hiring_signal!] ?? 'Hiring Signal'}
                      </span>
                    )}
                    {lead.is_daily_recommended && (
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Daily Recommended
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {lead.email}
                      </a>
                    )}
                    {lead.account && (
                      <span className="flex items-center gap-2 text-slate-600">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {lead.account}
                      </span>
                    )}
                    {lead.phone && (
                      <span className="flex items-center gap-2 text-slate-600">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {lead.phone}
                      </span>
                    )}
                    {lead.company_domain && (
                      <a
                        href={`https://${lead.company_domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-slate-600 hover:text-blue-600"
                      >
                        <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {lead.company_domain}
                      </a>
                    )}
                  </div>
                </div>
                {lead.score !== null && (
                  <div className="shrink-0 text-right">
                    <p className={`text-2xl font-bold ${scoreColor(lead.score)}`}>{lead.score}</p>
                    <p className="text-xs text-slate-500">Score</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Company Info */}
          {(lead.company_type || lead.industry || lead.size || lead.client_relationship) && (
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="border-b border-slate-100 px-6 py-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Company Info
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                {lead.company_type && <Detail label="Company Type" value={lead.company_type} />}
                {lead.industry && <Detail label="Industry" value={lead.industry} />}
                {lead.size && <Detail label="Size" value={lead.size} />}
                {lead.client_relationship && <Detail label="Relationship" value={lead.client_relationship} />}
              </CardContent>
            </Card>
          )}

          {/* Lead Intelligence */}
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="border-b border-slate-100 px-6 py-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lead Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <Detail label="Lead Owner" value={lead.lead_owner_email} />
              {lead.lead_owner_name && <Detail label="Owner Name" value={lead.lead_owner_name} />}
              {lead.lead_source && <Detail label="Source" value={lead.lead_source} />}
              <Detail label="Hiring Signal">
                {isHiringActive(lead.hiring_signal) ? (
                  <span className="flex items-center gap-1 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {HIRING_SIGNAL_LABELS[lead.hiring_signal!] ?? lead.hiring_signal}
                  </span>
                ) : lead.hiring_signal && !['no_signal', 'unknown', 'No'].includes(lead.hiring_signal) ? (
                  <span className="text-sm text-slate-700">{HIRING_SIGNAL_LABELS[lead.hiring_signal] ?? lead.hiring_signal}</span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-slate-500">
                    <XCircle className="h-4 w-4" />
                    {lead.hiring_signal ? (HIRING_SIGNAL_LABELS[lead.hiring_signal] ?? lead.hiring_signal) : '—'}
                  </span>
                )}
              </Detail>
              {lead.hiring_signal_details && (
                <div className="sm:col-span-2">
                  <Detail label="Hiring Details" value={lead.hiring_signal_details} />
                </div>
              )}
              {lead.next_followup_date && (
                <Detail
                  label="Next Follow-up"
                  value={new Date(lead.next_followup_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                />
              )}
              <Detail
                label="Created"
                value={new Date(lead.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              />
              {lead.last_updated && (
                <Detail
                  label="Last Updated"
                  value={new Date(lead.last_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                />
              )}
              {lead.notes && (
                <div className="sm:col-span-2">
                  <Detail label="Notes" value={lead.notes} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaign Status */}
          {(lead.campaign_status || lead.bounce_status || lead.complaint_status) && (
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="border-b border-slate-100 px-6 py-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Campaign Status
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                {lead.campaign_status && (
                  <Detail label="Campaign">
                    <StatusPill value={lead.campaign_status} />
                  </Detail>
                )}
                {lead.bounce_status && lead.bounce_status !== 'none' && (
                  <Detail label="Bounce">
                    <StatusPill value={lead.bounce_status} danger />
                  </Detail>
                )}
                {lead.complaint_status && lead.complaint_status !== 'none' && (
                  <Detail label="Complaint">
                    <StatusPill value={lead.complaint_status} danger />
                  </Detail>
                )}
                {lead.email_opt_in_status !== undefined && lead.email_opt_in_status !== null && (
                  <Detail label="Opt-in">
                    <span className={cn('text-sm font-medium', lead.email_opt_in_status ? 'text-green-700' : 'text-red-600')}>
                      {lead.email_opt_in_status ? 'Yes' : 'No'}
                    </span>
                  </Detail>
                )}
                {lead.unsubscribed && (
                  <Detail label="Unsubscribed">
                    <span className="text-sm font-medium text-red-600">Yes</span>
                  </Detail>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-4">
          {/* Add note */}
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="border-b border-slate-100 px-6 py-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Add Note
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex gap-2">
                <textarea
                  className="flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
                  rows={2}
                  placeholder="Add a note about this lead…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) void handleAddNote() }}
                />
                <Button
                  size="sm"
                  onClick={() => void handleAddNote()}
                  disabled={!noteText.trim() || noteLoading}
                  className="self-end bg-blue-600 hover:bg-blue-700"
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  {noteLoading ? 'Saving…' : 'Add Note'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activity timeline */}
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="border-b border-slate-100 px-6 py-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {activities.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">No activity recorded yet.</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {activities.map((act, idx) => (
                    <li key={act.activity_id || idx} className="flex gap-3">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100">
                        <Clock className="h-3 w-3 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {ACTIVITY_TYPE_LABELS[act.activity_type] ?? act.activity_type.replace(/_/g, ' ')}
                        </p>
                        {act.notes && (
                          <p className="mt-0.5 text-xs text-slate-500">{act.notes}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(act.activity_date).toLocaleString()}
                          {act.performed_by && ` · ${act.performed_by}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Outreach Modal */}
      <Dialog open={outreachOpen} onOpenChange={setOutreachOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Send Outreach</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {outreachBlockReason && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-700">Cannot send outreach</p>
                <p className="mt-0.5 text-xs text-red-600">{outreachBlockReason}</p>
              </div>
            )}
            {templates.length === 0 ? (
              <p className="text-sm text-slate-500">No active email templates found. Create one in Email Templates.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Template</label>
                  <Select value={selectedTemplateId} onValueChange={(v) => setSelectedTemplateId(v ?? '')}>
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

                {selectedTemplate && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Subject</p>
                      <p className="mt-1 text-sm text-slate-900">
                        {interpolate(selectedTemplate.subject, lead, profile?.name ?? profile?.email ?? '')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Body Preview</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700 max-h-48 overflow-y-auto">
                        {interpolate(selectedTemplate.body, lead, profile?.name ?? profile?.email ?? '')}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOutreachOpen(false)} disabled={sendLoading}>
                Close
              </Button>
              <Button
                onClick={handleSendOutreach}
                disabled={!selectedTemplate || sendLoading || !!outreachBlockReason}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {sendLoading ? 'Sending…' : 'Send via Automation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Detail({
  label,
  value,
  children,
}: {
  label: string
  value?: string | null
  children?: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1">
        {children ?? <p className="text-sm text-slate-700">{value ?? '—'}</p>}
      </div>
    </div>
  )
}

function StatusPill({ value, danger }: { value: string; danger?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
      danger
        ? 'bg-red-50 text-red-700'
        : 'bg-slate-100 text-slate-700'
    )}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}
