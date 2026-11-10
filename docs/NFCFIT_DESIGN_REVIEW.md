# NFCFit 1.0.12 — mobile visual release

2026-11-08. Android versionCode 13. This follows the supplied dark navy/lime reference across the member Today, Programım, plan preparation and exercise library flows. It is a visual implementation with real local data; it does not add an automatic training recommendation engine or claim a complete recreation of every reference screen.

## Delivered
- Today: real next/in-progress session, unique target-set progress, pause-excluding recorded duration, active days, compact wellness, facility goals and durable pending/rejected synchronization states. Legacy free activities remain visible. Personal daily goal editing remains reachable through Kişisel hedefler.
- Programım: compact expandable plans, scheduled session cards and actual progress. Advanced edit/copy/version controls are collapsed. The large creation prompt appears only for an empty list. Staff links retain existing role guards.
- New plan: goal, level, weekdays and weeks preparation, followed by the existing configurable builder. Nothing is saved at preparation time. Exercise selection supports several movements at once.
- Library: existing 102-entry catalog, offline text cache, search, muscle/equipment filters, favorites/custom exercises and detail tabs for information, schematic muscles and variations. Existing licensed media is displayed when supplied. The new original SVG illustrations are decorative/schematic, not individual professional exercise demonstrations or 3D animation assets.
- Shared dark/lime navigation, controls, status bars, contrast-safe login button/loading indicator, progress animation respecting reduced motion, matching Turkish/English coaching resources (486 keys each). Auth, NFC confirmation, account separation and durable offline queues remain in place. Legacy screens and user-authored/catalog content are not all redesigned or translated.

## Verification
68 mobile tests, 28 backend API/media tests and one separate disposable PostgreSQL RLS test pass: 97 total. General backend discovery runs 29 with the external RLS case skipped; it is passed separately. Mobile TypeScript and targeted ESLint pass. Four new helper tests cover progress counting, next-session selection, wellness and elapsed duration.

Native UI review used Android API 36.1 at 360 dp, normal and 1.3 font scaling, gesture and three-button navigation. An isolated fixture rendered the actual screen components with a clearly marked sample-data banner; it never contacted production or created user records. Verified Today, Programım, library/filter layout and exercise information. The goal/level preparation, weekday/week selection and transition into the existing builder were also exercised at font scale 1.3. A wrapping fix prevents the preparation header from overflowing at larger text sizes. Initial emulator ANRs coincided with guest CPU pressure over 99% and high memory/IO pressure; Launcher and System UI also stalled. Later idle-emulator retries could open the application and navigate again. This does not constitute physical-device performance signoff. Full muscle-tab/performance, multi-selection save with a real authenticated account, and physical NFC journeys still need testing on the user's phone.

The temporary fixture entry, Metro aliases and files were removed before the production build. The real production login gate was reached without a sample-data banner; the resulting review also led to the login button/status-bar contrast fix. Release verification rejects the fixture marker and source paths, checks project source contents against the bundle, and verifies package/version, embedded Hermes bytes, all four SQLite ABIs and the existing internal certificate. No backend/schema/web deployment is required for this visual release.

## Device acceptance
Install 1.0.12 over the existing application. With a member account: Bugün → Programım → Yeni plan → select goal/level/days/weeks → choose several library exercises → adjust targets → save. Then record a real workout/card, check Today progress and reports, disconnect and verify local reads/queued save, reconnect and check synchronization. Compare ordinary member versus active coach/manager access. Check Samsung three-button navigation and large text. Media thumbnails and exercises are schematic unless actual licensed content is available.

Screenshots under mobile/nfc-task-tracker/ui-review-screenshots/design-1.0.12-*.png are development fixture evidence, not real-member data. Files named initial, muscles, plans-large-text, builder-library and multi-select include incomplete, keyboard or ANR captures and are not acceptance evidence; use today, plans, library, exercise-info, current-large, setup-days-large and the later *-verified captures.

## 1.0.12 release evidence — 2026-11-08
- Android `1.0.12`, versionCode `13`, `com.serkandemirhan.nfcfit`.
- APK: `mobile/nfc-task-tracker/android/app/build/outputs/apk/release/NFCFit-1.0.12.apk`, 100,736,746 bytes.
- SHA256: `f171df6601ea9494577c6e6283e072a1a7733be109eae2845744320ab2c29584`.
- All 104 checked bundled project source files match disk. Embedded Hermes bytes, SQLite across four ABIs and existing internal signature verify. Production entry is expo-router/entry; no fixture marker, fixture source or Metro mock configuration is included.
- 68 mobile + 28 API/media + 1 separate PostgreSQL RLS tests pass (97 total); mobile TypeScript and targeted ESLint pass. Final production Gradle build succeeded. This release requires no server/schema/web deployment.

