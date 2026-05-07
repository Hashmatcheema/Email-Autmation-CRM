# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Commands

```bash
npm run dev       # start dev server on http://localhost:3000
npm run build     # production build
npm run lint      # ESLint
npx tsc --noEmit  # type-check without building
```

## Project Rules

1. Plan first for any non-trivial change (multiple files or architectural decisions).
2. Make the smallest correct change possible. Touch only files required for the task.
3. Do not rewrite working code unless it is clearly wrong or the task requires it.
4. Prefer reusable components and service functions over duplicated logic.
5. **Use `lead_id` as the primary key for leads — never `id`.** All Supabase queries on leads must use `.eq('lead_id', value)`.
6. **Use `template_id` as the primary key for email_templates — never `id`.**
7. **Never assume a Supabase column exists based on TypeScript types alone.** Optional fields (`field?: string | null`) only suppress TS errors — Supabase returns a `400` if you select or write a column that does not exist. Verify every column against the confirmed schema before using it in a query or payload.
8. **Build passing does not mean runtime queries are correct.** Always verify actual browser console and Supabase REST responses after schema-sensitive changes.
9. **`leads.updated_at` does not exist** — use `last_updated` instead. **`leads.hiring_signal` is text** (values: `'Yes'`, `'No'`, or null) — not boolean.
9. Preserve existing Supabase schema, RLS, and column names. Do not add/rename/drop columns without explaining why.
10. Never expose API keys, secrets, or service-role credentials in frontend code.
11. Frontend must never call Gmail, Brevo, OpenAI, Apollo, Apify, or Oorwin directly. Use n8n webhooks.
12. Use selective `select()` columns — avoid `select('*')` on large tables in list/dashboard queries. `LIST_COLUMNS` constants must only contain confirmed columns.
13. Paginate list queries. Default page size: 50. Use Supabase `range()` with `count: 'exact'`.
14. Log a `lead_activities` row on every stage change, lead create, and lead edit.
15. Before marking any task done: run `npm run lint` and `npm run build` and fix all errors.
16. When fixing bugs, find the root cause. Do not patch symptoms.
17. Record repeated mistakes and important lessons in `tasks/lessons.md`.

## Architecture

**Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui v4 (Base UI) · Supabase Auth + PostgreSQL

### Auth flow

1. `src/proxy.ts` — protects `/dashboard/**`, redirects unauthenticated users to `/login`.
2. `AuthProvider` (`src/components/providers/AuthProvider.tsx`) — loads `user_profiles` row by email after login. Exposes `{ session, user, profile, loading, signOut }` via `useAuth()`.
3. `/dashboard/page.tsx` — redirects to `/dashboard/admin` (role=admin) or `/dashboard/sales` (role=sales).

### Role-based data access

- `admin` — queries all leads.
- `sales` — queries only leads where `lead_owner_email = profile.email`.

### Supabase clients

- `src/lib/supabase/client.ts` — singleton browser client. Use in all `'use client'` components and service files.
- `src/lib/supabase/server.ts` — server client with cookies. Use in Server Components / Route Handlers.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

### Service layer

Shared data-access logic lives in `src/lib/services/`. Components should call service functions instead of writing inline Supabase queries.

- `src/lib/services/leads.ts` — lead queries, stage updates
- `src/lib/services/activities.ts` — activity log reads and writes
- `src/lib/services/templates.ts` — template queries

### shadcn/ui v4 (Base UI) — key differences

This project uses shadcn/ui v4 which wraps **Base UI** (not Radix UI):
- **No `asChild` prop** anywhere. Apply `buttonVariants` classes directly to `<Link>` for button-styled links.
- `DropdownMenuTrigger` / `DialogTrigger` accept `className` directly.
- Supabase queries without a DB schema type return `any` — always cast: `(data as Lead[]) ?? []`.
- `DropdownMenuLabel` must use a plain `<div>` — `MenuPrimitive.GroupLabel` requires a Group ancestor and crashes without one.

### Existing Supabase tables (do not create new tables, rename columns, or overwrite RLS)

**`user_profiles`**
| Column | Type |
|--------|------|
| `user_id` | uuid PK |
| `email` | text |
| `role` | text — `admin` or `sales` |
| `name` | text |

**`leads`** — PK is `lead_id`
| Column | Type |
|--------|------|
| `lead_id` | uuid PK |
| `contact_name` | text |
| `account` | text (company name) |
| `email` | text |
| `phone` | text |
| `stage` | text — see stages below |
| `category` | text |
| `score` | numeric |
| `hiring_signal` | **text** — values: `'Yes'`, `'No'`, or null (NOT boolean) |
| `lead_owner_email` | text |
| `notes` | text |
| `created_at` | timestamptz |
| `last_updated` | timestamptz (NOT `updated_at`) |
| `company_domain` | text |
| `company_type` | text |
| `client_relationship` | text |
| `industry` | text |
| `size` | text |
| `lead_source` | text |
| `lead_owner_name` | text |
| `hiring_signal_details` | text |
| `next_followup_date` | date |
| `campaign_status` | text |
| `bounce_status` | text |
| `complaint_status` | text |
| `email_opt_in_status` | boolean |
| `unsubscribed` | boolean |
| `is_daily_recommended` | boolean |
| `created_by_email` | text |
| `created_by_name` | text |

**Lead stages** (exact values stored in DB):
`new` · `recommended` · `contacted` · `follow_up` · `replied` · `interested` · `not_interested` · `do_not_contact` · `closed_won` · `closed_lost`

**`lead_activities`** — PK is `activity_id`
| Column | Type |
|--------|------|
| `activity_id` | uuid PK |
| `lead_id` | uuid FK → leads |
| `activity_type` | text |
| `notes` | text (NOT `description`) |
| `performed_by` | text (NOT `created_by`) |
| `activity_date` | timestamptz (NOT `created_at`) |

**`email_templates`** — PK is `template_id`
| Column | Type |
|--------|------|
| `template_id` | uuid PK |
| `template_name` | text |
| `template_type` | text — one of: `initial_outreach`, `follow_up_1`, `follow_up_2`, `follow_up_3`, `campaign` |
| `subject` | text |
| `body` | text |
| `is_active` | boolean (NOT `active`) |
| `created_by_email` | text |
| `created_at` | timestamptz |

### External integrations (never call from browser)

Gmail, Brevo, OpenAI, Apollo, Apify, and Oorwin must only be called via n8n webhook endpoints — never directly from `'use client'` components.

### Page map

```
/login                          Login
/dashboard                      Role-based redirect
/dashboard/admin                Admin dashboard (all leads stats)
/dashboard/sales                Sales dashboard (own leads stats)
/dashboard/leads                Leads list — search, filters, pagination
/dashboard/leads/new            Add lead
/dashboard/leads/[lead_id]      Lead detail + activity timeline + stage actions
/dashboard/leads/[lead_id]/edit Edit lead
/dashboard/templates            Email templates (table + create/edit dialogs)
/dashboard/reports              Stage funnel + owner breakdown + metrics
```
