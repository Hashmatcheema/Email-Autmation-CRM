'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS, type EmailTemplate } from '@/lib/types'

const VARIABLES: { label: string; value: string }[] = [
  { label: 'First Name', value: '{{first_name}}' },
  { label: 'Company Name', value: '{{company_name}}' },
  { label: 'Contact Name', value: '{{contact_name}}' },
  { label: 'Sender Name', value: '{{sender_name}}' },
  { label: 'Industry', value: '{{industry}}' },
  { label: 'Hiring Signal', value: '{{hiring_signal}}' },
]

const PREVIEW_SAMPLE: Record<string, string> = {
  '{{first_name}}': 'John',
  '{{company_name}}': 'ABC Technologies',
  '{{contact_name}}': 'John Doe',
  '{{sender_name}}': 'Hashmat',
  '{{industry}}': 'Technology',
  '{{hiring_signal}}': 'Active Hiring',
}

function previewText(text: string): string {
  return Object.entries(PREVIEW_SAMPLE).reduce((s, [k, v]) => s.replaceAll(k, v), text)
}

const EMPTY_FORM = { template_name: '', template_type: '', subject: '', body: '', is_active: true }

export default function TemplatesPage() {
  const supabase = getSupabaseBrowserClient()
  const { profile } = useAuth()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createSaving, setCreateSaving] = useState(false)

  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    async function fetchTemplates() {
      const { data, error: err } = await supabase
        .from('email_templates')
        .select('template_id,template_name,template_type,subject,is_active')
        .order('template_name', { ascending: true })
      if (err) { setError(err.message); setLoading(false); return }
      setTemplates((data as EmailTemplate[]) ?? [])
      setLoading(false)
    }
    fetchTemplates()
  }, [supabase, refreshKey])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateSaving(true)
    const { error: err } = await supabase.from('email_templates').insert({
      template_name: createForm.template_name,
      template_type: createForm.template_type || null,
      subject: createForm.subject,
      body: createForm.body,
      is_active: createForm.is_active,
      created_by_email: profile?.email ?? null,
    })
    if (err) { toast.error(err.message); setCreateSaving(false); return }
    toast.success('Template created')
    setCreateForm(EMPTY_FORM)
    setCreateOpen(false)
    setCreateSaving(false)
    setRefreshKey((k) => k + 1)
  }

  async function openEdit(t: EmailTemplate) {
    const { data } = await supabase
      .from('email_templates')
      .select('template_id,template_name,template_type,subject,body,is_active')
      .eq('template_id', t.template_id)
      .single()
    const full = (data as EmailTemplate | null) ?? t
    setEditForm({
      template_name: full.template_name,
      template_type: full.template_type ?? '',
      subject: full.subject,
      body: full.body ?? '',
      is_active: full.is_active ?? true,
    })
    setSelectedTemplate(full)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTemplate) return
    setEditSaving(true)

    const { error: err } = await supabase
      .from('email_templates')
      .update({
        template_name: editForm.template_name,
        template_type: editForm.template_type || null,
        subject: editForm.subject,
        body: editForm.body,
        is_active: editForm.is_active,
      })
      .eq('template_id', selectedTemplate.template_id)
    if (err) { toast.error(err.message); setEditSaving(false); return }
    toast.success('Template updated')
    setSelectedTemplate(null)
    setEditSaving(false)
    setRefreshKey((k) => k + 1)
  }

  function setCreate<K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) {
    setCreateForm((p) => ({ ...p, [k]: v }))
  }
  function setEdit<K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) {
    setEditForm((p) => ({ ...p, [k]: v }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Email Templates</h2>
          <p className="text-xs text-slate-500 mt-0.5">{loading ? '…' : `${templates.length} templates`}</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 bg-blue-600 hover:bg-blue-700')}>
            <Plus className="h-4 w-4" />
            New Template
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
            </DialogHeader>
            <TemplateForm
              form={createForm}
              setField={setCreate}
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
              saving={createSaving}
              submitLabel="Create Template"
            />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={selectedTemplate !== null}
        onOpenChange={(open) => { if (!open) setSelectedTemplate(null) }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <TemplateForm
            form={editForm}
            setField={setEdit}
            onSubmit={handleEdit}
            onCancel={() => setSelectedTemplate(null)}
            saving={editSaving}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load templates</p>
          <p className="mt-1 text-xs text-red-500">{error}</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-500">No templates yet</p>
          <p className="mt-1 text-xs text-slate-400">Create your first email template to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">Active</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t, idx) => (
                <TableRow key={t.template_id || idx} className="border-slate-100 transition-colors hover:bg-slate-50">
                  <TableCell className="font-medium text-sm text-slate-900">{t.template_name}</TableCell>
                  <TableCell>
                    {t.template_type ? (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {TEMPLATE_TYPE_LABELS[t.template_type] ?? t.template_type}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <span className="block truncate text-sm text-slate-600">{t.subject}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {t.is_active ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-slate-300" />
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'h-7 w-7 text-slate-400 hover:text-slate-700'
                      )}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

interface FormFields {
  template_name: string
  template_type: string
  subject: string
  body: string
  is_active: boolean
}

function TemplateForm({
  form,
  setField,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}: {
  form: FormFields
  setField: <K extends keyof FormFields>(k: K, v: FormFields[K]) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  saving: boolean
  submitLabel: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insertVariable(variable: string) {
    const el = textareaRef.current
    if (!el) {
      setField('body', form.body + variable)
      return
    }
    const start = el.selectionStart ?? form.body.length
    const end = el.selectionEnd ?? form.body.length
    const next = form.body.slice(0, start) + variable + form.body.slice(end)
    setField('body', next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + variable.length, start + variable.length)
    })
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            value={form.template_name}
            onChange={(e) => setField('template_name', e.target.value)}
            required
            placeholder="e.g. Cold Outreach v1"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Type</Label>
          <Select value={form.template_type} onValueChange={(v) => setField('template_type', v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {TEMPLATE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-700">
          Subject <span className="text-red-500">*</span>
        </Label>
        <Input
          value={form.subject}
          onChange={(e) => setField('subject', e.target.value)}
          required
          placeholder="Email subject line"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-700">Body</Label>
        <div className="flex flex-wrap gap-1 mb-1">
          {VARIABLES.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => insertVariable(value)}
              className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mb-1">Variables are inserted as placeholders and replaced automatically when sending.</p>
        <Textarea
          ref={textareaRef}
          rows={6}
          value={form.body}
          onChange={(e) => setField('body', e.target.value)}
          placeholder="Email body… Click a variable chip above to insert it."
          className="resize-none font-mono text-xs"
        />
        {form.body && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Preview (sample data)</p>
            <p className="whitespace-pre-wrap text-xs text-slate-700 max-h-32 overflow-y-auto">{previewText(form.body)}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="active-toggle"
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setField('is_active', e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
        />
        <Label htmlFor="active-toggle" className="cursor-pointer text-sm text-slate-700">
          Active
        </Label>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
