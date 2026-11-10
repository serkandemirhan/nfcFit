# Club role compatibility and rollout plan

Date: 2026-11-08. The additive migration and compatible API/web release have now been deployed. Existing business records and stored role values were preserved. Authenticated five-role and physical-device release acceptance remains blocked by unavailable sessions/device connection.

## Inspect first

Existing staff storage is a unique club/account row with `owner`, `admin`, `coach`; members are separate membership rows; platform administration is an account flag. Backend `_tenant_access` already required a scoped staff row, whereas some navigation and operational reads conflated responsibilities. Existing active Trainer assignments and granular wellness consent are preserved. Existing historical `actor_role` values describe the actor at the time; they must not be rewritten.

The explicit alias mapping is owner → CLUB_ADMIN, admin → CLUB_MANAGER, coach → TRAINER. Manager no longer inherits Trainer plan/performance access. Any previous coaching assignments belonging to a legacy `admin` remain in history but do not authorize Trainer reads while that account is a Manager. An authorized Club Admin must deliberately choose the appropriate role and reassignment if that staff member will now train members. No automatic role promotion occurs.

## Additive migration

`backend/migrations/20261108_club_roles.sql` adds billing profiles, subscription requests and immutable audit records. It adds accepted-role validation, a last-admin trigger, scoped base-console read policies and canonical-role support in coaching helper functions. It makes no UPDATE to stored roles and deletes no business data. It is transactional and was tested twice consecutively against an isolated PostgreSQL cluster.

The migration fails if an unexpected existing policy would combine with the new policy to widen access, or if unrecognized staff role values exist. Resolve discrepancies through an explicit reviewed mapping/policy decision rather than deleting or reclassifying rows automatically.

## Release sequence

1. Back up the target database and record schema/policy definitions and row counts. Explicitly select the target `DATABASE_URL` without printing it or committing environment files.
2. Run `backend/.venv/bin/python backend/scripts/check_club_roles.py`. It opens a read-only PostgreSQL transaction and reports role counts, clubs lacking an active admin and unexpected base-console policies. Resolve any reported exception before rollout. It sends no invitations and performs no migration.
3. Apply `20261108_club_roles.sql` as the schema owner after the existing coaching foundation migration. Runtime `create_all` alone does **not** install PostgreSQL security policies/triggers.
4. Deploy the backend with canonical/legacy compatibility before updating web/mobile clients. Run authenticated tenant-isolation, direct API denial and last-admin checks in staging. Test an existing legacy-role account and a canonical-role account, including distinct roles in two clubs.
5. Deploy web and distribute the updated Android build. Old clients can keep sending legacy aliases; new canonical roles may require the updated clients for navigation. A legacy Manager may still show an old Trainer entry but the new backend denies that access.
6. Verify Admin billing/settings/Manager controls and Manager operational-only controls in authenticated web and Android sessions. Confirm current plan/workout history, offline queue replay and revoked membership handling. Acceptance must record the exact deployed builds, not infer production success from local tests.

## Rollback and limits

Keep the additive tables, protected ledger, role aliases and policies during an application rollback. Do not roll back to an API that does not understand canonical roles or that restores Manager coaching authority. Restore a compatible application release, or forward-fix permissions. Do not drop the audit/last-admin guards as a routine rollback.

If a club has no active administrator before migration, the trigger cannot invent a secure owner. Resolve ownership using a verified business ownership process before rollout. To transfer a functioning club, have the verified successor sign in, promote them to CLUB_ADMIN, then revoke the former admin. Do not remove the sole admin first.

Billing profiles and platform-reviewed subscription changes work without a payment provider. Automated payment collection, card management and invoice downloads require a configured provider/integration; no charged payment or generated invoice is claimed. Staff/member “invitations” are provisioning operations and do not currently send email.

## Applied rollout evidence — 2026-11-08

The production preflight passed with existing `owner`/`coach` aliases and no club missing an active Admin. A private mode-0600 backup of the existing console rows and policy/function definitions was taken before the transactional migration. Per-table fingerprints for all 24 existing console tables matched before and after: no role rewrite or business-record migration occurred. Backup contents are intentionally excluded from the acceptance package.

The compatible API was released at `https://nfcfit-tenant-api.vercel.app`; the web console at `https://nfc-fit.vercel.app/console`. Android 1.0.21 / code 22 is the matching client build. Public HTTP availability and unauthenticated denial checks are recorded separately from authenticated role acceptance. Current evidence: [pre-pilot package](../artifacts/prepilot-20261108-151446/index.html). Prior role-only artifacts are historical and remain unchanged.

Application rollback must retain canonical-role compatibility and the additive guards. No rollback script that drops the audit ledger, policies or last-admin protection is provided.
