# Development Steps for Claude Code

This file tells Claude Code how to iteratively build and extend the EduMark AI app.
Always follow these steps in order for new work.

## 1. Understand the Feature Request
- Read the user's latest message carefully.
- Map the request to affected areas using `CLAUDE.md` Rules Index and `architecture.md`.
- Identify which rule files apply (database, ai-integration, billing, etc.) and open them.

## 2. Locate the Right Files
- Use `architecture.md` to find the exact folder and filename for the feature.
- Do NOT create duplicate files (e.g. `batch.ts` and `batches.ts`).
- If a file does not exist yet but is listed in `architecture.md`, create it in that path.

## 3. Design Data Flow First
For any new feature:
- Start from the **user action** (UI) and trace:
  `component -> hook -> /api route -> lib/db + lib/ai -> Supabase/Claude/Stripe`.
- Sketch (in comments) the input and output shapes.
- Confirm which tables and columns are touched by reading `database.md`.

### Example (Mark Papers Flow)
- Component: `BatchDetail` -> "Mark all" button
- Hook: `useBatchDetail` triggers `POST /api/batches/[id]/dispatch`
- API route: `app/api/batches/[id]/dispatch/route.ts`
  - Reads tutor from auth
  - Calls `getBillingStatus` + `checkAndDeductMinutes`
  - Calls `dispatchMarkingBatch(batchId)` in `lib/ai/batch-dispatcher.ts`
- AI: `dispatchMarkingBatch`
  - Loads batch context (submissions, scheme)
  - Calls Claude Batch API with prompt caching
  - Saves results to `marking_results`

## 4. Follow Security Rules
- RLS: assume **all** tables have RLS enabled.
- All DB writes go through `lib/db/*` or SQL functions defined in `database.md`.
- Billing fields (`plan`, `ai_minutes_*`, `stripe_*`) are write-protected; only:
  - Stripe webhook (service-role client), and
  - `increment_ai_minutes_used` / `add_topup_minutes`
  may modify them.
- Stripe webhook must use raw body (`req.text()`) + `constructEvent()`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or Stripe secrets to the client.

## 5. Implement in Thin Vertical Slices
For each user story, implement a **thin vertical slice**:
1. Database changes (if any) — update `supabase/migrations` + `database.md`.
2. `lib/db/*` functions — typed wrappers for all queries.
3. `lib/ai/*` or `lib/stripe/*` changes — pure domain logic.
4. `app/api/*` route — HTTP glue only.
5. `hooks/*` — SWR hook for client data.
6. `components/*` — UI wiring.

Do not jump straight into components without the lower layers.

## 6. Keep Types Tight
- Use Zod schemas in `lib/validations/schemas.ts` for any request body.
- In `/api` routes, validate `req.json()` against Zod before calling lib functions.
- Return typed responses and re-use those types in hooks.

## 7. Test Locally in Dev
- Use `stripe listen --forward-to localhost:3000/api/stripe/webhook` to test billing flows.
- Use `supabase start` + `supabase db reset` when adding new migrations.
- For Claude calls in dev, consider a "dry-run" flag that logs prompts instead of hitting the API.

## 8. When Extending Billing or AI Minutes
- Update `database.md` for any new billing-related columns or functions.
- Update `billing.md` if plan structure or prices change.
- Update `stripe-integration.md` if new Stripe events or flows are added.
- Ensure `feature-gating.md` stays in sync with how gating actually works.

## 9. When Adding a New Subject or Medium
- Check `subjects` table in `database.md`.
- Update language handling rules in `ai-integration.md`.
- Make sure UI uses `SubjectBadge` and correct dropdown values.

## 10. Keep Docs and Code in Lockstep
After any non-trivial change:
- Update the relevant `.claude/rules/*.md` files in the same PR.
- Never leave docs stale; Claude Code relies on them for context.
- If in doubt, favour **updating docs first**, then code.
