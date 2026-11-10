# Trainer planning implementation — 2026-11-09

## Implemented behavior
The existing `/console` trainer workspace now provides a program library, independent multi-week calendar, workout template library and measurement-aware workout editor. The established slate/lime identity and authenticated tenant context remain in use. Phone layouts use a day selector, vertical workout editing, a full-screen exercise picker and a persistent action bar. Inputs have explicit accessible labels, numeric input modes, focus indicators and 44px controls; phone numeric fields use 16px text to avoid iOS focus zoom.

Programs support name/goal/level/duration/status filters, independent draft/published/archive states, duplication, reuse, explicit rest days, unconfigured days, day duplication, whole-week replacement with confirmation, session copy/move and a complete member schedule preview. Recurring legacy days are detached before editing a single occurrence, so another week is not changed. Reducing duration cannot silently discard configured workouts. Saves use stable request IDs and optimistic plan/template versions. Unsaved drafts prompt before leaving the planner or closing/reloading the page.

Published templates can be assigned to one or more explicitly authorized members with a chosen start date. The server rejects an overlapping assignment unless the trainer explicitly acknowledges preserving both programs. Existing assignments and completed workouts are never overwritten. Repeated assignment submissions reuse deterministic member-copy IDs. The mobile web assignment dialog includes member search, dates, summary, confirmation, error and success feedback.

Dashboard actions expose assigned members, active plans, members awaiting a program, pending reviews, recent completions and the template library. Member details retain real recorded-set analytics, now with prominent prescribed/completed/extra counts and expandable set history/filter/analytics sections. Existing version history, before/after target inspection, review and contextual comments remain accessible from the library. Member web users can see assigned programs, select the daily schedule and inspect prescribed targets; the native app remains the set-recording surface.

## Changed file list

| File | Change |
|---|---|
| `web/CoachingConsole.tsx` | Integrates planner/workout destinations; dashboard action cards and recent workouts; compact member detail, actual/extra counts, explicit labels. Removes superseded long-form program editor. Existing reports/messages remain. |
| `web/TrainerPlanning.tsx` | New persisted library/calendar, exercise editor, workout templates, preview, assignment and version-history dialogs. |
| `web/MemberProgramSchedule.tsx` | New authenticated member schedule consuming the same overview/library APIs as native clients. |
| `web/trainer-planning.css` | Responsive desktop panels, phone layouts, calendar/day selectors, dialogs, focus/touch and save-bar styles. |
| `web/lib/trainer-planning.ts` | Calendar date arithmetic, independent workout cloning, recurring-day detachment and week copying. |
| `web/TenantConsole.tsx` | Member schedule integration; trainer-only shell label and removal of redundant one-item workspace navigation; fixes React lazy initialization ordering. |
| `web/package.json`, `web/package-lock.json` | Playwright dev dependency and planner test/browser scripts. |
| `web/tests/trainer-planning.test.cjs` | Three calendar/clone/history isolation regression tests. |
| `web/tests/trainer-planning.browser.cjs` | Reproducible actual browser/API/SQL workflow, responsive checks and screenshot capture. Only test auth provider and intentional request-failure responses are substituted. |
| `backend/coaching.py` | Versioned JSON lifecycle/rest dates; draft/publish validation; assignment overlap acknowledgement and shifted rest days; scoped workout-template persistence; time-aware active-plan count. |
| `backend/migrations/20261109_trainer_planning.sql` | Additive workout-template table, indexes, constraint, RLS and denied direct client privileges. |
| `backend/tests/test_trainer_planning.py` | Four API lifecycle/template/isolation/overlap regression tests using real isolated transactions. Releases old SQLite fixture connections before setup. |
| `backend/tests/test_coaching_rls.py` | Applies the new migration twice; tests direct `anon`/`authenticated` template access denial. |
| `backend/scripts/serve_trainer_planning_fixture.py` | Disposable localhost-only test server with a separate fixed `/tmp` SQLite DB and deterministic test identity provider. Not imported by production entrypoints. |
| `mobile/nfc-task-tracker/lib/coaching-types.ts` | Optional additive `planning_status` and `rest_dates` fields. Native recording implementations unchanged. |
| `docs/trainer-planning-audit.md` | Initial architecture/capability/permission/test audit, written before implementation. |
| `docs/trainer-planning-changes.md` | This implementation/change/run guide. |
| `test-results/trainer-planning/` | Test report, screenshot index, actual PNGs, machine-readable browser results and execution logs. |

The repository already had extensive uncommitted work before this task; this list describes only this task's edits. No unrelated work was reverted.

## Routes and persistence
No additional top-level navigation route was introduced. Program/workout destinations remain tabs in `/console`.

- New `GET /api/console/coaching/workout-templates?tenant_id=…`: current trainer's templates at an authorized active club.
- New `POST /api/console/coaching/workout-templates`: stable `id`, `tenant_id`, optional `expected_version` and validated workout content. Creates or updates a real SQL row, verifies owner and club, validates exercise visibility and supported measurements.
- Existing plan create/edit JSON gains optional `planning_status` (`draft`, `published`, `archived`) and `rest_dates`. Legacy content defaults to published/no explicit rest days. Published plans require at least one valid workout. Assigned programs must remain published.
- Existing assign body gains optional `allow_overlap` (default false). Rest dates and session dates shift together. Both start/end intervals are checked within the same club. Explicit acknowledgement adds a separate program rather than replacing one.

Apply `backend/migrations/20261109_trainer_planning.sql` as database owner before deploying to PostgreSQL. The backend database role must retain its established privileged server access; Supabase browser roles receive no direct table privileges. No existing rows or columns are removed, and no data backfill is needed. SQLite test databases are created through existing metadata startup. Migration replay and client denial were tested in disposable PostgreSQL.

## Reused architecture
Supabase sessions, TenantConsole role/tenant selection, consoleTransport, active tenant/staff/member checks, CoachLink, exercise library and catalog, plan versions, immutable workout snapshots, member command processing, report generation/review, messages, starterContent, shared target types and actual-set analytics. No NFC/tag/card, equipment mapping, billing, provisioning, native queue or five-second recording implementation was changed.

## Run locally with existing project configuration
From repository root, create/use the backend virtual environment and install requirements if necessary:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd backend
.venv/bin/uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```bash
cd web
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:3000/console`. Use existing `backend/.env` Supabase, DATABASE_URL and CORS settings and `web/.env` VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY settings. Keep VITE_CONSOLE_API_URL empty for the existing Vite `/api` proxy to localhost:8000. Sign in with an actual active trainer account. Its club administrator must already have explicitly linked authorized members. Use `http://localhost:3000` if that is the existing project's configured authentication/CORS origin.

For the isolated automated browser fixture, do not start the regular backend on port 8000. Start:

```bash
backend/.venv/bin/python backend/scripts/serve_trainer_planning_fixture.py --reset
```

`--reset` deletes only `/tmp/nfcfit-trainer-planning-browser.db`. Keep Vite running, then run:

```bash
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:trainer-browser --prefix web
```

On a supported Playwright host, run `cd web && npx playwright install chromium`, then omit PLAYWRIGHT_CHROME_PATH. This host is macOS 13, unsupported by the newly installed Playwright browser downloader; installed Google Chrome was used successfully. Test fixture identities are deliberately not a production sign-in mechanism; the automated suite supplies their auth-provider responses. Reset the fixture before rerunning the creation journey.

## Remaining work and explicit limits
- Native Expo trainer screens retain their existing UI. This redesign covers desktop and responsive mobile **web**; the native app consumes assigned schedules through the preserved data model.
- Per-set varying prescriptions and repetition ranges are not introduced. The existing native/offline schema and reducers repeat a single target per exercise. Adding per-set targets only to the web/API would misrepresent prescriptions on existing member clients. Uniform sets/reps, optional weights, timed/distance targets, rest and notes are supported. A coordinated native/offline schema/renderer upgrade is needed for individual set targets.
- Native legacy assignment screens do not offer overlap acknowledgement; overlapping requests now fail safely with the server's clear explanation. Mobile web supports the complete confirmation flow.
- Live Supabase sign-in, real iPhone/Android software keyboards and physical NFC hardware were not exercised. The browser uses a deterministic test auth provider and real local business APIs/SQL. Physical NFC and true keyboard verification still need devices.
- Existing Tailwind CDN loading and its production warning remain. No design-system migration was introduced. Existing NFC-screen duplicate-import lint warnings remain unrelated to this change.
- Apply the additive database migration and deploy normal frontend/backend releases before production use. No production deployment, production member changes or real-user messages were performed.

## Follow-up refinements requested after screenshot review
- `web/TrainerPlanningUI.tsx` is new: responsive disclosure panels and measured mobile action-bar/VisualViewport handling. The mobile page reserves the actual bar height; focused numeric fields scroll above it. Keyboard viewport events update its position. Native device keyboard behavior still requires physical validation.
- `web/TrainerPlanning.tsx`: program settings, week copying, template library, program/workout summaries and session copy/move actions reveal themselves on demand on phones. Desktop panels remain open. The phone editor shows its own compact preview/assign/back actions and temporarily hides the library navigation; returning to the library restores all destinations. Assigned-plan adjustment opens the first future session rather than a frozen historical date.
- `web/CoachingConsole.tsx`: removes the duplicate workspace heading; all six library destinations are visible in a compact phone grid. Selecting a member hides other member cards/search filters, adds club-scoped active-program/completion/missed metrics, an explicit return action and direct access to that member's program.
- `web/lib/trainer-planning.ts`: new coverage calculation counts distinct training/rest dates and identifies wholly empty weeks and unconfigured dates without counting two workouts on the same date twice.
- Web publication now lists coverage for every week and links directly to the week to edit. Publishing a sparse schedule requires an unchecked-by-default acknowledgement; returning to edit never publishes. Complete schedules bypass the warning. This is a web UX review guard, not a new blanket server rule: intentional partial programs remain supported, and existing native/API clients retain their established validation. No new backend schema or migration is required for these refinements.
- `web/trainer-planning.css`: compact focused phone editor, measured fixed action bar with reserved space, collapsible secondary controls, non-overflowing program-card actions and selected-member metrics.
- `web/tests/trainer-planning.test.cjs` and `web/tests/trainer-planning.browser.cjs`: coverage, mobile disclosure/focus/navigation, action-bar clearance, reduced-height input visibility, direct future adjustment and publication review regressions. Screenshots 01–23 were refreshed; 24–27 document the new review/template/complete-schedule states.

See `test-results/trainer-planning/REFINEMENT_REPORT.md` for the follow-up execution results and remaining physical-device/live-account verification limits. Existing backend, native NFC and authentication implementations were not changed in this follow-up.
