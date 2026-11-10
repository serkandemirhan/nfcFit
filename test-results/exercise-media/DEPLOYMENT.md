# Exercise media publication — 2026-11-10

Web: https://nfc-fit.vercel.app/console
API: https://nfcfit-tenant-api.vercel.app

Source is on `main`: media/UI/build correction `8228f2a`, PostgreSQL transaction-pooler correction `1dac292`.

Final inspected web deployment: `dpl_38ZyfND48jX8D2mrDwhNF5kPHW8A` — READY.
Final API deployment: `dpl_FtyLzVwE4D9WZp7mPGVuk4c7xtSc` — READY.

Web assets were published before activating the new API media fallback. All 29 WebP files were downloaded over public HTTPS and compared with the manifest hashes. The hosted license is accessible. Public console login was opened in actual Chrome at desktop and 375px; screenshots 09 and 10 record production, with no route interception.

The old globally installed Vercel CLI 37 could inspect projects but could not upload through the current endpoint. Deployment used `npx vercel@65.14.0`, without changing the global installation. Production environment values were retained; local fixture env files and dependency/build folders are excluded from uploads.

The first API rollout failed on some cold starts with duplicate psycopg prepared statement names against the transaction pooler. The corrected deployment disables automatic preparation for the psycopg driver. Following release, three rounds of health/library/auth/fixture-path checks return 200/401/401/404 respectively and the correct production CORS origin. No production data reset or media backfill command was run.

Limits: this is a 10-exercise pilot, not full 102-exercise media coverage. Images are position illustrations, not full motion demonstrations. Production sign-in/member edits were not exercised with real account credentials. Native source is ready for rebuilding; no new signed APK/IPA, OTA update or store publication was performed.

Evidence: `live-checks.json`, `production-browser-results.json`, deployment/inspection logs, `TEST_REPORT.md`, `SCREENSHOT_INDEX.md`.
