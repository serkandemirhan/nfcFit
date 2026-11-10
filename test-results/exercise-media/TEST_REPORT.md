# Exercise media pilot — 2026-11-10

10 explicitly mapped global exercises, 29 content-addressed WebP assets (about 420 KB), 19 position images and 10 thumbnails. The remaining 92 catalog entries are **not claimed as mapped**. Everkinetic revision `446bb9a3d0c3beb6b84f7c9d77dfc8af707a2ab6`; artwork and resized derivatives: CC BY-SA 4.0. Original selected SVGs, full license, attribution, source checksums and exercise mappings are retained.

RepDB's MIT example projects informed the presentation approach. No RepDB dataset, paid preview animation or Next.js framework migration is included. Still positions are not represented as continuous movement animations. The initial squat candidate was excluded after visual inspection because a frame lacked the lower body; dumbbell curl replaced it in the pilot. Equipment/variant inspection is not professional technique certification.

## Findings and implementation

| Original problem | Components/files | Correction | Functional validation | Screenshot evidence | Remaining limitation |
|---|---|---|---|---|---|
| Web library uses the same icon; builder has no movement-specific pictures. | `web/TrainerExerciseLibrary.tsx`, `web/TrainerPlanning.tsx`, `web/ExerciseMedia.tsx`; native `components/exercise-selector.tsx`, `components/exercise-media.tsx` | Shared static-thumbnail selection; compact 56px web/66px native images; contain fit preserves equipment and limbs; failed/missing thumbnails retain a usable icon/illustration. | Actual fixture library supplies 10 mapped entries; list and 375px builder images load. Asset/URL selection unit tests pass. | `01-desktop-library.png`, `07-mobile-builder-search.png` | Only 10 movements mapped. Native component updated and compiled, but no new installed-device visual test claimed. |
| Detail displays only one image, with no position selection. | Web/native media components; shared `lib/exercise-media-presentation.ts` | Desktop positions side by side; <=600px web and native show explicit position selection. One static side-plank pose has no fake transition controls. No automatic cycling of stills. | Desktop both frames loaded; 375px position selection, keyboard Enter and reduced-motion preference pass; no horizontal overflow; static pose has no extra controls. | `02-desktop-positions.png`, `03-mobile-position-two.png`, `04-mobile-static-pose.png` | Generic position labels deliberately avoid claiming a clinically verified start/end sequence. |
| Exercise selection could become a separate navigation dead end. | Existing library → workout flow; builder thumbnail component | Retain direct add-to-workout and focused target editor. Media does not replace the selection action. | From detail, add bench press; verify selected movement and edit set count to 5. Builder search still works at 375px. | `06-mobile-edit-after-add.png`, `07-mobile-builder-search.png` | No change to existing week/day selection state or target semantics. |
| Missing/broken images could obscure editing or show a wrong substitute. | Web/native media components | Clear absent-image state, error message and retry; no similar-looking substitute exercise picture. | Unmapped squat details remain usable; injected image failure displays error, then retry loads correct bytes. | `05-unmapped-exercise.png`, `08-image-error.png` | Initial media download requires connectivity; a full offline media bundle is not claimed. |
| Existing production catalog rows would not acquire new media from insert-only seeding; overwriting rows could affect custom media/history. | `backend/exercise_media.py`, `backend/coaching.py`, generated `backend/data/exercise_media.json` | Read-only fallback only for ownerless global exercises with an empty media array. Existing operator/custom media wins. No database import/migration is needed for this pilot. | 17 coaching tests pass, including a new API test with an assigned plan, started workout and actual set, comparing library rows, versions, snapshots and actual records before/after library GET. Three media tests verify checksums, roles, scope and custom-media preservation. | Backend logs; no separate UI screenshot needed for immutable-record assertions. | This does not backfill database media fields; the fallback is applied to library responses. |
| Asset origin and licensing were not available for real images. | Build tool, manifest, mapping file, hosted license/attribution/source SVGs | Pinned source revision, explicit movement IDs, SHA-256, commercial/redistribution flags and optional image roles; source/license links in details. | All 29 files pass existing manifest validator; generated runtime index matches validated manifest. | Credits in `02-desktop-positions.png`, `03-mobile-position-two.png`; `media-validation.log` | Adapted artwork remains CC BY-SA 4.0; no ownership claim is made for third-party art. |
| Previous Git-triggered production web build failed while reading shared native TypeScript. | `web/vite.config.ts` | Explicit web tsconfig supplied to esbuild, so a web-only dependency install does not resolve `expo/tsconfig.base` from shared source files. | Normal web build and isolated web build with no mobile node_modules pass; web TypeScript passes. | `web-build.log`, `web-only-build.log`, `web-types.log` | CI/deployment result is recorded separately below. |
| Expo web export could not resolve expo-sqlite's bundled .wasm file. | Native `metro.config.js` | Register wasm as a Metro asset, following Expo SQLite web setup. | Expo web export and native TypeScript pass. | `mobile-export.log`, `mobile-types.log` | Export compilation is not native device execution. Hosting Expo SQLite web additionally requires appropriate cross-origin isolation headers; the separate Vite Trainer deployment is unaffected. |

## Production rollout correction

The first API deployment reached READY but some cold starts returned 500.
Runtime logs identified `psycopg.errors.DuplicatePreparedStatement` during
startup schema inspection against the Supabase transaction pooler. The
`vc_handler` import message was a subsequent runtime-wrapper error, not the
underlying database failure.

`backend/tenant_console.py` now passes `prepare_threshold=None` to psycopg
connections. SQLite and other driver configurations remain unchanged. The
11 tenant and 17 coaching tests pass after this correction; a real isolated
PostgreSQL test runs 15 repeated parameterized queries across transactions and
asserts no `_pg3_*` statements are prepared. No production records were deleted,
rewritten or reset to resolve this issue. Final live status is recorded below.

Driver reference: https://www.psycopg.org/psycopg3/docs/advanced/prepare.html

## Test execution

- `backend/tests/test_exercise_media.py`: 3 tests passed.
- `backend/tests/test_coaching.py`: 17 tests passed.
- `backend/tests/test_tenant_console.py`: 11 tests passed after the production pooler correction.
- Real isolated PostgreSQL: 15 repeated queries across transactions produce zero automatic named prepared statements with the actual configured SQLAlchemy engine. See `postgres-pooler-regression.log`.
- Web media/planning/save-state unit tests: 18 passed.
- Browser test: `web/tests/exercise-media.browser.cjs`; 1440x900 desktop and 375x812 responsive web. Functional results in `functional-results.json`.
- Web TypeScript, mobile TypeScript, production web build, isolated web-only build and Expo web export passed.
- In-app Browser connection was attempted; no browsers were available. Existing standalone Chrome/Playwright test tooling was used.

Browser data is isolated synthetic fixture data on localhost. Before publication, media requests are fulfilled with the exact repository files at their declared HTTPS URLs. Only the error scenario modifies a returned bench-press URL with a cache-busting query and aborts the media request; retry then serves the verified local bytes. This is documented fault injection, not a production outage. No production user workout is written by these tests.

## Publication

Published and verified. Web: https://nfc-fit.vercel.app/console. API: https://nfcfit-tenant-api.vercel.app.

- Web production deployment: `dpl_38ZyfND48jX8D2mrDwhNF5kPHW8A`, READY.
- API production deployment: `dpl_FtyLzVwE4D9WZp7mPGVuk4c7xtSc`, READY.
- Feature commit: `8228f2a`; transaction-pooler correction: `1dac292`; both pushed to `main`.
- All 29 public WebP files returned 200 and match their manifest SHA-256. Hosted full license returns 200.
- Actual production login renders at 1440x900 and 375x812, without horizontal overflow or uncaught page errors. No localhost fixture configuration appears in the production app entry bundle.
- 12 repeated/concurrent live API checks pass: health 200, protected library/auth endpoints 401, fixture auth route 404; CORS allows the actual web origin.
- Authenticated production member workflows were not rerun. Authenticated editing/data-preservation tests use isolated realistic fixture data. No real account password was reset or production workout created for validation.
- Native source and Expo export are updated; no new signed Android/iOS binary or store release is claimed. Existing installations can receive catalog pictures on refresh; the new native position-viewer controls require a rebuilt app.

See `DEPLOYMENT.md`, `live-checks.json`, `production-browser-results.json` and the screenshot index.
