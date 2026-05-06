'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { LEAD_STAGES, STAGE_LABELS, type Lead } from '@/lib/types'

interface Props {
  lead?: Lead
  mode: 'create' | 'edit'
}

export function LeadForm({ lead, mode }: Props) {
  const supabase = getSupabaseBrowserClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    contact_name: lead?.contact_name ?? '',
    account: lead?.account ?? '',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    stage: lead?.stage ?? 'new',
    category: lead?.category ?? '',
    score: lead?.score?.toString() ?? '',
    hiring_signal: lead?.hiring_signal ?? false,
    lead_owner_email: lead?.lead_owner_email ?? '',
    notes: lead?.notes ?? '',
  })

  function setField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const payload = {
      contact_name: form.contact_name || null,
      account: form.account || null,
      email: form.email || null,
      phone: form.phone || null,
      stage: form.stage || null,
      category: form.category || null,
      score: form.score !== '' ? parseFloat(form.score) : null,
      hiring_signal: form.hiring_signal,
      lead_owner_email: form.lead_owner_email || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }

    let error
    if (mode === 'create') {
      ;({ error } = await supabase.from('leads').insert(payload))
    } else {
      ;({ error } = await supabase.from('leads').update(payload).eq('id', lead!.id))
    }

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    toast.success(mode === 'create' ? 'Lead created' : 'Lead updated')
    router.push('/dashboard/leads')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Basic Info */}
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
          <Field label="Account / Company">
            <Input
              value={form.account}
              onChange={(e) => setField('account', e.target.value)}
              placeholder="Company name"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="email@example.com"
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

          <Field label="Score">
            <Input
              type="number"
              value={form.score}
              onChange={(e) => setField('score', e.target.value)}
              placeholder="0 – 100"
              min="0"
              max="100"
            />
          </Field>

          <Field label="Lead Owner Email">
            <Input
              type="email"
              value={form.lead_owner_email}
              onChange={(e) => setField('lead_owner_email', e.target.value)}
              placeholder="owner@example.com"
            />
          </Field>

          <div className="flex items-center gap-3 pt-1 sm:col-span-2">
            <input
              id="hiring_signal"
              type="checkbox"
              checked={form.hiring_signal}
              onChange={(e) => setField('hiring_signal', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600"
            />
            <Label htmlFor="hiring_signal" className="cursor-pointer text-sm font-medium text-slate-700">
              Hiring Signal detected
            </Label>
          </div>
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
