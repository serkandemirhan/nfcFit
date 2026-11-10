# NFCFit Trainer UI/UX quality recovery

Executed 2026-11-09, Europe/Istanbul. This is a refinement of the existing Trainer; no backend rewrite, schema change, role change or route replacement.

## Scope and evidence

All **44** screenshots from the latest package were inspected individually and preserved in `baseline/`. [UI_AUDIT.md](UI_AUDIT.md) maps every image to its concrete issue and correction. Thirty-nine fresh before captures at the five requested sizes are preserved in `before/`. The [screenshot index](SCREENSHOT_INDEX.md) links corresponding actual before/after images, the save-state cases, publication/assignment reviews, distinct member records and keyboard evidence. [Modified components](MODIFIED_COMPONENTS.md) records the implementation boundaries.

Work began with the desktop Program Builder and Workout Builder. The program calendar now appears within the initial desktop viewport; settings and week tools are closed until needed. The workout uses a 25/55/20 layout with one selected target editor, optional guidance, independently scrollable content and an action bar outside the edit area. Optional-summary collapse returns width to the center editor. Mobile separates program overview, week, selected day, workout targets and full-screen exercise selection. Changes reuse the existing plan state and endpoints.

The new styles are scoped to `.trainer-area`/`.trainer-shell`. NFCFit's dark navy surfaces, lime primary actions and emerald brand remain. Mobile touch targets are measured at a minimum of 44px, including all seven date cells and the modal close control. Program and workout actions reserve space instead of sitting over an unbounded form. Review dialogs have a scrollable body and separate action footer.

## Actual environment

React/Vite at `http://127.0.0.1:3000/console`, actual FastAPI/SQLAlchemy backend at localhost:8000, dedicated disposable SQLite `/tmp/nfcfit-trainer-planning-browser.db`. macOS 13.7.8, Node 22.20.0, installed Chrome 157 and Playwright. The in-app browser runtime exposed no available backend; standalone Chrome was used. No generated mockup is presented as a running UI.

The normal Supabase client signs in through the local test provider mounted only by `backend/scripts/serve_trainer_planning_fixture.py`. Test URLs are supplied through process environment variables, not production config edits. All coaching operations and reads execute real authorized backend endpoints and SQL persistence. Explicit 503 responses are injected only for failure/retry cases. Live Supabase credentials/authentication and physical NFC/device behavior are outside this pass; simulator evidence is labeled separately.

## Save-state and action semantics

| State/action | Persistent feedback | Persistence verification |
|---|---|---|
| Unsaved draft | Unsaved changes; save draft or publish when ready | New program is absent from API until save |
| Saving | Operation-specific saving indicator; save actions locked | Real API response is delayed; no completed state before response |
| Saved draft | Named program is saved as draft, is not published, publish next | API status/content/version plus reload/reopen |
| Save failed | Persistent failed indicator, retained values, Retry bound to the failed operation | Injected 503; server version unchanged; retry persists and reload confirms |
| Published | Current version published; assignment is primary; no redundant publish action | Published status verified through API and reload |
| Published with unpublished edits | Explicit unpublished changes; publish update; assignment disabled | API retains prior content until successful new publication |
| Apply workout to day | Local program draft changed; save/publish program next | Source program absent/unchanged in API until program save |
| Save reusable template | Template saved to library; apply to day separately | Actual library API and reopening template after reload |
| Publish updated version | New version only after success | Injected failure preserves old version; retry and reload confirm new goal/version |
| Save a published source as draft | Dedicated settings action explains unpublish; explicit confirmation; member copies preserved | Cancel causes no version change; confirmed draft state and republish tested |

During persistence the edit areas are inert and navigation out of the editor is disabled, preventing later typing from being overwritten by an in-flight response. Saving-state browser assertions verify this lock.

Server normalization of template fields is reflected back into the editor after a successful save. This fixes the case where an already-persisted template incorrectly remained marked unsaved. Read-only refresh no longer claims a save happened. Repeated session initialization for the same token no longer reopens a loading state after identity has already loaded; authenticated reload was tested repeatedly.

## Required functional workflow

All eighteen requested steps were executed in the actual UI. The machine log groups related steps; it does not count a toast as persistence proof.

| Required step | Result | Evidence |
|---|---|---|
| 1 Create program | PASS | Unsaved program absent from API; workflow 01 |
| 2 Add workout | PASS | Named workout in selected day context |
| 3 Add exercise | PASS | Bench press and Şınav selected from real library, targets receive focus |
| 4 Modify sets/reps | PASS | Weighted 4×10 at 42.5kg/90s and bodyweight 3×12 |
| 5 Apply workout to day | PASS | Program draft changes locally; scope is explicitly stated; workflow 04 |
| 6 Reload persisted day/targets | PASS | API reads and reload/reopen verify day, 4 sets, 10 reps and 42.5kg |
| 7 Save reusable template | PASS | Failed save retains targets; Retry saves real template |
| 8 Verify library template | PASS | Library entry opens persisted targets |
| 9 Modify program | PASS | Complete four weeks, 24 explicit rests; independent week-2 target progression |
| 10 Unsaved feedback | PASS | Persistent unsaved state before write |
| 11 Publish | PASS | Complete coverage accepted by actual API |
| 12 Published state | PASS | Reload shows published version and primary assignment |
| 13 Modify published program | PASS | Goal changes locally; source API unchanged |
| 14 Unpublished feedback | PASS | Explicit state; assignment disabled; workflow 08 |
| 15 Failure/retry | PASS | Program and template 503 cases; values/version preserved, real retry, API and reload checks |
| 16 Assign | PASS | Named member/program/start/end/affected assignments; overlap resolved by later start |
| 17 Member schedule | PASS | Normal member UI shows assigned 4×10 on the actual assigned start date |
| 18 Trainer progress | PASS | Distinct Ada 5/4 +1 and Emre 4/4; original actuals and frozen targets deep-equal after source revision/assignment |

Additional checks cover ordinary member denial (403), selected-week preview, optional filters, summary collapse, reordering/removal cancel/undo, exact incomplete-day links, mobile focused views, decimal keyboard text, independent copied program, explicit unpublish confirmation and filtered empty progress. No fabricated performance data is inserted into the UI. Existing recorded sets remain the source of progress; extra sets are separate from the prescribed target.

## Test execution

| Command | Result / log |
|---|---|
| `npm run test:trainer-quality --prefix web` with installed Chrome path | [Functional results](functional-results.json), [run](functional-run.log): all requested workflows pass |
| `node web/tests/trainer-quality.refinements.cjs` with installed Chrome path | [Refinement results](refinement-results.json), [run](refinement-run.log) |
| `node web/tests/trainer-quality.publish.cjs` with installed Chrome path | [Publication results](publication-results.json), [run](publication-run.log) |
| `node web/tests/trainer-quality.capture.cjs before` | [Before capture results](before/capture-results.json), [log](before-capture.log) |
| `node web/tests/trainer-quality.capture.cjs after` | [After capture results](after/capture-results.json), [log](after-capture.log) |
| `npm run test:trainer-planning --prefix web` | 10/10 PASS; [log](unit-planning.log) |
| `npm run test:trainer-save-state --prefix web` | 6/6 PASS; [log](unit-save-state.log) |
| `backend/.venv/bin/python -m unittest discover -s backend/tests -p test_trainer_planning.py -v` | 4/4 PASS; [log](backend-planning.log) |
| `node --test web/tests/legacy-api-auth.test.cjs` | 5/5 PASS; [log](web-auth.log) |
| `npm run build --prefix web` | PASS; [log](build.log) |
| `cd web && npx tsc --noEmit` | PASS; no diagnostics; [log](types.log) |

The future-program smoke check also passes: [results](scheduled-results.json), [log](scheduled-run.log). Future programs start collapsed, retain a working future-editor action, and leave actual workout records unchanged.

The six save-state unit cases cover saved, unsaved, saving, failed, published and unpublished phases. The unchanged planner helpers also verify independent copies, calendar/rest coverage, overlap intervals, historical targets and extra-set counts.

## Visual verification

Desktop: **1440×900**, **1280×800**. Mobile: **390×844**, **375×667**, **412×915**. Exact viewport images are primary evidence; full-page images are additional evidence where a view is longer. Desktop content panels scroll independently, so a document full-page image does not expand their scroll contents.

The mobile workout check also verifies exactly one visible target editor; the target switcher preserves the other exercises.

The final capture suite contains **42 passing visual/geometry checks**, paired with **39 before captures**. The functional suite passes **16 grouped checks covering all 18 required steps**; refinement checks pass **8/8**, publication/empty-state checks **3/3**, planner units **10/10**, save-state units **6/6**, backend planner tests **4/4**, and web auth regressions **5/5**. The final functional run has no page errors and only the two deliberately injected 503 responses; no unexpected failed API response.

The capture suite measures page overflow, calendar position, edit-area/action separation, mobile initial set-input visibility, action-bar bounds and visible mobile button sizes. It checks center-editor dominance on desktop. Modal review is tested with multiple actual affected programs, not an empty review. Separate selected-day mobile captures demonstrate the focused day view. The reduced-height browser image is labeled as a viewport test, not an OS keyboard.

## Corrections found during execution

- A template could save successfully while retaining an unsaved indicator because server-normalized fields differed from the local object. The editor now adopts the acknowledged server content; retry/reopen verifies values.
- A collapsed desktop summary initially allocated too much width to the library. The fraction/percentage rule was corrected and the test verifies the center grows on collapse.
- Mobile Overview initially styled a closed native details section without actually opening it. The disclosure is now controlled by the chosen program view; real mobile edits and reload pass.
- The modal close control was below 44px wide. Minimum width is now 44px and all requested mobile sizes are measured.
- Whole-modal scrolling could put final confirmation below a long affected-program list. Dialog body and footer are separate; the footer remains visible without overlapping scroll content.
- Validation text could remain after a corrected workout was applied. Successful local application clears that old error while still marking the program as unsaved.

Diagnostic logs are retained under `diagnostics/`; corrected intermediate failures are not presented as final passes. The old 37-check and 20-check browser suites are historical evidence from the preceding pass, not claimed as rerun unchanged after these new focused views. This package uses new workflow/visual regressions matching the revised UI, plus unchanged planner/auth/backend checks.

## Remaining limits

Live Supabase login, physical iOS/Android keyboards, physical NFC and the native mobile app were not tested in this web-only recovery pass. API authentication uses isolated test identities. Historical targets and records are compared directly, not inferred from screenshots. The existing per-member assignment endpoint behavior is preserved; this pass does not add transactional multi-member assignment.

## Actual iOS keyboard — PASS

[Native execution log](keyboard/native-keyboard-run.log), [measurements/API result](keyboard/native-keyboard-results.json), [actual screenshot](keyboard/screenshots/precision/S17-ios-system-numeric-keyboard.png).

iPhone SE (3rd generation), iOS 17.2 simulator, 375 CSS px. Native accessibility selects the Set field with value 4, clears it, and taps the actual iOS `5` key. Input bounds: x=42, y=179, width=140, height=46. Save button bounds: x=29, y=329, width=317, height=45. Native keyboard: x=0, y=451, width=375, height=216. Field and Save are fully above the keyboard, within the 375px width. Save is tapped while the keyboard is open; persistent UI status changes to “Şablon kaydedildi”, and the real API returns **5 sets, 20kg**. This includes the final pending-save interaction lock.

The dedicated `Mobil Teknik · Klavye` fixture isolates the keyboard exercise from member historical records. Local Appium/Xcode startup and Web Inspector discovery needed retries. The final verification drives Safari through native accessibility and does not depend on Web Inspector's stale page discovery. It still uses the actual application and normal local test-provider sign-in. Native screenshots are unmodified; earlier transient setup failures remain diagnostic evidence. This is genuine OS keyboard execution on a simulator, not a physical-device claim.

## Reproduction and review data

The two local services remain available for review at `http://127.0.0.1:3000/console`. Start the dedicated fixture **without `--reset`** to reuse the existing Ada/Emre programs and distinct recorded workouts. A reset removes that disposable test DB and requires restoring the precision fixture data before these recovery scenarios, which deliberately build on that baseline.

```sh
backend/.venv/bin/python backend/scripts/serve_trainer_planning_fixture.py
VITE_SUPABASE_URL=http://127.0.0.1:8000/fixture-auth VITE_SUPABASE_ANON_KEY=fixture-public-test-key VITE_CONSOLE_API_URL= npm run dev --prefix web -- --host 127.0.0.1
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:trainer-quality --prefix web
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node web/tests/trainer-quality.refinements.cjs
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node web/tests/trainer-quality.publish.cjs
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node web/tests/trainer-quality.capture.cjs after
```

For native keyboard execution use `web/tests/trainer-keyboard-native.ios.cjs` with an active local Appium native Safari session in `keyboard/native-session.json`. The session uses XCUITest, the test-booted SE simulator, hardware keyboard off, software keyboard enabled and the actual local console URL. Appium/WDA live under `/tmp/nfcfit-ios-test`, outside application dependencies. The owned automation sessions, Appium server and simulator were closed after verification; Vite/API were left running for the user's preview.

Only disposable source programs named `Kalite İncelemesi…` and `Mobil Düzenleme…` were archived after workflow tests to keep the demo's active library focused. [Cleanup log](fixture-cleanup.log) verifies the original members' actual workout records remained deep-equal. Original Kuvvet/Temel programs remain active. Future assigned programs remain published and available through a collapsed, dated section in member detail; reusable templates created by the tests remain in the library. Workflow screenshots record their states at the time of each tested operation, before this fixture cleanup.
