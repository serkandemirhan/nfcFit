# Trainer planning UX refinements — 2026-11-09

## Actual outcome

Temporary local fixture/Vite processes were stopped after verification; ports 8000/3000 are free for normal development startup.
The follow-up implements the requested mobile simplification, navigation/header cleanup, selected-member focus, action-bar clearance and publication completeness review. The final browser journey passed **37 checks**, including all six required viewport sizes, with **0 uncaught JavaScript errors**. The planner unit suite passed **5 tests**; web TypeScript and the production Vite build passed. **27 actual application screenshots** are available in the [index](SCREENSHOTS.md).

These refinements change only the web planning UI, helper logic and browser/unit tests. The existing backend authorization, database model, native recording/NFC and live authentication integration were retained. Prior unchanged-code backend/PostgreSQL/native regressions remain documented in [TEST_REPORT.md](TEST_REPORT.md); they were not rerun merely for the UI refinements.

## Requested improvements and evidence

| Review concern | Implemented result | Verification |
|---|---|---|
| Mobile builder is long and compressed | Existing programs open with settings, templates, week copying and program/workout summaries collapsed on phones. New empty programs keep setup open. Session copy/move controls are contextual. Desktop panels stay open. | Browser asserts mobile disclosure defaults and opens settings/templates on demand. [Mobile builder](screenshots/10-program-builder-mobile.png), [templates](screenshots/26-workout-templates-mobile.png). |
| Repeated headings and horizontally hidden navigation | A single trainer shell title remains. All six library destinations use a two-row phone grid. Focused program/workout editors use their own compact preview/assign/back actions; returning restores library navigation. | Library navigation fits its own width at every phone size; editor navigation is intentionally hidden. [Program list](screenshots/09-program-list-mobile.png). |
| Save bar obscures fields/actions | Phone action bar has at most two actions; assignment moves to the program header. ResizeObserver reserves the measured bar height. VisualViewport resize/scroll updates keyboard offset, and active fields scroll above the bar. | Reserved padding is at least the bar height; a focused numeric field and both save actions remain visible in a 390 × 450 reduced viewport. [Focus](screenshots/21-mobile-focused-numeric-input.png). Actual OS keyboards remain unverified. |
| Member detail still shows unrelated members | Selecting a member hides other member cards and list filters. The detail starts with identity, club-scoped program/completion/missed metrics and an explicit return action. | Browser asserts Ada's heading is present and Emre's member-card heading is absent. [Member progress](screenshots/14-member-progress-mobile.png). |
| Future adjustment starts at a generic library | Adjustment opens that member's actual program and selects its first future scheduled date, preserving existing frozen-date rules. | Browser asserts the member-specific builder opens directly without a historical-date freeze warning. Existing completed-workout JSON remains unchanged after a future revision. |
| A four-week program can silently contain empty weeks | Before web publication, coverage lists every week, counts distinct training/rest/unconfigured dates and identifies completely empty weeks. Publishing with gaps requires explicit unchecked-by-default acknowledgement; a week-edit link returns without publishing. | Sparse plan remains a persisted draft when returning to week 3; confirmation is disabled before acknowledgement. [Desktop review](screenshots/24-publication-coverage-review.png), [phone review](screenshots/25-publication-review-mobile.png). |
| Completeness validation must respect intentional recovery | Explicit rest days are configured; an entirely resting week is not an empty week. Multiple sessions on one date count as one configured training day. Fully configured schedules publish without unnecessary warning. | Unit coverage tests and a browser-created one-week plan with one training day/six rest days. [Complete published week](screenshots/27-complete-week-published.png). |
| Program card action labels overlap | Card actions use two columns and allow wrapping. | Refreshed actual library screenshots; responsive journey passes. |

Publication review is deliberately a **web interaction guard**, not a new blanket prohibition in the server/API. Intentionally partial schedules remain possible after acknowledgement, while legacy/native API clients retain their current validation. Empty-workout publication still fails existing validation. There is no implicit conversion of empty dates into rest dates and no new migration in this follow-up.

## Commands executed for the refinements

| Command | Result | Log |
|---|---|---|
| `npm run build --prefix web` | PASS | [build](refinement-build.log) |
| `cd web && npx tsc --noEmit` | PASS, no diagnostics | [types](refinement-types.log) |
| `npm run test:trainer-planning --prefix web` | PASS, 5 tests | [unit tests](refinement-unit-tests.log) |
| `backend/.venv/bin/python backend/scripts/serve_trainer_planning_fixture.py --reset` | PASS, local isolated SQL fixture | [API startup](refinement-api-server-final.log) |
| `npm run dev --prefix web -- --host 127.0.0.1` | PASS | [Vite startup](refinement-web-server.log) |
| `PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:trainer-browser --prefix web` | PASS, 37 browser checks | [browser run](refinement-browser-run.log), [JSON](browser-results.json) |
| `adb devices -l` | Executed: no Android device attached | Hardware discovery only |
| `xcrun xctrace list devices` / `xcrun devicectl list devices` | Executed: a paired iPhone is available | Pairing/discovery only; not a Safari/keyboard/NFC test |

## Browser checks in the final run

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

## Defect found during verification
The new direct member-to-plan action initially opened the library instead of the editor under React StrictMode: the mode-reset effect cleared the initial open request during repeated effect setup. Resetting only when the mode actually changes fixed it. The complete browser journey was rerun successfully, including direct future-plan selection and preserved actuals. Evidence of the initial failure is retained in [diagnostic log](diagnostics/refinement-direct-open-initial-failure.log) and [diagnostic screenshot](diagnostics/refinement-direct-open-fixed.png).

Visual review also caught cramped card-action labels; the new action grid fixes this without affecting assignments. The mobile builder, publication dialog, member progress and focused numeric-input images were inspected after the final browser run.

## Remaining verification limits
- Browser identity-provider login responses are supplied by the isolated test fixture; actual Supabase password login and real-user training data were not used. Business APIs and SQL writes are real within the disposable database.
- Hardware discovery found a paired iPhone and no Android device. Available tools did not provide an authenticated Safari control/session handoff or a physical NFC test setup. Discovering a device is not evidence that a real phone keyboard or scan workflow passed. These remain unverified, including live trainer/member account use.
- Native Expo trainer screens and individual-set-varying prescriptions remain outside this responsive web refinement. Native NFC/recording code was not changed.
- Existing Tailwind CDN production warning and native duplicate-import warnings documented in the initial report remain unrelated to these changes.

No executed final refinement test is failing. Physical device/live-account checks remain required before calling the complete system production-verified. Run instructions and the full changed-file list remain in [the change guide](../../docs/trainer-planning-changes.md).
