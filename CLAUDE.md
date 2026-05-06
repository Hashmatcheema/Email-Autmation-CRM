# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server on http://localhost:3000
npm run build     # production build
npm run lint      # ESLint
npx tsc --noEmit  # type-check without building
```

## Architecture

**Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui v4 (Base UI) · Supabase Auth + PostgreSQL

### Auth flow

1. `src/proxy.ts` — protects `/dashboard/**`, redirects unauthenticated users to `/login` (Next.js 16 renamed `middleware.ts` → `proxy.ts`; export must be named `proxy`).
2. `AuthProvider` (`src/components/providers/AuthProvider.tsx`) — loads `user_profiles` row **by email** after login and exposes `{ session, user, profile, loading, signOut }` via `useAuth()`.
3. `/dashboard/page.tsx` — redirects to `/dashboard/admin` (role=admin) or `/dashboard/sales` (role=sales).

### Role-based data access

- `admin` — queries all leads.
- `sales` — queries only leads where `lead_owner_email = profile.email`.

### Supabase clients

- `src/lib/supabase/client.ts` — singleton browser client. Use in all `'use client'` components.
- `src/lib/supabase/server.ts` — server client with cookies. Use in Server Components / Route Handlers.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

### shadcn/ui v4 (Base UI) — key differences

This project uses shadcn/ui v4 which wraps **Base UI** (not Radix UI):
- **No `asChild` prop** anywhere. Use `buttonVariants` class directly on `<Link>` for button-styled links.
- `DropdownMenuTrigger` / `DialogTrigger` accept `className` directly — apply `buttonVariants` to them.
- Supabase queries without a DB schema type return `any` — always cast: `(data as Lead[]) ?? []`.

### Existing Supabase tables (do not create new tables, rename columns, or overwrite RLS)

**`user_profiles`**
| Column | Type |
|--------|------|
| `id` | uuid PK |
| `email` | text |
| `role` | text — `admin` or `sales` |
| `full_name` | text |

**`leads`**
| Column | Type |
|--------|------|
| `id` | uuid PK |
| `contact_name` | text |
| `account` | text (company name) |
| `email` | text |
| `phone` | text |
| `stage` | text — see stages below |
| `category` | text |
| `score` | numeric |
| `hiring_signal` | boolean |
| `lead_owner_email` | text |
| `notes` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

**Lead stages** (exact values stored in DB):
`new` · `recommended` · `contacted` · `follow_up` · `replied` · `interested` · `not_interested` · `do_not_contact` · `closed_won` · `closed_lost`

**`lead_activities`**
| Column | Type |
|--------|------|
| `id` | uuid PK |
| `lead_id` | uuid FK → leads |
| `activity_type` | text |
| `description` | text |
| `created_by` | text |
| `created_at` | timestamptz |

**`email_templates`**
| Column | Type |
|--------|------|
| `id` | uuid PK |
| `template_name` | text |
| `template_type` | text |
| `subject` | text |
| `body` | text |
| `active` | boolean |
| `created_by` | text |
| `created_at` | timestamptz |

### External integrations (never call from browser)

Gmail, Brevo, OpenAI, Apollo, Apify, and Oorwin must only be called via n8n webhook endpoints — never directly from `'use client'` components.

### Page map

```
/login                        Login
/dashboard                    Role-based redirect
/dashboard/admin              Admin dashboard (all leads stats)
/dashboard/sales              Sales dashboard (own leads stats)
/dashboard/leads              Leads list with search
/dashboard/leads/new          Add lead
/dashboard/leads/[id]         Lead detail + activity timeline
/dashboard/leads/[id]/edit    Edit lead
/dashboard/templates          Email templates (table + create/edit dialogs)
/dashboard/reports            Stage funnel + owner breakdown
```
