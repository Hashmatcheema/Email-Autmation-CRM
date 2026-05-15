# Lessons Learned

## Session 1 — Bug Fixes (May 2026)

### Base UI: MenuGroupLabel crash
`DropdownMenuLabel` used `MenuPrimitive.GroupLabel` which requires a `<Menu.Group>` ancestor. Base UI enforces this via context — using it outside a Group causes a runtime crash. Fix: replace with a plain `<div>`.

### lead_id vs id
The DB primary key for the leads table is `lead_id`, not `id`. The TypeScript interface had `id: string` which caused `column leads.id does not exist` errors. Always use `lead_id` in queries, route params, and `useParams<{ lead_id: string }>()`.

### Next.js dynamic route segments
The folder name `[id]` vs `[lead_id]` directly determines what `useParams()` returns. Renaming requires creating new folder and deleting old one — just renaming the file inside does not work.

### react-hooks/set-state-in-effect lint rule
Calling a function that contains setState directly inside `useEffect(() => { load() }, [])` triggers this lint error. Fix: define the async function inline inside the effect body.

### Build cache after route deletion
After deleting `[id]/` and creating `[lead_id]/`, the `.next` build cache still referenced the old path causing TypeScript errors. Fix: delete `.next` directory before rebuilding.

### Template modal — controlled dialog pattern
Multiple `DialogTrigger` components inside table rows conflict with a controlled `open` prop on a parent `Dialog`. Fix: single `Dialog` controlled by `selectedTemplate` state (null = closed), placed outside the table. Row buttons are plain `<button>` elements that call `setSelectedTemplate(row)`.

### Never assume Supabase column names — verify the real schema first
TypeScript optional fields (`field?: string | null`) do not prove a DB column exists. Supabase returns a `400 REST error` if you `select()` or `insert/update` a column that does not exist in the table. Optional types only suppress TypeScript errors — they do not protect against runtime failures.

**Rules for this project:**
- `leads` PK = `lead_id`. Never use `leads.id`.
- `email_templates` PK = `template_id`. Never use `email_templates.id`.
- `lead_activities` PK = `activity_id`. Columns: `notes` (not `description`), `performed_by` (not `created_by`), `activity_date` (not `created_at`).
- `user_profiles` PK = `user_id`. Name column is `name` (not `full_name`).
- `leads.updated_at` does NOT exist — use `last_updated`.
- `leads.hiring_signal` is **text** (values: `'Yes'`, `'No'`, null), not boolean. Never compare with `=== true/false`.
- `email_templates.active` does NOT exist — use `is_active`.
- Before adding any column to a query or payload, verify it exists in the actual Supabase schema — not just the TypeScript type.
- List/dashboard/report queries must use an explicit `LIST_COLUMNS` constant containing only confirmed columns. Never default to `select('*')` in list queries.

### Build passing ≠ runtime correctness
A successful `npm run build` only proves TypeScript types are consistent — it does NOT prove Supabase queries work at runtime. TypeScript optional fields (`field?: string | null`) suppress TS errors but Supabase still returns a `400 REST error` if you select or write a column that doesn't exist in the DB.

**Always verify after schema-sensitive changes:**
1. Open the browser and navigate to the affected page
2. Check the browser console for red errors
3. Check Network tab for Supabase `400` responses
4. Only then mark the task done

### DB check constraints — Oorwin is a lead_source, not a company_type
The `leads` table has DB-level check constraints on several text columns. Entering an invalid value (e.g. "Oorwin" in company_type) causes a `400: new row violates check constraint` error. Always use the allowed values defined in `src/lib/types.ts` constants and only expose dropdowns — never free-text inputs — for constrained fields.

**Allowed values (must match exactly):**
- `company_type`: `startup`, `smb`, `enterprise`, `unknown`
- `client_relationship`: `current_client`, `past_client`, `partner`, `prospect`, `potential_lead`, `unknown`
- `lead_source`: `manual`, `growjo`, `google_sheet`, `csv_import`, `linkedin_job_fetcher`, `api_import`, `oorwin`, `other_workflow`
- `hiring_signal`: `active_contract_hiring`, `active_fulltime_hiring`, `active_hiring`, `weak_hiring`, `no_signal`, `unknown`

Legacy data may contain `'Yes'`/`'No'` for hiring_signal. Use `normalizeLegacyHiringSignal()` on form load to migrate automatically.

### Dashboard vs Reports are different pages with different purposes
Dashboard = action-focused: KPI cards, recommended leads, follow-ups due, quick actions (Add Lead, Import CSV).
Reports = analytics-focused: funnel by stage, breakdown by owner/category, top scored leads, overdue follow-ups.
Never duplicate the dashboard layout in reports.

### n8n outreach — never send email directly from frontend
Frontend calls `/api/outreach/send` (Next.js App Router route). That route reads `N8N_SEND_EMAIL_WEBHOOK` (server env var, NOT `NEXT_PUBLIC_`) and POSTs to n8n. If env var is missing, route returns 503. Frontend shows the error toast — never fake a successful send.

### shadcn/ui v4 — no asChild
This project uses Base UI (not Radix). There is no `asChild` prop. For button-styled links, apply `buttonVariants()` classes directly to `<Link>`. For `DropdownMenuTrigger` and `DialogTrigger`, apply `className` directly.

### react-hooks/set-state-in-effect — define async load inline inside useEffect
Extracting an async load function with `useCallback` then calling it in `useEffect` triggers the `react-hooks/set-state-in-effect` ESLint error because the linter sees `load()` as calling setState from an external reference. Fix: define the async function **inside** the `useEffect` body. For a manual refresh trigger (e.g., after a stage change), use a `refreshKey` counter state in the dependency array: `const [refreshKey, setRefreshKey] = useState(0)` → increment to re-run the effect.

### Compact table — LIST_COLUMNS must match selected columns exactly
When adding columns to a compact table (phone, lead_source, company_type, lead_owner_name, notes, next_followup_date, last_updated, industry), update `LIST_COLUMNS` in the service first, then reference those fields in the component. Never reference a field in the component unless it is in LIST_COLUMNS and confirmed in the CLAUDE.md schema table. `last_communication` is NOT in the confirmed schema — do not query it.
