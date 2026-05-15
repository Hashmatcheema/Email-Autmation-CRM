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
- [x] src/components/leads/LeadsTable.tsx — hiring_signal as text display

## Phase 3: Lead Form
- [x] src/components/leads/LeadForm.tsx — 4 fieldsets, activity logging on save, full payload

## Phase 4: Lead Detail
- [x] src/app/dashboard/leads/[lead_id]/page.tsx — stage actions, sections, outreach modal

## Phase 5: Templates
- [x] src/app/dashboard/templates/page.tsx — type dropdown, variable chips, is_active

## Phase 6: Reports
- [x] src/app/dashboard/reports/page.tsx — 5 metric cards, selective columns

## Phase 7: Dashboards
- [x] src/app/dashboard/admin/page.tsx — service layer, selective columns, pulse skeletons
- [x] src/app/dashboard/sales/page.tsx — service layer, selective columns, pulse skeletons

## Phase 8: Schema Correctness Pass
- [x] Fix email_templates.active → is_active (types, service, page)
- [x] Fix lead_activities column names (activity_id, notes, activity_date, performed_by)
- [x] Fix leads.hiring_signal boolean → text (LeadsTable, LeadForm, reports, leads page filter)
- [x] Fix leads.updated_at → last_updated (LeadForm payload, updateLeadStage, lead detail display)
- [x] Fix user_profiles.full_name → name, id → user_id (types, Header, Sidebar, LeadForm)
- [x] Expand LeadForm payload with all confirmed DB columns
- [x] Update CLAUDE.md schema tables to match real DB
- [x] Update tasks/lessons.md with column rename rules and build ≠ runtime lesson
- [x] npm run lint — clean
- [x] npm run build — clean (12/12 routes)

## Phase 9: Operational CRM Pass (2026-05-08)
- [x] Fix DB check constraint violation — company_type, client_relationship, lead_source, hiring_signal all use correct DB values
- [x] Update COMPANY_TYPE_OPTIONS, CLIENT_RELATIONSHIP_OPTIONS, LEAD_SOURCE_OPTIONS, add HIRING_SIGNAL_OPTIONS with labels in types.ts
- [x] Add normalizeLegacyHiringSignal() to migrate old 'Yes'/'No' values on form load
- [x] LeadForm — use constrained dropdowns for all 4 constrained fields; human-readable constraint error message
- [x] Fix Sidebar active state — Dashboard highlights correctly for /dashboard/admin and /dashboard/sales; same-route click no-op
- [x] Fix template edit — openEdit now fetches full template body before opening modal
- [x] Improve template variable UX — blue chips, helper text, live preview panel below body textarea
- [x] Dashboard (admin + sales) — action-focused with Quick Actions, Follow-ups Due, Recommended Leads sections
- [x] Reports — analytics-focused: added Leads by Category, Top Scored Leads, Overdue Follow-ups
- [x] CSV Import — /dashboard/leads/import with drag-drop, auto column mapping, preview, validation, batch insert
- [x] Leads page — Import CSV button (admin only)
- [x] Outreach foundation — /api/outreach/send route calls N8N_SEND_EMAIL_WEBHOOK server-side; 503 if not configured
- [x] Lead detail — Send via n8n button calls API route; on success updates stage + logs activity
- [x] CLAUDE.md — added check constraint values, n8n note, dashboard vs reports distinction
- [x] lessons.md — added constraint lesson, Oorwin lesson, dashboard vs reports, n8n lesson
- [x] npm run lint — clean
- [x] npm run build — clean (14/14 routes)

## Phase 10: Compact Sales Operations Leads Table (2026-05-12)

### Plan
- [x] src/components/ui/status-badges.tsx — StageBadge, CategoryBadge, ScoreBadge, HiringSignalBadge
- [x] src/lib/services/leads.ts — expand LIST_COLUMNS (phone, lead_source, company_type, lead_owner_name, notes, next_followup_date, last_updated, industry); add category filter + sorting to fetchLeads
- [x] src/components/leads/LeadsTable.tsx — compact 16-col table; row action icons (MoreVertical dropdown, Notes modal, Mail outreach, Phone call, Pencil edit); lazy-load activities in Notes modal; lazy-load templates in Outreach modal
- [x] src/app/dashboard/leads/page.tsx — add category filter, sort dropdown, page size selector; pass onRefresh callback to table
- [x] docs/recommended-indexes.sql — index recommendations (no migration applied)
- [x] Update docs/current-status.md and tasks/lessons.md
- [x] npm run lint — clean · npm run build — clean (14/14 routes)

### What is intentionally NOT built in this phase
- last_communication column (not in confirmed DB schema — display omitted)
- Gmail thread icon (no gmail_thread_url column in confirmed schema)
- Dynamic category values from DB (hardcoded known values in filter)
- Sticky actions column (overflow-x-auto is sufficient for now)

## Next Phase (post-10)
- [ ] Configure N8N_SEND_EMAIL_WEBHOOK in .env.local to enable actual email sending
- [ ] Admin role management UI — view/edit user_profiles (name, role)
- [ ] Lead deduplication on CSV import (check by email against DB before insert)
- [ ] Follow-up alerts — toast/badge when followupsDue > 0 on dashboard load
- [ ] Lead list export (CSV download from current filtered view)
