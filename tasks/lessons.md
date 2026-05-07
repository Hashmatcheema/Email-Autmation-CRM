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

### shadcn/ui v4 — no asChild
This project uses Base UI (not Radix). There is no `asChild` prop. For button-styled links, apply `buttonVariants()` classes directly to `<Link>`. For `DropdownMenuTrigger` and `DialogTrigger`, apply `className` directly.
