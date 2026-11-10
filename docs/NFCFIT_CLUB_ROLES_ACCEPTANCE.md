# Club roles — pre-pilot acceptance report

Date: 2026-11-08. Scope: the existing Android application, web club console, FastAPI authorization and PostgreSQL policies. The additive role migration and compatible API/web have now been deployed. The changed Android build has not yet been installed on the disconnected phone. See the current pre-pilot package for deployment evidence and remaining acceptance blockers.

## Delivered behavior

- Five product roles with tenant-scoped grants and explicit legacy compatibility; no independent athlete tier or consumer subscriptions.
- Club Admin: operational dashboard, Manager/Trainer/member controls, verified Admin promotion, subscription usage/change requests, billing profile, club settings and audit log.
- Club Manager: members, Trainers, cards, equipment, catalog and Trainer/member assignment. No billing/settings/Manager/Admin controls or inherited Trainer access.
- Trainer: library, club templates, assigned-member plans/performance/reviews/feedback. Changing Trainer to Manager revokes coaching access on the next request, including old owned club templates; historical records remain stored.
- Member: own plans, goals/history/wellness and permitted tracked changes; new personal plan creation requires an active club membership. Existing histories remain readable by their owner.
- Platform Admin: platform subscription/tenant endpoints; no automatic club operations/coaching authority. An explicit scoped staff grant is honored independently of the platform flag.
- API and database last-admin protection, including concurrent removal; verified successor promotion before ownership handoff.
- Transactional invitation/role/membership/card/billing/subscription audit entries and an immutable PostgreSQL audit ledger.

## Automated acceptance

Current combined results are recorded in `artifacts/prepilot-20261108-151446/checks/`, with commands and scope notes. Its standalone HTML embeds logs and source hashes. `artifacts/club-roles-2026-11-08` remains the earlier role-only baseline.

| Check | Result |
| --- | --- |
| Backend API/domain journeys, both legacy and canonical role fixtures | PASS — 58 executed; 4 PostgreSQL cases skipped here and executed separately |
| Isolated PostgreSQL RLS/migration tests | PASS — 4 real PostgreSQL cases, including concurrent last-admin removal and populated migration reapplication |
| Native regression suite, including web/native capability parity | PASS — 107 tests |
| Mobile TypeScript and targeted ESLint | PASS — no TypeScript errors; targeted ESLint has zero errors/warnings |
| Web TypeScript and production build | PASS — no TypeScript errors; Vite production build completed |

The backend discovery command skips PostgreSQL cases unless pointed at an isolated database. The PostgreSQL runner executes those cases separately in a disposable socket-only cluster; it never uses the app database.

### Allowed/forbidden scenarios covered

1. Each role against operational reads and mutations; Admin/Manager catalog/equipment/assignment writes and forbidden Trainer/Member/Platform writes.
2. Admin-only subscription, billing-profile, settings and audit access; Manager direct-call escalation/self-promotion denied, including legacy aliases.
3. Different roles in different clubs, role-specific club navigation, cross-club record-ID substitution and platform flags without staff grants.
4. Manager can create/change/revoke Trainers, but cannot grant or change Admin/Manager access. Removed account/history rows are retained.
5. Sole Admin suspension/removal/demotion denied; two verified Admins permit ownership handoff; unverified successor promotion denied.
6. Concurrent database removal of two Admins leaves exactly one active Admin.
7. Direct authenticated SQL writes/password-hash reads denied; Admin billing/audit reads and Manager denials; Trainer privacy and granular wellness consent tested with both stored role generations.
8. Club role downgrade removes template/performance access without deleting plan rows.
9. Idempotent migration reapplication, accepted legacy rows preserved and unexpected permissive policy rejected transactionally.
10. Member invitations/reviews/removals and card revocations/removals leave auditable results. Billing profile logs contain field names, not tax IDs/addresses.
11. Subscription approval requires Platform Admin and explicit capacities; rejection leaves the current plan unchanged; a Club Admin cannot grant themselves limits through platform endpoints.
12. Existing manual/NFC recording, durable SQLite queues, retry/idempotency, partial sets, session date handling, plan snapshots/history and local progress regressions remain in the mobile/backend suites.

## Administrative UX audit

The [screen inventory](NFCFIT_SCREEN_INVENTORY.md) records both panels' section placement, restricted controls, role labels, member/card search, loading/error/retry states, destructive confirmations, verified-successor errors and subscription request feedback. Trainer assignment was placed in operational staff management so a Manager does not need to open the Trainer area. Equipment management is available in web operations as well as native operations.

Authenticated visual/interaction acceptance of the changed panels remains **pending**. The browser runtime returned no connected browsers. No screenshots from previous APKs are reused as current evidence. Keyboard, Samsung system navigation, touch targets, screen reader behavior and real network timings require the changed build on the physical device. Android 1.0.21 / code 22 has been generated for the combined pre-pilot changes. Its physical acceptance is still blocked.

## Release constraints and outstanding external work

- Production role migration and compatible API/web deployment are complete; 24 existing console tables were fingerprinted unchanged. Authenticated cross-role and new-build physical acceptance remain blocked. See the [rollout/rollback plan](NFCFIT_CLUB_ROLE_MIGRATION.md).
- Billing profile edits, usage and platform-reviewed subscription changes are implemented. Automatic charges, payment-method changes and invoice downloads require a configured payment provider; the UI does not claim these exist.
- Staff/member invitations provision relationships bound to verified-email sign-in. Automatic invitation email delivery is not configured and no real invitations were sent during tests.
- An offline phone cannot instantly learn an unseen membership/staff revocation. Current server checks apply on reconnection; no offline queue/history is silently erased.
- Existing production legacy fitness tables/policies were not rewritten by this scoped console migration. Their historical owner policies remain a separate baseline, not an inferred result of these isolated PostgreSQL tests.

Automated permission acceptance may pass while visual/release acceptance is still pending. This report does not declare an unconditional pilot go-live.

## Current combined pre-pilot evidence

[Self-contained report](../artifacts/prepilot-20261108-151446/index.html) contains the latest logs, production checks, screen findings, real baseline 1.0.20 screenshots, exact APK hash and A–L acceptance matrix. The old `club-roles-2026-11-08` artifacts are immutable historical evidence. Native SQL/offline regressions run against persisted test databases with simulated network/session boundaries; backend journeys use persisted SQLite and a patched auth provider; PostgreSQL tests use a disposable real PostgreSQL cluster. These checks are not a substitute for signing in as each real role.

Web legacy APIs now require verified bearer sessions and use the public Supabase key with the caller JWT so RLS applies. No service-role data client is constructed. A compiled Node ESM regression checks the task handlers that previously failed module resolution in deployment. The public web root now opens the club console; the legacy task UI is available only on the development `/legacy` path. Legacy records are retained.
