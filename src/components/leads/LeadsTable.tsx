'use client'

import Link from 'next/link'
import { Pencil, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { STAGE_LABELS, STAGE_COLORS, type Lead } from '@/lib/types'

export function LeadsTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-500">No leads found</p>
        <p className="mt-1 text-xs text-slate-400">Try adjusting your search or add a new lead.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">Score</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">Hiring</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead, idx) => (
            <TableRow
              key={lead.id || idx}
              className="border-slate-100 transition-colors hover:bg-slate-50"
            >
              <TableCell>
                <Link
                  href={`/dashboard/leads/${lead.id}`}
                  className="flex items-center gap-2.5 group"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                    {(lead.contact_name?.[0] ?? '?').toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-900 group-hover:text-blue-700 transition-colors">
                    {lead.contact_name ?? '—'}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-sm text-slate-600">{lead.account ?? '—'}</TableCell>
              <TableCell className="text-sm text-slate-500">{lead.email ?? '—'}</TableCell>
              <TableCell>
                {lead.stage ? (
                  <Badge
                    variant="secondary"
                    className={`border text-[11px] font-medium ${STAGE_COLORS[lead.stage] ?? STAGE_COLORS.new}`}
                  >
                    {STAGE_LABELS[lead.stage] ?? lead.stage}
                  </Badge>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell>
                {lead.category ? (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {lead.category}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {lead.score !== null ? (
                  <span className="text-sm font-semibold text-slate-700">{lead.score}</span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {lead.hiring_signal === true ? (
                  <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                ) : lead.hiring_signal === false ? (
                  <XCircle className="mx-auto h-4 w-4 text-slate-300" />
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="max-w-[140px]">
                <span className="truncate text-xs text-slate-500 block">{lead.lead_owner_email ?? '—'}</span>
              </TableCell>
              <TableCell>
                <Link
                  href={`/dashboard/leads/${lead.id}/edit`}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon' }),
                    'h-7 w-7 text-slate-400 hover:text-slate-700'
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
