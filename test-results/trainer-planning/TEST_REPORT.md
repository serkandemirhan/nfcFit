# NFCFit Trainer — second-pass precision test report

Executed 2026-11-09. The preceding five improvements were completed first; their evidence remains in [REFINEMENT_REPORT.md](REFINEMENT_REPORT.md) and [FIRST_PASS_TEST_REPORT.md](FIRST_PASS_TEST_REPORT.md). This pass refines the existing module. Routes, role checks, persisted program/target/assignment structures, NFC recording and the NFCFit visual identity are preserved.

## Executed results

- **20/20 precision browser checks passed**, including distinct members' 4/4 and 5/4 records, independent copied weeks, actionable validation, publication, overlap rescheduling/coexistence and mobile editing. [Machine results](precision-browser-results.json), [execution log](precision-browser-run.log).
- **37/37 regression browser checks passed** at 1440×900, 1280×800, 1024×768, 390×844, 375×667 and 412×915. [Log](precision-regression-browser.log), [results](browser-results.json).
- **10/10 planner unit tests passed**: calendar, independent copies, coverage/rest dates, assignment impact, frozen historical targets, extra/skipped sets and accent-normalized search. [Log](precision-unit-tests.log).
- Production Vite build and complete web TypeScript checks passed. [Build](precision-build-final.log), [types](precision-types-final.log).
- **Actual iOS system-keyboard test passed** on iPhone SE (3rd generation), iOS 17.2 simulator, Safari at 375 CSS px: native keyboard detected; changed set target to 5, saved with keyboard open and verified SQL-backed API value. [Screenshot S17](screenshots/precision/S17-ios-system-numeric-keyboard.png), [measurements](precision-ios-keyboard-results.json), [execution log](precision-ios-keyboard-run.log).
- No uncaught JavaScript errors or failed business API requests in the precision journey. One console resource 404 was captured; it did not affect a workflow. No page overflow at the tested sizes.

macOS 13.7.8; Node 22.20.0; Chrome 157.0.8103.38; Playwright 1.65.0. Actual React/Vite application at localhost:3000 and actual FastAPI/SQLAlchemy endpoints at localhost:8000. Disposable SQLite `/tmp/nfcfit-trainer-planning-browser.db`; no production or real member records. The in-app browser runtime had no available backend, so installed Chrome was controlled by standalone Playwright.

The precision test signs in through the normal Supabase client to **local test-provider HTTP endpoints**, enabled only in `serve_trainer_planning_fixture.py`. Provider URLs were supplied to Vite through test process environment variables; production configuration was not replaced. All coaching reads/writes, role enforcement, copies, publication, assignments and workout commands execute the real backend and SQL persistence. Live Supabase authentication and physical NFC were not tested in this pass. Previous backend (62 pass), PostgreSQL/RLS (5 pass), web auth (5 pass) and native (122 pass) results remain historical evidence, not reruns for this pass.

## Findings and implementation evidence

Paths below are relative to the repository root. Screenshot IDs link to the [index](SCREENSHOTS.md).

| Original problem | Modified file/component | Implemented correction | Functional test result | Screenshot | Remaining limitation |
|---|---|---|---|---|---|
| Selected week/day becomes unclear during workout editing | `web/TrainerPlanning.tsx`, `web/trainer-planning.css` | Persistent named context bar, selected date outline and aria-current; workout context retained in picker | PASS: add/edit retains exact week/date; mobile selection and edit tested | S01, S12 | Long date labels wrap on narrow screens |
| Rest and unconfigured dates look alike | Same calendar components | Separate text, styling and accessible labels; only explicit rests count as configured | PASS: four weeks with workouts and intentional rests publish; missing dates block publication | S02, S06 | All dates must be explicitly planned before publication |
| Selecting an exercise interrupts target entry | `TrainerPlanning.tsx` exercise picker | Add selects target and immediately focuses sets; returns to same workout/day | PASS: focus and context assertions, persisted sets/reps/weight | S01, S15 | Editing is one exercise at a time on mobile |
| Long mobile target forms | `TrainerPlanning.tsx`, `trainer-planning.css` | One focused target editor and selected-exercise switcher | PASS: multiple targets retain values and selected target changes without navigation | S16 | Switching target is required to edit another exercise |
| Search/filter selection is cumbersome | `TrainerPlanning.tsx`, `web/lib/trainer-planning.ts` | Search/filter disclosure, clear filters and Turkish accent normalization | PASS: `sinav` finds Şınav; combined filters clear; addition preserves workout | S15 | Search remains over the loaded exercise library |
| Reorder feedback and removal are unsafe | `TrainerPlanning.tsx` | Accessible reorder with announced position; named removal dialog, cancel and undo | PASS: reorder result; cancellation and undo preserve target ID and values | S03 | Existing arrow controls remain the reorder mechanism |
| Mobile number clearing/decimal input is brittle | `web/TrainerPlanningUI.tsx` TargetNumberInput | Transient text, numeric/decimal keyboard hints, comma parsing, field validation; required empty value blocks save | PASS: empty field stays empty, invalid save prevented, 42,5 persists as 42.5; native keyboard entry saves 5 sets | S16, S17 | Physical device not tested |
| Save controls can obstruct content | `TrainerPlanningUI.tsx`, `trainer-planning.css` | Measured action-bar padding, VisualViewport keyboard offset and focused field scrolling | PASS: 375px reduced viewport and actual iOS keyboard have visible input/actions and zero horizontal overflow | S16, S17 | Physical iOS/Android devices not tested |
| Draft/published/dirty states and actions are conflated | `TrainerPlanning.tsx` | Version/status block, explicit unpublished edits, separate preview/duplicate/edit/assign; unsaved source cannot be assigned | PASS: draft saves; publish persists; preview doesn't publish or mutate; dirty assignment disabled | S04, S06, S07 | Local edits require save/publication before assignment |
| Incomplete publication doesn't take trainer to the problem | `TrainerPlanning.tsx` validation dialog | Per-week missing date lists link to exact week/day; rest dates accepted | PASS: link selects week 3/day 3 and no publish mutation occurs | S05 | Trainer chooses workout or rest for each missing date |
| Overlap consequences and final assignment aren't concrete | `TrainerPlanning.tsx`, `trainer-planning.ts` assignmentImpact | Final review lists member, source/version, dates, named existing programs and overlap; explicit preserve-and-add checkbox or later start | PASS: later start and explicit coexistence independently tested; existing records deep-equal afterward | S08–S11 | Impact review is a snapshot; server revalidates assignment. Multi-member endpoint calls retain existing per-member API behavior |
| Planned and extra sets are hard to distinguish | `web/CoachingConsole.tsx`, `trainer-planning.ts` recordedSetProgress | Separate planned/completed/extra cards from frozen workout targets; skipped sets excluded | PASS: Emre 4/4 +0; Ada 5/4 +1; distinct workouts, records and image files | S13, S14 | Counts show recorded completed sets, not independently verified repetitions |
| Template/future changes could obscure historical prescriptions | Existing independent assignment API plus progress helper/tests | Display reads completed workout snapshot; source edits do not synchronize assigned copy | PASS: template revision leaves member copy deep-equal; future member adjustment leaves both completed workouts/actuals deep-equal | S13, S14 plus JSON assertions | Completed history is intentionally retained; newly planned sessions follow updated future targets |

## Acceptance criteria

1. Find/add/configure exercise without context loss — PASS desktop and 375px.
2. Four-week program with workouts and explicit rests — PASS, saved and published through real API.
3. Copy week and independently modify targets — PASS: original 4 sets, copied week 5; source later 6 does not alter assigned copy.
4. Save draft, publish and assign — PASS, separate persisted states and final review.
5. Resolve overlap without accidental loss — PASS for later start and explicitly keeping both programs; original assignments/history preserved.
6. Review planned/completed/extra sets — PASS with separate Emre and Ada data.
7. Essential 375px editing without horizontal overflow — PASS in Chrome and iOS Safari simulator with actual native numeric keyboard. Physical device execution is not claimed.

## Distinct realistic records

**Ada Yılmaz:** `Kuvvet ve Denge · Ada`, four weeks; `Üst Gövde A · 4×12`, Bench press 4×12 at 42.5 kg / 90s and Şınav 4×15 / 60s. Bench has five completed recorded sets against four frozen prescribed sets: **5/4, +1 extra**. Week 2 independently progresses the target. Later template publication and future member edits leave the completed record unchanged.

**Emre Demir:** separate `Temel Kuvvet · Emre`, one week, `Temel Kuvvet · Tam Hedef`, Bench press 4×10 at 45 kg / 90s and six explicit rest days. Exactly four completed sets: **4/4, 0 extra**. A separately acknowledged overlapping assignment preserves that completed record.

S13 and S14 are different screenshots, members, prescriptions and completed workout IDs. The harness asserts the images differ. Earlier generic images 16/17 are retained as regression artifacts; they are not used as distinct-data proof.

## Reproduction

Start the disposable fixture (reset deletes only this dedicated fixture DB):

```sh
backend/.venv/bin/python backend/scripts/serve_trainer_planning_fixture.py --reset
```

Start Vite with local test identity endpoints:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:8000/fixture-auth VITE_SUPABASE_ANON_KEY=fixture-public-test-key VITE_CONSOLE_API_URL= npm run dev --prefix web -- --host 127.0.0.1
```

Then `npm run test:trainer-planning --prefix web`, `npm run build --prefix web`, `cd web && npx tsc --noEmit`. Run browser suites on separate clean fixture starts; each creates its own scenario data:

```sh
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:trainer-browser --prefix web
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:trainer-precision --prefix web
```

Local fixture users/password are defined in the fixture script; they are not live account credentials.

## OS keyboard execution and limits

An iPhone SE (3rd generation) simulator with iOS 17.2 was booted specifically for this test. Appium 2.19.0 / XCUITest 7.35.1 and WebDriverAgent were installed under `/tmp/nfcfit-ios-test`; no Appium dependency was added to the application. The native accessibility tree confirmed `XCUIElementTypeKeyboard` at x=0, y=451, width=375, height=216. This is an OS keyboard, not a drawn overlay or reduced browser window.

Dedicated standalone workout `Mobil Teknik · Klavye` contains Bench press 4×12, 20kg, 60s. The fixture reset that dedicated target to 4 sets and 20kg before the check. Native accessibility selected the 4-set field, cleared it, and tapped the actual iOS keyboard’s `5` key. The test asserted that the active HTML input was the Set field and its value became 5; weight remained 20kg. During keyboard display: document width=scrollWidth=375; focused field top=158/bottom=206; save bar top=277.5/bottom=364.5; VisualViewport height=364.5/offsetTop=0.5. Native screenshot S17 visually confirms field and save action above the keyboard. Save was clicked before dismissing the keyboard, and a real API read verified 5 sets. Dedicated template data prevents this test changing Ada or Emre's historical records.

Initial local driver installation failed on its build hook and was retried through Appium's driver installer. Cold WDA build exceeded its initial timeout; two subsequent analysis-heavy builds were interrupted. Static analysis was disabled only in the temporary WDA project, after which compilation/startup succeeded. Safari's first Web Inspector connection had no reported apps; retry with the initial local URL and a longer discovery timeout succeeded. Diagnostic logs/images are retained rather than presenting these setup failures as application failures. An intermediate native-key retry exposed Appium’s web-to-native coordinate conversion selecting the weight field after clearing. The harness now locates the native Set field directly, asserts focus, resets test targets before each run and verifies the preserved 20kg value. The final completed keyboard run is [precision-ios-keyboard-run.log](precision-ios-keyboard-run.log).

The reusable check is `node web/tests/trainer-keyboard.ios.cjs`, requiring the dedicated fixture and an active Safari Appium session recorded in `precision-ios-session.json`. Start session with nativeWebTap=true, connectHardwareKeyboard=false, forceSimulatorSoftwareKeyboardPresence=true, safariInitialUrl set to the local console and webviewConnectTimeout=60000. Physical iOS/Android keyboards and live Supabase login remain untested; simulator success is not reported as physical-device success.

After verification, the owned Safari automation session, Appium server, fixture API, Vite process and test-booted iPhone SE simulator were closed. Ports 3000/8000/4723 are released for normal local work.
