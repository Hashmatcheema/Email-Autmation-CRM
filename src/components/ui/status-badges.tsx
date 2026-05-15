import { STAGE_LABELS, STAGE_COLORS, isHiringActive } from '@/lib/types'

const CATEGORY_COLORS: Record<string, string> = {
  Hot: 'bg-red-50 text-red-700 border-red-200',
  Warm: 'bg-amber-50 text-amber-700 border-amber-200',
  Cold: 'bg-sky-50 text-sky-700 border-sky-200',
  'Not Relevant': 'bg-slate-100 text-slate-500 border-slate-200',
}

const HIRING_SHORT_LABELS: Record<string, string> = {
  active_contract_hiring: 'Contract',
  active_fulltime_hiring: 'Full-Time',
  active_hiring: 'Hiring',
  weak_hiring: 'Weak',
  no_signal: 'None',
  unknown: '—',
  Yes: 'Hiring',
  No: 'None',
}

export function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-xs text-slate-400">—</span>
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STAGE_COLORS[stage] ?? STAGE_COLORS.new}`}
    >
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}

export function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return <span className="text-xs text-slate-400">—</span>
  const colors = CATEGORY_COLORS[category] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colors}`}>
      {category}
    </span>
  )
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined)
    return <span className="text-xs text-slate-400">—</span>
  const colorClass =
    score >= 90
      ? 'bg-green-100 text-green-800 ring-1 ring-green-300'
      : score >= 70
        ? 'bg-emerald-50 text-emerald-700'
        : score >= 40
          ? 'bg-amber-50 text-amber-700'
          : 'bg-slate-100 text-slate-500'
  return (
    <span
      className={`inline-flex min-w-[28px] items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {score}
    </span>
  )
}

export function HiringSignalBadge({ signal }: { signal: string | null }) {
  if (!signal || signal === 'unknown' || signal === 'No' || signal === 'no_signal') {
    return <span className="text-xs text-slate-400">—</span>
  }
  const active = isHiringActive(signal)
  const label = HIRING_SHORT_LABELS[signal] ?? signal
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${
        active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {label}
    </span>
  )
}
