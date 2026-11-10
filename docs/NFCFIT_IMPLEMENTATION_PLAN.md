# Implementation plan

Current role contract (2026-11-08): club B2B SaaS only; PLATFORM_ADMIN, CLUB_ADMIN, CLUB_MANAGER, TRAINER, CLUB_MEMBER. Legacy owner/admin/coach are compatibility aliases. Manager operations do not grant Trainer access; Platform Admin has no implicit tenant staff authority. No independent athlete tier or consumer subscriptions. [Role matrix](NFCFIT_ROLE_ACCESS.md), [non-destructive rollout](NFCFIT_CLUB_ROLE_MIGRATION.md), [screen inventory](NFCFIT_SCREEN_INVENTORY.md), [acceptance](NFCFIT_CLUB_ROLES_ACCEPTANCE.md) supersede earlier role descriptions below.

Execute in the user's phase order, preserving the shipped offline/NFC vertical slice. Track actual status in NFCFIT_PROGRESS.md.

1. Audit frameworks, schema, permissions, storage and existing modules; produce architecture/spec/progress docs.
2. Add coaching entities, validated schemas, scoped APIs, transaction/CAS rules and additive PostgreSQL RLS migration.
3. Reusable authored catalog, filters/favorites/detail/custom movements and media manifest without unlicensed URLs.
4. Trainer/personal templates, structured session builder, independent assignments.
5. Athlete plan/dashboard, snapshot workout lifecycle, actual set recording with manual entry and durable local state.
6. Equipment registry, compatible movements and active-workout NFC matching; retain legacy scan behavior.
7. Immutable versions, athlete/trainer revisions, review and notifications.
8. Coach assigned-athlete monitoring and detail/history filters.
9. Deterministic weekly reports, timezone boundaries, reviews/comments and authenticated scheduled worker.
10. Expanded private wellness and per-metric sharing.
11. Contextual messages/read state and in-app notifications.
12. End-to-end API security/regression tests, TypeScript/lint/build, Android artifact and honest external-device/deployment checklist.

Do not mark a phase complete solely because its schema exists. Integration with usable controls, validation and tests is required. Hosted migrations, hardware and external credentials are separate release evidence.
