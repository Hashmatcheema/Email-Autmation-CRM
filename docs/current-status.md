# Current Status — EITACIES CRM Platform

Last updated: 2026-05-12

## What Is Complete

### Core CRM
- **Login** — Supabase Auth, email/password, middleware-protected dashboard
- **Leads List** (`/dashboard/leads`) — compact high-density table (16 cols); server-side search, stage/category/owner/hiring filters, sort (8 options), page size (25/50/100); row actions: stage dropdown, notes/activity modal (lazy), outreach modal (lazy), call link, edit link; StageBadge, CategoryBadge, ScoreBadge, HiringSignalBadge components
- **Add Lead** (`/dashboard/leads/new`) — all fields, constrained dropdowns, activity log on create
- **Edit Lead** (`/dashboard/leads/[lead_id]/edit`) — same form, legacy hiring_signal auto-migrated
- **Lead Detail** (`/dashboard/leads/[lead_id]`) — hero card, company info, lead intelligence, campaign status, quick stage actions, activity timeline, outreach modal
- **Email Templates** (`/dashboard/templates`) — create/edit in modal, variable chips, live preview, is_active toggle
- **Reports** (`/dashboard/reports`) — stage funnel, owner breakdown, category breakdown, top scored leads, overdue follow-ups
- **Admin Dashboard** (`/dashboard/admin`) — action-focused: KPIs + quick actions + recommended leads + follow-ups due + recent leads
- **Sales Dashboard** (`/dashboard/sales`) — same but scoped to own leads
- **CSV Import** (`/dashboard/leads/import`) — drag-drop upload, auto column mapping, preview, batch insert with activity logging
- **Outreach API Route** (`/api/outreach/send`) — server-side n8n webhook bridge

### Service Layer
- `src/lib/services/leads.ts` — fetchLeads, fetchLeadById, fetchLeadStats, updateLeadStage
- `src/lib/services/activities.ts` — logActivity, fetchActivities
- `src/lib/services/templates.ts` — fetchTemplates, fetchActiveTemplates

## Tables Connected

| Table | Operations |
|-------|-----------|
| `leads` | SELECT (list, detail, stats), INSERT, UPDATE |
| `lead_activities` | SELECT (timeline), INSERT (on every create/edit/stage change) |
| `email_templates` | SELECT (list, detail for edit, active for outreach), INSERT, UPDATE |
| `user_profiles` | SELECT (on login via AuthProvider) |

## Pages & Routes

| Route | Status | Notes |
|-------|--------|-------|
| `/login` | ✅ | Supabase Auth |
| `/dashboard` | ✅ | Redirects by role |
| `/dashboard/admin` | ✅ | Action dashboard |
| `/dashboard/sales` | ✅ | Own-leads dashboard |
| `/dashboard/leads` | ✅ | Paginated list |
| `/dashboard/leads/new` | ✅ | Create form |
| `/dashboard/leads/[lead_id]` | ✅ | Detail + stage actions + outreach |
| `/dashboard/leads/[lead_id]/edit` | ✅ | Edit form |
| `/dashboard/leads/import` | ✅ | CSV import (admin) |
| `/dashboard/templates` | ✅ | Template management |
| `/dashboard/reports` | ✅ | Analytics |
| `/api/outreach/send` | ✅ | n8n webhook bridge (needs env var) |

- **Recommended DB indexes** — `docs/recommended-indexes.sql` (review before applying)

## Intentionally Not Built Yet

- **Actual email sending** — `/api/outreach/send` is wired but needs `N8N_SEND_EMAIL_WEBHOOK` in `.env.local`
- **Admin role management** — no UI to view/edit `user_profiles` (role, name)
- **Lead deduplication on import** — CSV import does not check DB for duplicate emails
- **Lead list export** — no CSV download from the filtered leads view
- **Follow-up notification badges** — `followupsDue` count exists in stats but no persistent badge/alert UI
- **RLS enforcement** — UI respects roles but Supabase RLS policies are not set up (noted in CLAUDE.md)

## Next Phase Priority

1. Set `N8N_SEND_EMAIL_WEBHOOK` env var to enable outreach sending
2. Admin role management UI
3. Lead CSV export
4. Lead dedup on import (check by email)
