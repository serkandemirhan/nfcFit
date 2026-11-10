# NFCFit 1.0.13 — member workout experience

Android versionCode 14, 2026-11-08. Uses existing authenticated APIs and account-scoped durable SQLite queues; no schema/server deployment required.

## Delivered
- Compact active-workout exercise rows with target-slot progress and completed/skipped/extra movement states. Exercise details separate recorded sets from exercise information. Editing retains the original set identity and occurrence time.
- Large numeric controls, manual input and defaults from the same movement’s last actual set, otherwise its target. Missing/occupied/skipped slots are distinguished. The user reviews actual values before saving; recognizing a card never saves a set.
- NFC scanning and recognition view: abortable reads, downloaded/active membership/card/equipment checks, explicit selection when several movements match, then set review. No name-based or arbitrary exercise mapping. Rejected sessions are excluded from external NFC context.
- Durable pause/resume with pause-excluding time, compact completion/partial summary, recorded set count and earlier matching-movement weight comparisons. The live clock updates its own text instead of rerendering the whole exercise list. Completion feedback is triggered by the successful action, not by reopening history, and respects reduced motion.
- Planless movements can be added with a selected set count to the current workout only. They contribute actual activity/report data and never change saved plan targets or planned progress.
- Local weekly schedule, rest-day guidance and weekly completion state. Missed sessions offer explicit skip or make-up today/weekend. A make-up is an independent personal one-session plan; the original becomes skipped and remains in history. No past/current targets are silently rewritten. Creating the make-up plan requires internet through the existing plan API. Its complete request/UUID is persisted before sending, so retry after an uncertain response reuses the same request. Local session/skip operations use existing durable queues.
- Weekly/30/90-day charts use actual finish timestamps in account timezone, exclude rejected sessions, include partial sessions explicitly, and show actual sets/active days/recorded duration and comparison with the previous equal period. No calorie estimates or fabricated body measurements.
- Pending/synced/rejected states remain visible. Coach/member guards and private report scoping are preserved. Existing detailed reports and facility/free-exercise screens remain available.

## Validation
73 mobile tests pass. Mobile TypeScript and targeted ESLint pass. Tests cover missing set slots/defaults, editing skips, account-scoped schedule, real-date/timezone trends, rejected records, prior matching movement comparisons and extra movements preserving plan targets, plus the existing durable queue/idempotency/account isolation suite.  Native UI review uses isolated marked fixtures; these never contact production or ship in the production APK. Hardware NFC and real-account synchronization remain physical-device acceptance work.

## Device acceptance
Install over the previous internal build. With a member: Programım → open/start a session → select a movement → Setler → record with plus/minus or manual input → verify immediate progress. Scan the matching card from within the session, review the exercise and confirm actual values. Test a different/unassigned/inactive card, cancellation and double-tap during save. Pause, close/reopen and resume; pause time must stay excluded. Add an extra movement and verify the main plan’s target total is unchanged. Complete or partially finish and check the summary and progress chart. Disconnect/reconnect to check queued activity and actual occurrence times. On a missed day, explicitly skip or create a separate make-up; original history remains. Check large fonts and Samsung three-button navigation. A reader/card is not available in the emulator.

## Native review evidence
An isolated API 36.1 emulator fixture opened the actual active-workout, scanning, recognition, set entry, pause, summary, weekly plan, rest/missed-day and progress components. Recognition → review → record was exercised using a simulated NFC reader and the real workout reducer: one set changed target progress from 6/9 to 7/9 (78%) and showed the pending state. This is not a hardware NFC or authenticated server test.

Initial emulator startup/installation stalled and System UI reported an ANR; earlier task thumbnails/splash captures are not passing evidence. Disabling network on the test emulator reduced background load and the fixture became usable. Its original Wi-Fi/mobile-data settings are restored at cleanup. Physical-device performance is not signed off.

Valid fixture screenshots: workout-1.0.13-active-verified, scan, recognition, set-entry, set-saved, pause, result, week, rest, review-toolbar (missed card) and progress-verified in mobile/nfc-task-tracker/ui-review-screenshots. The fixture has a visible sample-data banner and scenario toolbar; these do not ship. Its standalone drawer render does not reproduce the production drawer’s outer bottom safe-area wrapper, so it is not a new bottom-inset signoff. Earlier 1.0.12 inset evidence and physical Samsung acceptance remain relevant.

Final adjustments after this fixture export: fixed bottom save action, read-only completed set-history disclosure, preserved note draft initialization, concise missed-day introduction, planned-progress exclusion of extra movements, rejected-workout NFC filtering and derived sync-status cleanup. The release source-map check validates these exact production sources; the fixture bundle is not the release bundle. Make-up creation/retry with real authenticated APIs and the complete extra-movement flow remain device acceptance steps.

Translation resources contain 544 matching coaching keys per language. Newly added static labels are translated; dynamic authored/catalog content, native alert prose and all legacy screen text are not claimed as complete English parity. Existing illustrations remain schematic, not licensed individual technique media.

## 1.0.13 release evidence — 2026-11-08
- Android 1.0.13 / versionCode 14, `com.serkandemirhan.nfcfit`.
- APK: `mobile/nfc-task-tracker/android/app/build/outputs/apk/release/NFCFit-1.0.13.apk`, 100,772,962 bytes.
- SHA256: `ef31d46109ae6c36fd901f97c78c98c098bc6a41bb6b0a228301f2bd212afa05`.
- Gradle production release succeeded (4m19). All 108 checked bundled project sources match disk, including the fixed save footer and final sync notice handling. Hermes bundle bytes match the generated bundle; SQLite exists in all four ABIs. Existing internal certificate verifies for upgrade/App Links.
- Production entry is expo-router/entry; no fixture entry, source path, sample marker or Metro mock configuration is included. 73 mobile tests, TypeScript and targeted ESLint pass. 544 matching coaching translation keys per language. No backend/schema/web deployment in this release.


Final production APK installed successfully over the fixture on the emulator; package metadata reports 1.0.13 / code 14. Original Wi-Fi/mobile-data settings were restored and the task-owned emulator was stopped. Final authenticated physical-device journeys remain pending.
