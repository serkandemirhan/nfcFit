# Trainer planning test report — 2026-11-09

## Outcome and environment

The screenshot-review refinements are implemented and verified in [REFINEMENT_REPORT.md](REFINEMENT_REPORT.md). It records the latest 37-check browser run, five unit tests, updated screenshots and the paired-device verification limit. Earlier unchanged backend/PostgreSQL/native executions below remain applicable; those suites were not rerun for the web-only refinements.
The final browser suite passed **37 checks**, produced **27 actual application screenshots**, and found no page-level horizontal overflow at any requested viewport. The temporary fixture API and Vite processes were stopped after verification to free ports 8000/3000 for normal local use. The application started successfully at `http://127.0.0.1:3000/console` with the FastAPI API on `127.0.0.1:8000`; `/health` returned `{"status":"ok"}`.

Host: macOS 13.7.8, Node 22.20.0, npm 10.9.3, Python 3.9.1, Google Chrome 157.0.8103.38 controlled by Playwright 1.65.0. React/Vite frontend and FastAPI/SQLAlchemy backend; screenshots use Europe/Istanbul. Business data resides in a disposable SQLite file `/tmp/nfcfit-trainer-planning-browser.db`. RLS/migration tests use a separate disposable socket-only PostgreSQL cluster.

No real member data or production database was used. `serve_trainer_planning_fixture.py` substitutes only the identity provider in its own localhost process. Browser password-login responses are deterministic test-provider responses; all coaching reads, writes, assignments, plan revisions and workout commands use the actual backend and SQL persistence. One 503 response is deliberately injected to test save failure/retry. **Live Supabase identity-provider credentials/sign-in were not tested.** Authorization, active relationships and club checks were exercised by real backend endpoints and the existing isolation suites.

The in-app browser runtime reported no available browser backends. Standalone Playwright with installed Chrome was used. `playwright install chromium` failed because its current browser downloader does not support macOS 13; installed Chrome worked. No screenshot is an image-generation mockup.

## Commands and execution results
Commands run from repository root unless otherwise specified. Raw logs are retained alongside this report.

| Command | Actual result | Evidence |
|---|---|---|
| `npm run build --prefix web` | PASS; production Vite build | [build log](refinement-build.log) |
| `cd web && npx tsc --noEmit` | PASS; zero diagnostics | [web types](refinement-types.log) |
| `backend/.venv/bin/python -m unittest discover -s backend/tests -v` | PASS: 62 passed; 5 PostgreSQL-only tests skipped here and executed separately below | [backend log](backend-tests.log) |
| `backend/.venv/bin/python backend/scripts/test_rls.py` | PASS: all 5 PostgreSQL tests; migration applied twice | [RLS log](postgres-rls-tests.log) |
| `npm run test:trainer-planning --prefix web` | PASS: 5 calendar/clone/history/coverage tests | [planner unit log](refinement-unit-tests.log) |
| `node --test web/tests/legacy-api-auth.test.cjs` | PASS: 5 web authorization regressions | [web auth log](web-auth-tests.log) |
| `cd mobile/nfc-task-tracker && node --test tests/*.test.cjs` | PASS: all 122 tests, including coaching/offline/NFC/scheduling/recording | [mobile log](mobile-tests.log) |
| `cd mobile/nfc-task-tracker && npx tsc --noEmit` | PASS; zero diagnostics | [mobile types](mobile-types.log) |
| `cd mobile/nfc-task-tracker && npm run lint` | PASS with 2 existing import/no-duplicates warnings, 0 errors | [lint log](mobile-lint.log) |
| `backend/.venv/bin/python backend/scripts/serve_trainer_planning_fixture.py --reset` | PASS; isolated local API startup | [API log](api-server-final.log) |
| `npm run dev --prefix web -- --host 127.0.0.1` | PASS; Vite local startup | [Vite log](web-server.log) |
| `PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:trainer-browser --prefix web` | PASS: 37 browser checks | [browser log](refinement-browser-run.log), [JSON results](browser-results.json) |
| `git diff --check -- web/package.json web/package-lock.json` | PASS | Executed without diagnostics |

The web project has no existing ESLint script/config; web validation used its complete TypeScript check, Vite production build and browser execution. Native lint was executed; unrelated warnings were retained.

## Required functional cases

| # | Case | Result and scope |
|---|---|---|
| 1 | Trainer login and authorization | PASS using test auth-provider UI login; real API admits active trainer and denies member with 403. Live Supabase login unverified. |
| 2 | Open trainer dashboard | PASS; member/action KPIs and links rendered. |
| 3 | Create program | PASS; actual form creates persisted plan. |
| 4 | Configure duration | PASS; four weeks selected and persisted. |
| 5 | Multiple training days | PASS; workouts on multiple independently configured dates. |
| 6 | Exercises from library | PASS; real Bench press and Şınav library entries. |
| 7 | Sets/repetitions | PASS; 4 × 12 with 40 kg and bodyweight 4 × 15 with optional blank weight, 60 seconds rest. |
| 8 | Reorder exercises | PASS; semantic arrow buttons reorder target list. |
| 9 | Reusable workout template | PASS; saved through actual API and reused from the calendar sidebar; failed request retains edits and retry succeeds. |
| 10 | Duplicate day | PASS; all selected-day sessions cloned to a separate date. |
| 11 | Copy complete week | PASS; destination replacement confirmation; independent day/target IDs; unit tests cover leap dates. |
| 12 | Save draft | PASS; persisted through real SQL. Empty draft is accepted by API tests. |
| 13 | Publish program | PASS; empty schedule rejected; valid schedule published. |
| 14 | Assign program | PASS; member selection, date and explicit confirmation; overlapping assignment rejected unless acknowledged (API tests verify acknowledgement and preservation). |
| 15 | Member receives assignment | PASS; member overview and Programım/Today UI show the correct dates and targets. |
| 16 | Review completed sets | PASS; real member commands create/finish workout; trainer shows prescribed and recorded counts. |
| 17 | Extra sets | PASS; 4 planned, 5 completed, 1 extra, target achieved. |
| 18 | Modify future plan, retain history | PASS; future target changed; full completed workout JSON remained byte-for-byte identical. |
| 19 | Validation/request errors | PASS; empty publish error, unsupported measurements, stale versions, forbidden template access, rest/day conflicts, overlap conflict, failed-save/retry. |
| 20 | Narrow layouts and keyboard behavior | PASS for all six responsive viewport checks and a 390 × 450 reduced-viewport focused numeric input with visible Save actions. PARTIAL for real OS keyboards: physical iOS/Android keyboards were not tested. |

## Browser checks executed

| Check | Status |
|---|---|
| Trainer login UI with test auth provider and real trainer authorization | PASS |
| Member denied trainer dashboard | PASS |
| Create program and configure duration | PASS |
| Unsaved-change navigation guard retains draft when dismissed | PASS |
| Publish empty program validation | PASS |
| Configure weighted and bodyweight targets without required weight | PASS |
| Accessible exercise reorder | PASS |
| Failed request preserves workout edits and allows retry | PASS |
| Save reusable workout template | PASS |
| Duplicate entire training day | PASS |
| Copy complete week | PASS |
| Edit second week independently | PASS |
| Rest day distinguished from unconfigured day | PASS |
| Reuse saved workout template and move session between days | PASS |
| Persist draft | PASS |
| Incomplete publication lists empty weeks, requires acknowledgement and returns to selected week without publishing | PASS |
| Publish valid program | PASS |
| Member schedule preview | PASS |
| Program library search | PASS |
| Assign published program to authorized member | PASS |
| Overlap blocked without explicit acknowledgement | PASS |
| Member receives correct dated assignment through real API | PASS |
| Record completed workout and an extra set through existing member commands | PASS |
| Trainer progress shows recorded planned, completed and extra sets | PASS |
| Selected member view hides other member cards and opens that member's future plan directly | PASS |
| Future plan modification preserves completed workout snapshot and actuals | PASS |
| Member program and Today render persisted schedule in UI | PASS |
| Responsive workflows 1440×900 | PASS |
| Responsive workflows 1280×800 | PASS |
| Responsive workflows 1024×768 | PASS |
| Mobile publication review and on-demand settings/templates remain accessible | PASS |
| Reduced-height viewport keeps focused numeric input and both save actions visible | PASS |
| Responsive workflows 390×844 | PASS |
| Responsive workflows 375×667 | PASS |
| Responsive workflows 412×915 | PASS |
| Fully configured training/rest schedule publishes without an unnecessary gap warning | PASS |
| No uncaught browser errors | PASS |

## Routes and responsive coverage
UI route: `/console` with trainer Overview, My Members, Programs, Workouts, Progress, program/workout editor, preview, assignment and member Programım schedule states. No parallel top-level destinations were added.

Actual endpoints exercised include `/api/console/auth/me`, `/coaching/dashboard`, `/coaching/overview`, `/coaching/library`, `/coaching/plans`, `/coaching/plans/{id}`, `/coaching/plans/{id}/assign`, `/coaching/workout-templates`, `/coaching/workouts`, `/coaching/workouts/{id}/commands`. Version/review APIs remain integrated with the existing backend and regression coverage.

| Viewport | Program calendar | Workout editor | Assignment dialog | Member progress | Page overflow |
|---|---|---|---|---|---|
| 1440 × 900 | PASS | PASS | PASS | PASS | None |
| 1280 × 800 | PASS | PASS | PASS | PASS | None |
| 1024 × 768 | PASS | PASS | PASS | PASS | None |
| 390 × 844 | PASS | PASS | PASS | PASS | None |
| 375 × 667 | PASS | PASS | PASS | PASS | None |
| 412 × 915 | PASS | PASS | PASS | PASS | None |

The phone calendar may scroll locally to preserve touch widths. Library navigation now displays all six destinations without horizontal scrolling; focused editors use their own return actions. The document itself does not overflow. Full-page screenshots include sticky action bars at their actual current viewport position. Image 21 is a viewport capture showing a focused input and save actions with reduced visible height, without a fabricated keyboard.

## Screenshots and visual review
All 17 requested screenshots and ten additional states are present under `screenshots/`. See the complete [screenshot index](SCREENSHOTS.md). Visual inspection covered desktop calendar/workout panels and mobile calendar, editor, assignment, progress and focused-input/confirmation captures. Saved examples show explicitly isolated test member identities. Starter examples are labelled as examples rather than real member data.

Key evidence: [desktop calendar](screenshots/03-program-builder-desktop.png), [desktop workout](screenshots/04-workout-builder-desktop.png), [mobile calendar](screenshots/10-program-builder-mobile.png), [member assigned schedule](screenshots/15-member-assigned-program.png), [actual extra sets](screenshots/17-trainer-extra-sets.png), [reduced-height focus](screenshots/21-mobile-focused-numeric-input.png), [save error retained for retry](screenshots/23-retryable-save-error.png).

## Console, network and accessibility findings
- Final browser run: **0 uncaught JavaScript errors**.
- Expected browser HTTP failures: one deliberately injected **503** on workout-template saving, and one **409** from overlapping assignment. Both rendered clear errors without losing edits or overwriting programs. The suite separately verified a **403** for member access to trainer dashboard. No unexpected API/network failures remained.
- Existing Tailwind CDN production warning and Vite/React development notices remain; application styling still follows the existing loading method. Browser download installation failed as described above; runtime browser testing succeeded with installed Chrome.
- New planner inputs have explicit label/id associations. A first browser run identified select labels incorrectly including option text; explicit labels fixed that accessibility defect. Dialogs use native modal focus containment and Escape handling; reorder actions are semantic buttons with labels rather than drag-only gestures. Focus outlines, numeric input modes, optional weights and 44px touch controls are present. Mobile day selectors may scroll locally to preserve touch widths.
- Native `nfc.tsx` has two pre-existing duplicate-import lint warnings; no lint errors. No screen-reader/device assistive-technology audit was performed.

## Defects found and corrected
1. Browser startup exposed `Cannot access React before initialization` in the existing lazy console declaration after integration. Moving the lazy declaration after the React import fixed startup; subsequent browser runs had no uncaught errors.
2. Select fields had ambiguous wrapping-label text. Explicit label/id associations fixed exact accessible names; the full journey was rerun successfully.
3. Two initial browser assertions needed correction: the existing password label includes helper text; a bodyweight library entry permits optional kg metadata rather than omitting that field. Tests now use the actual password input and assert blank/non-required weight rather than requiring absence of an optional field.
4. A first full Python run failed four new fixture tests because the baseline suite had deleted its SQLite file while pooled connections still referred to that inode. The new fixture disposes pooled connections before startup and cleanup. Full rerun: 62 passed/5 separately run PostgreSQL skips. The initial failure log remains at [backend-tests-initial-failure.log](backend-tests-initial-failure.log); the earlier accessible-label diagnostic capture remains at [diagnostics/initial-label-selector-failure.png](diagnostics/initial-label-selector-failure.png).

## Known limits and remaining verification
- Physical NFC, real iOS/Android software keyboards and live Supabase sign-in were not tested. Existing NFC/coaching/offline/recording regressions passed; no NFC implementation was edited.
- This is the responsive **web** trainer redesign. Existing native Expo trainer UI was retained, with additive optional shared types. Native members consume the existing assigned-plan model.
- Varying prescriptions by individual set and repetition ranges remain unsupported by the established native/offline target schema. Uniform exercise targets, optional weight, timed/distance targets, rest and instructions are supported. A coordinated native/offline schema/renderer update is needed for per-set targets; a web-only extension would not be safe.
- Existing native overlap assignment screens have no new acknowledgement toggle; the server safely rejects their overlapping request. The responsive web flow has explicit acknowledgement.
- Apply the new PostgreSQL migration and deploy frontend/backend normally before production use. No production deployment was performed.

There are no unresolved failures in the executed final automated suites. The device/live-provider and per-set limitations above remain explicit acceptance limits. Exact run/migration instructions and the complete changed file list are in [trainer-planning-changes.md](../../docs/trainer-planning-changes.md).
