'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import { logActivity } from '@/lib/services/activities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  LEAD_STAGES, STAGE_LABELS,
  COMPANY_TYPE_OPTIONS, COMPANY_TYPE_LABELS,
  CLIENT_RELATIONSHIP_OPTIONS, CLIENT_RELATIONSHIP_LABELS,
  LEAD_SOURCE_OPTIONS, LEAD_SOURCE_LABELS,
  HIRING_SIGNAL_OPTIONS, HIRING_SIGNAL_LABELS,
  normalizeLegacyHiringSignal,
  isHiringActive,
  type Lead,
} from '@/lib/types'

interface Props {
  lead?: Lead
  mode: 'create' | 'edit'
}

export function LeadForm({ lead, mode }: Props) {
  const supabase = getSupabaseBrowserClient()
  const router = useRouter()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    contact_name: lead?.contact_name ?? '',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    account: lead?.account ?? '',
    company_domain: lead?.company_domain ?? '',
    company_type: lead?.company_type ?? 'unknown',
    industry: lead?.industry ?? '',
    size: lead?.size ?? '',
    client_relationship: lead?.client_relationship ?? 'unknown',
    stage: lead?.stage ?? 'new',
    category: lead?.category ?? '',
    score: lead?.score?.toString() ?? '',
    lead_source: lead?.lead_source ?? 'manual',
    lead_owner_email: lead?.lead_owner_email ?? '',
    lead_owner_name: lead?.lead_owner_name ?? '',
    hiring_signal: normalizeLegacyHiringSignal(lead?.hiring_signal),
    hiring_signal_details: lead?.hiring_signal_details ?? '',
    next_followup_date: lead?.next_followup_date?.slice(0, 10) ?? '',
    notes: lead?.notes ?? '',
  })

  function setField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const now = new Date().toISOString()
    const str = (v: string) => v.trim() || null
    const scoreVal = form.score !== '' ? parseFloat(form.score) : null

    const payload: Record<string, unknown> = {
      contact_name: str(form.contact_name),
      email: str(form.email),
      phone: str(form.phone),
      account: str(form.account),
      company_domain: str(form.company_domain),
      company_type: str(form.company_type) || 'unknown',
      industry: str(form.industry),
      size: str(form.size),
      client_relationship: str(form.client_relationship) || 'unknown',
      stage: form.stage || 'new',
      category: str(form.category),
      score: scoreVal,
      lead_source: str(form.lead_source) || 'manual',
      lead_owner_email: str(form.lead_owner_email),
      lead_owner_name: str(form.lead_owner_name),
      hiring_signal: str(form.hiring_signal) || 'unknown',
      hiring_signal_details: str(form.hiring_signal_details),
      next_followup_date: str(form.next_followup_date),
      notes: str(form.notes),
      last_updated: now,
    }

    if (mode === 'create') {
      Object.assign(payload, {
        created_at: now,
        campaign_status: 'not_sent',
        bounce_status: 'none',
        complaint_status: 'none',
        email_opt_in_status: true,
        unsubscribed: false,
        created_by_email: profile?.email ?? null,
        created_by_name: profile?.name ?? null,
      })
    }

    let error
    let newLeadId: string | null = null

    if (mode === 'create') {
      const result = await supabase.from('leads').insert(payload).select('lead_id').single()
      error = result.error
      newLeadId = (result.data as { lead_id: string } | null)?.lead_id ?? null
    } else {
      const result = await supabase
        .from('leads')
        .update(payload)
        .eq('lead_id', lead!.lead_id)
      error = result.error
      newLeadId = lead!.lead_id
    }

    if (error) {
      const msg = error.message.includes('violates check constraint')
        ? 'Invalid value selected for a field. Please choose from the allowed dropdown values.'
        : error.message
      toast.error(msg)
      setLoading(false)
      return
    }

    const actorEmail = profile?.email ?? 'unknown'
    if (newLeadId) {
      await logActivity(
        newLeadId,
        mode === 'create' ? 'lead_created' : 'lead_updated',
        mode === 'create'
          ? `Lead created by ${actorEmail}`
          : `Lead updated by ${actorEmail}`,
        actorEmail
      )
    }

    // Best-effort: notify n8n for enrichment / downstream workflows.
    // DB write above is the source of truth; webhook failure does not block the user.
    if (newLeadId) {
      try {
        const res = await fetch('/api/n8n/leads/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            lead_id: newLeadId,
            mode: mode === 'create' ? 'create' : 'update',
            created_by_email: profile?.email ?? null,
            created_by_name: profile?.name ?? null,
          }),
        })
        if (!res.ok && res.status !== 503) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          toast.warning(`Lead saved, but automation notify failed: ${j.error ?? res.status}`)
        }
      } catch {
        // Non-fatal — DB save already succeeded
      }
    }

    toast.success(mode === 'create' ? 'Lead created' : 'Lead updated')

    if (newLeadId) {
      router.push(`/dashboard/leads/${newLeadId}`)
    } else {
      router.push('/dashboard/leads')
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* Contact Info */}
      <fieldset className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Contact Info
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact Name" required>
            <Input
              value={form.contact_name}
              onChange={(e) => setField('contact_name', e.target.value)}
              placeholder="Full name"
              required
            />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="email@example.com"
              required
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </Field>
        </div>
      </fieldset>

      {/* Company Info */}
      <fieldset className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Company Info
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account / Company" required>
            <Input
              value={form.account}
              onChange={(e) => setField('account', e.target.value)}
              placeholder="Company name"
              required
            />
          </Field>
          <Field label="Website / Domain">
            <Input
              value={form.company_domain}
              onChange={(e) => setField('company_domain', e.target.value)}
              placeholder="example.com"
            />
          </Field>
          <Field label="Company Type">
            <Select value={form.company_type} onValueChange={(v) => setField('company_type', v ?? 'unknown')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{COMPANY_TYPE_LABELS[o] ?? o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Industry">
            <Input
              value={form.industry}
              onChange={(e) => setField('industry', e.target.value)}
              placeholder="e.g. Technology, Finance"
            />
          </Field>
          <Field label="Company Size">
            <Input
              value={form.size}
              onChange={(e) => setField('size', e.target.value)}
              placeholder="e.g. 50-200, 500+"
            />
          </Field>
          <Field label="Relationship">
            <Select value={form.client_relationship} onValueChange={(v) => setField('client_relationship', v ?? 'unknown')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_RELATIONSHIP_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{CLIENT_RELATIONSHIP_LABELS[o] ?? o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </fieldset>

      {/* Lead Details */}
      <fieldset className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Lead Details
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stage">
            <Select value={form.stage} onValueChange={(v) => { if (v) setField('stage', v) }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Category">
            <Input
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
              placeholder="e.g. Enterprise, SMB"
            />
          </Field>

          <Field label="Score (0–100)">
            <Input
              type="number"
              value={form.score}
              onChange={(e) => setField('score', e.target.value)}
              placeholder="0 – 100"
              min="0"
              max="100"
            />
          </Field>

          <Field label="Lead Source">
            <Select value={form.lead_source} onValueChange={(v) => setField('lead_source', v ?? 'manual')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select source…" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{LEAD_SOURCE_LABELS[o] ?? o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Lead Owner Email" required>
            <Input
              type="email"
              value={form.lead_owner_email}
              onChange={(e) => setField('lead_owner_email', e.target.value)}
              placeholder="owner@example.com"
              required
            />
          </Field>

          <Field label="Lead Owner Name">
            <Input
              value={form.lead_owner_name}
              onChange={(e) => setField('lead_owner_name', e.target.value)}
              placeholder="Full name"
            />
          </Field>

          <Field label="Next Follow-up Date">
            <Input
              type="date"
              value={form.next_followup_date}
              onChange={(e) => setField('next_followup_date', e.target.value)}
            />
          </Field>

          <Field label="Hiring Signal">
            <Select value={form.hiring_signal} onValueChange={(v) => setField('hiring_signal', v ?? 'unknown')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {HIRING_SIGNAL_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{HIRING_SIGNAL_LABELS[o] ?? o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {isHiringActive(form.hiring_signal) && (
            <div className="sm:col-span-2">
              <Field label="Hiring Signal Details">
                <Input
                  value={form.hiring_signal_details}
                  onChange={(e) => setField('hiring_signal_details', e.target.value)}
                  placeholder="e.g. 5 open SDE roles on LinkedIn"
                />
              </Field>
            </div>
          )}
        </div>
      </fieldset>

      {/* Notes */}
      <fieldset className="rounded-xl border border-slate-200 bg-white p-6">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</legend>
        <Textarea
          rows={4}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Any additional context about this lead…"
          className="mt-2 resize-none"
        />
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
          {loading ? 'Saving…' : mode === 'create' ? 'Create Lead' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
    </div>
  )
}
