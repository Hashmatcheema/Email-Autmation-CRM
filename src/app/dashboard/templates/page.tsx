'use client'

import { useEffect, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import type { EmailTemplate } from '@/lib/types'

const EMPTY_FORM = { template_name: '', template_type: '', subject: '', body: '', active: true }

export default function TemplatesPage() {
  const supabase = getSupabaseBrowserClient()
  const { profile } = useAuth()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createSaving, setCreateSaving] = useState(false)

  // edit dialog
  const [editTarget, setEditTarget] = useState<EmailTemplate | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)

  async function load() {
    const { data, error: err } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setTemplates((data as EmailTemplate[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [supabase])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateSaving(true)
    const { error: err } = await supabase.from('email_templates').insert({
      template_name: createForm.template_name,
      template_type: createForm.template_type || null,
      subject: createForm.subject,
      body: createForm.body,
      active: createForm.active,
      created_by: profile?.email,
    })
    if (err) { toast.error(err.message); setCreateSaving(false); return }
    toast.success('Template created')
    setCreateForm(EMPTY_FORM)
    setCreateOpen(false)
    setCreateSaving(false)
    load()
  }

  function openEdit(t: EmailTemplate) {
    setEditTarget(t)
    setEditForm({
      template_name: t.template_name,
      template_type: t.template_type ?? '',
      subject: t.subject,
      body: t.body,
      active: t.active ?? true,
    })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setEditSaving(true)
    const { error: err } = await supabase
      .from('email_templates')
      .update({
        template_name: editForm.template_name,
        template_type: editForm.template_type || null,
        subject: editForm.subject,
        body: editForm.body,
        active: editForm.active,
      })
      .eq('id', editTarget.id)
    if (err) { toast.error(err.message); setEditSaving(false); return }
    toast.success('Template updated')
    setEditTarget(null)
    setEditSaving(false)
    load()
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
            </DialogHeader>
            <TemplateForm
              form={createForm}
              setField={setCreate}
              onSubmit={handleCreate}
              saving={createSaving}
              submitLabel="Create Template"
            />
          </DialogContent>
        </Dialog>
      </div>

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
                <TableRow key={t.id || idx} className="border-slate-100 transition-colors hover:bg-slate-50">
                  <TableCell className="font-medium text-sm text-slate-900">{t.template_name}</TableCell>
                  <TableCell>
                    {t.template_type ? (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {t.template_type}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <span className="block truncate text-sm text-slate-600">{t.subject}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {t.active ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-slate-300" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Dialog
                      open={editTarget?.id === t.id}
                      onOpenChange={(open) => { if (!open) setEditTarget(null) }}
                    >
                      <DialogTrigger
                        onClick={() => openEdit(t)}
                        className={cn(
                          buttonVariants({ variant: 'ghost', size: 'icon' }),
                          'h-7 w-7 text-slate-400 hover:text-slate-700'
                        )}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Edit Template</DialogTitle>
                        </DialogHeader>
                        <TemplateForm
                          form={editForm}
                          setField={setEdit}
                          onSubmit={handleEdit}
                          saving={editSaving}
                          submitLabel="Save Changes"
                        />
                      </DialogContent>
                    </Dialog>
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
  active: boolean
}

function TemplateForm({
  form,
  setField,
  onSubmit,
  saving,
  submitLabel,
}: {
  form: FormFields
  setField: <K extends keyof FormFields>(k: K, v: FormFields[K]) => void
  onSubmit: (e: React.FormEvent) => void
  saving: boolean
  submitLabel: string
}) {
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
          <Input
            value={form.template_type}
            onChange={(e) => setField('template_type', e.target.value)}
            placeholder="e.g. cold, follow_up"
          />
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
        <Textarea
          rows={6}
          value={form.body}
          onChange={(e) => setField('body', e.target.value)}
          placeholder="Email body…"
          className="resize-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="active-toggle"
          type="checkbox"
          checked={form.active}
          onChange={(e) => setField('active', e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
        />
        <Label htmlFor="active-toggle" className="cursor-pointer text-sm text-slate-700">
          Active
        </Label>
      </div>
      <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
        {saving ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
