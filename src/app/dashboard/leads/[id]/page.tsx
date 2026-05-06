'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, CheckCircle2, XCircle, Clock, Mail, Building2, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { STAGE_LABELS, STAGE_COLORS, type Lead, type LeadActivity } from '@/lib/types'

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: leadData }, { data: actData }] = await Promise.all([
        supabase.from('leads').select('*').eq('id', id).single(),
        supabase
          .from('lead_activities')
          .select('*')
          .eq('lead_id', id)
          .order('created_at', { ascending: false }),
      ])
      if (!leadData) { router.replace('/dashboard/leads'); return }
      setLead(leadData as Lead)
      setActivities((actData as LeadActivity[]) ?? [])
      setLoading(false)
    }
    load()
  }, [id, router, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
      </div>
    )
  }

  if (!lead) return null

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
        <Link
          href={`/dashboard/leads/${id}/edit`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 text-slate-700')}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
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
                    {lead.hiring_signal === true && (
                      <span className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        <CheckCircle2 className="h-3 w-3" /> Hiring Signal
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
                  </div>
                </div>
                {lead.score !== null && (
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-bold text-slate-900">{lead.score}</p>
                    <p className="text-xs text-slate-500">Score</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details grid */}
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="border-b border-slate-100 px-6 py-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lead Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <Detail label="Lead Owner" value={lead.lead_owner_email} />
              <Detail label="Hiring Signal">
                {lead.hiring_signal === true ? (
                  <span className="flex items-center gap-1 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" /> Yes
                  </span>
                ) : lead.hiring_signal === false ? (
                  <span className="flex items-center gap-1 text-sm text-slate-500">
                    <XCircle className="h-4 w-4" /> No
                  </span>
                ) : (
                  <span className="text-sm text-slate-400">—</span>
                )}
              </Detail>
              <Detail label="Created" value={new Date(lead.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
              {lead.updated_at && (
                <Detail label="Last Updated" value={new Date(lead.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
              )}
              {lead.notes && (
                <div className="sm:col-span-2">
                  <Detail label="Notes" value={lead.notes} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
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
                    <li key={act.id || idx} className="flex gap-3">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100">
                        <Clock className="h-3 w-3 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{act.activity_type}</p>
                        {act.description && (
                          <p className="mt-0.5 text-xs text-slate-500">{act.description}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(act.created_at).toLocaleString()}
                          {act.created_by && ` · ${act.created_by}`}
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
