'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { LeadForm } from '@/components/leads/LeadForm'
import { buttonVariants } from '@/components/ui/button'
import type { Lead } from '@/lib/types'

export default function EditLeadPage() {
  const { lead_id } = useParams<{ lead_id: string }>()
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [lead, setLead] = useState<Lead | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('leads')
      .select('*')
      .eq('lead_id', lead_id)
      .single()
      .then((result: { data: unknown; error: unknown }) => {
        if (!result.data) {
          const err = result.error as { message?: string } | null
          setError(err?.message ?? 'Lead not found')
          return
        }
        setLead(result.data as Lead)
      })
  }, [lead_id, router, supabase])

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center max-w-md">
        <p className="text-sm font-medium text-red-700">Could not load lead</p>
        <p className="mt-1 text-xs text-red-500">{error}</p>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/leads/${lead_id}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8 text-slate-500')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Edit Lead</h2>
          <p className="text-xs text-slate-500">{lead.contact_name}</p>
        </div>
      </div>
      <LeadForm lead={lead} mode="edit" />
    </div>
  )
}
