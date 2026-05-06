import { LeadForm } from '@/components/leads/LeadForm'

export default function NewLeadPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Add Lead</h2>
        <p className="text-xs text-slate-500 mt-0.5">Create a new lead record.</p>
      </div>
      <LeadForm mode="create" />
    </div>
  )
}
