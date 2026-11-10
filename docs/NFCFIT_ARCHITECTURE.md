# NFCFit architecture and repository audit

Current role contract (2026-11-08): club B2B SaaS only; PLATFORM_ADMIN, CLUB_ADMIN, CLUB_MANAGER, TRAINER, CLUB_MEMBER. Legacy owner/admin/coach are compatibility aliases. Manager operations do not grant Trainer access; Platform Admin has no implicit tenant staff authority. No independent athlete tier or consumer subscriptions. [Role matrix](NFCFIT_ROLE_ACCESS.md), [non-destructive rollout](NFCFIT_CLUB_ROLE_MIGRATION.md), [screen inventory](NFCFIT_SCREEN_INVENTORY.md), [acceptance](NFCFIT_CLUB_ROLES_ACCEPTANCE.md) supersede earlier role descriptions below.

Audited 2026-11-07 before extending the product.

## Existing applications
- `mobile/nfc-task-tracker`: Expo 54, RN 0.81.5, React 19, Expo Router Drawer, TanStack Query, Supabase client, native react-native-nfc-manager. Existing shared management UI, daily goals, weekly trend, safe bottom navigation.
- `web`: React/Vite, tenant console plus legacy task application. Preserve administration, public `/tag/:id` web fallback and Android association files.
- `backend/tenant_console.py`: FastAPI, SQLAlchemy/Postgres, verified Supabase identity, console_accounts/tenants/staff/memberships/exercises/nfc_tags/activities/member_exercise_goals. Production `backend/index.py`; legacy `backend/app.py` also mounts tenant router.
- Supabase direct tables used by mobile: users (legacy text IDs mapped to auth UUID), exercise_types/user_exercises/exercise_logs, wellness_types/goals/logs, exercise_tags and legacy tasks. `supabase_auth_rls.sql` contains profile RPC and owner policies. Older schema SQL is installation history, not an instruction to overwrite an existing database.

## Audit evidence and limits
Local `backend/.env` points at localhost PostgreSQL with only legacy tasks/users/cards/locations/layouts/attachments, RLS disabled, no storage schema. This is not the deployed console or proof of current hosted Supabase schema. Subsequent read-only audit used the existing Vercel production connection: hosted Supabase contains console and fitness tables, existing fitness owner policies, and no storage buckets. See implementation report for applied migration evidence. No credentials or user rows are copied to these documents. Existing worktree includes extensive prior uncommitted changes; preserve them.

## Existing offline/NFC system
SQLite WAL persistent account-scoped catalogs, memberships, activities, goals, tombstones, outbox and worker leases; per-row hash delta download; idempotent batches and history checkpoints; lifecycle/network/background sync. UID normalization preserves synthetic IDs. NDEF HTTPS links verified after write; Android App Links configured. iOS association awaits Apple Team ID. Native NFC requires APK/development build, not Expo Go.

## Extension design
Use the same FastAPI router/auth/session and `console_*` namespace. Separate coaching module registers models on existing metadata, with explicit coach-athlete relationship, immutable JSON plan snapshots plus normalized ownership/indexes, version CAS updates and per-workout snapshots. Set IDs are stable, updates use optimistic session versions; terminal workouts reject all further mutation. SQL constraints and transactions enforce integrity. JSON is structured/validated, not an unrestricted frontend document. Avoid duplicating existing facility exercises with unrelated identifiers: catalog entries are a reusable library while legacy exercise IDs remain available for NFC mapping.

New PostgreSQL migrations are additive and repeatable. RLS makes coaching data read-only to authenticated clients through scoped policies; writes use authenticated backend transactions. Console identity lookup uses a locked-down security-definer function; do not expose email/password hashes. Client bundles receive no service-role secrets. Runtime schema creation remains for current development convention; production migrations must be explicitly applied and checked.

## Reporting and media
Plans retain scheduled dates/timezone, workout actuals retain quantities and timestamps. Weekly volume is sum(reps*kg) for comparable recorded sets only. Completion and adherence are separately reported; missing values stay null. No fabricated media URLs; media manifest records rights and leaves licensed assets absent until supplied. Push and health adapters are extension points, not configured services.


## 1.0.10 detail completion
Account timezone is an additive column on the existing preferences row, validated as IANA and queued by the same local entry mechanism. Reporting preferences do not rewrite existing plan calendars. Daily cron evaluates yesterday in each plan zone; weekly report cron checks the latest finished week daily in each account zone to cover all UTC offsets. Stable notification group keys prevent repeat reminders from resetting read state.

Prepared future workouts only rebase through an explicit online command with CAS and immutable receipt. No rebase applies to started/terminal sessions or existing actuals. Client sync must drain pending workout commands first; stale concurrent device changes are rejected server-side. The original snapshot remains in plan-version history and the refreshed snapshot is captured in the command result.

Web analysis reuses the native pure performance aggregation module (type/data only; no React Native runtime dependency), with independently tenant-filtered datasets. Vite lazy-loads the coaching workspace. Operator media ingestion validates local checksums, rights metadata, scoped exercise IDs and public HTTPS provenance; it fetches no URLs. Native image cache is opportunistic and does not claim an offline media preload guarantee.
