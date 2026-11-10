# NFCFit product specification

Current role contract (2026-11-08): club B2B SaaS only; PLATFORM_ADMIN, CLUB_ADMIN, CLUB_MANAGER, TRAINER, CLUB_MEMBER. Legacy owner/admin/coach are compatibility aliases. Manager operations do not grant Trainer access; Platform Admin has no implicit tenant staff authority. No independent athlete tier or consumer subscriptions. [Role matrix](NFCFIT_ROLE_ACCESS.md), [non-destructive rollout](NFCFIT_CLUB_ROLE_MIGRATION.md), [screen inventory](NFCFIT_SCREEN_INVENTORY.md), [acceptance](NFCFIT_CLUB_ROLES_ACCEPTANCE.md) supersede earlier role descriptions below.

Source of truth: user master prompt received 2026-11-07. This document describes requirements, not a claim that all are implemented. See NFCFIT_PROGRESS.md for actual delivery state.

## Product loop
Trainer creates a reusable program, explicitly assigned athletes receive independent copies, athletes execute and record actual sets manually or assisted by NFC, trainers review deterministic weekly reports and revise future sessions. Existing facility card administration and offline activity recording remain supported.

## Roles and privacy
Athletes own their records and future plan modifications. Coaches access only athletes explicitly assigned to them in an active facility. Facility owners/admins manage relationships/equipment; this role alone must not grant private training or wellness access. Platform administration does not implicitly grant coaching access. Wellness defaults private with metric-specific consent. Supabase Auth UUID, legacy profile ID and console account ID are distinct identifiers.

## Required modules
1. Localized exercise library, filters, favorites, custom movements, licensed-media manifest and placeholders.
2. Templates/personal plans; calendar sessions, arbitrary exercise lists, sets/reps/weight/time/distance/rest/notes/supersets. Independent multi-athlete assignment.
3. Immutable plan versions with before/after, actor, reason, review state and optimistic concurrency. Actual performance never edits targets; completed history retains original snapshot.
4. Durable workout lifecycle, individual actual sets, skip/edit/add/reorder/partial finish, idempotent retries and manual fallback.
5. Equipment and multi-exercise NFC mapping; scans select context and never complete a set without confirmation.
6. Athlete Today/Plan/Scan/Wellness/Progress navigation; coach Dashboard/Athletes/Plans/Reports/Messages.
7. Deterministic timezone-aware weekly reports, review and feedback, scheduled generation.
8. Water, separate coffee, sleep and wellbeing, history/goals and explicit sharing.
9. Contextual communication, unread/read state, grouped in-app notifications; push only once credentials and device delivery validated.
10. Navy/charcoal and lime visual system, Turkish initial interface, accessible controls and honest offline/loading/error states.

## Offline contract
Preload facility public exercise/card metadata upon membership request; activate after online approval. Persist actual activity locally before acknowledgement, update local totals immediately, synchronize with stable request IDs and preserved occurrence time. Download deltas/tombstones. Revoked memberships cannot be detected offline; rejected sync records remain visible. New coaching workflows must state clearly whether offline-capable rather than borrow the legacy activity guarantee silently.

## Validation
The 20 acceptance journeys in the supplied master prompt remain the release checklist. Automated API/SQLite tests do not substitute for physical Android/iOS NFC, accessibility and visual testing. Never invent media, physiological conclusions, credentials or successful deployments.
