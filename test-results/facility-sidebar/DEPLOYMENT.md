# Facility sidebar publication — 2026-11-10

Feature commit `0d336b4` pushed to `main`.

- Web: `dpl_8uJstvNP8fw6EJpyBAsuML8iJ6iH`, READY, https://nfc-fit.vercel.app/console
- API: `dpl_CRz3ryzLAZcJSg7W7dwzczqhgdyu`, READY, https://nfcfit-tenant-api.vercel.app

Both are actual GitHub-triggered deployments. The API Root Directory remains `backend`; fixture scripts and legacy app.py are excluded from production. This change does not modify production backend behavior, role assignments or member data.

Live checks: console 200; facility lazy-loaded chunk exists and includes the facility preference key; API health 200, protected library 401, legacy /api/tasks 404, fixture auth path 404. Exact results: `live-checks.json`. Local tests cover authenticated administrator/manager flows with synthetic data; no authenticated production session is claimed.

Verification: 8 browser checks, 30 backend role checks, web TypeScript and production build pass. Eight actual desktop/mobile screenshots are indexed in `SCREENSHOT_INDEX.md`.
