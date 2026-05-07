# Production Readiness — Todo

## Phase 1: Foundation
- [x] Create tasks/todo.md and tasks/lessons.md
- [x] Update CLAUDE.md with concise project rules
- [x] Expand src/lib/types.ts (additional Lead fields + constants)
- [x] Create src/lib/services/leads.ts
- [x] Create src/lib/services/activities.ts
- [x] Create src/lib/services/templates.ts

## Phase 2: Leads List
- [x] src/app/dashboard/leads/page.tsx — server-side search, filters, pagination
- [x] src/components/leads/LeadsTable.tsx — no changes needed

## Phase 3: Lead Form
- [x] src/components/leads/LeadForm.tsx — 4 fieldsets, activity logging on save

## Phase 4: Lead Detail
- [x] src/app/dashboard/leads/[lead_id]/page.tsx — stage actions, more sections, outreach modal

## Phase 5: Templates
- [x] src/app/dashboard/templates/page.tsx — type dropdown, variable chips

## Phase 6: Reports
- [x] src/app/dashboard/reports/page.tsx — 5 metric cards, follow-up alert, selective columns

## Phase 7: Dashboards
- [x] src/app/dashboard/admin/page.tsx — service layer, selective columns, pulse skeletons
- [x] src/app/dashboard/sales/page.tsx — service layer, selective columns, pulse skeletons

## Phase 8: Quality Check
- [x] npm run lint — all clean
- [x] npm run build — all clean (12/12 routes)
