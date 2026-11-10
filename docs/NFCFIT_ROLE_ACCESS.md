# NFCFit club roles and permission matrix

Updated 2026-11-08. This is the current product contract; the migration and acceptance reports below explain compatibility and release status.

NFCFit is club B2B SaaS. The only product roles are PLATFORM_ADMIN, CLUB_ADMIN, CLUB_MANAGER, TRAINER, and CLUB_MEMBER. There is no independent athlete account tier or consumer subscription. “Athlete” in existing schema/API identifiers describes a member participating in training, not an additional role. A member can maintain personal plans within an active club membership.

| Action | PLATFORM_ADMIN without club staff grant | CLUB_ADMIN | CLUB_MANAGER | TRAINER | CLUB_MEMBER |
| --- | --- | --- | --- | --- | --- |
| SaaS overview, create/suspend club, platform subscription approval | Yes | No | No | No | No |
| Club operational dashboard | No | Assigned club | Assigned club | No | No |
| Billing profile, subscription usage, upgrade request | No through club API | Assigned club | No | No | No |
| Club settings, operational audit log | No through club API | Assigned club | No | No | No |
| Invite/create/deactivate/remove Club Managers | No | Yes | No | No | No |
| Grant/revoke Club Admin | No | Verified target; last-admin protection | No | No | No |
| Invite/create/deactivate/remove Trainers | No | Yes | Yes | No | No |
| Invite/add/review/deactivate/remove Club Members | No | Yes | Yes | No | No |
| Register/assign/edit/revoke/remove NFC cards | No | Yes | Yes | No | No |
| Manage equipment and club exercise catalog | No | Yes | Yes | No | No |
| Browse exercise library | Authenticated library access, not member data | Yes | Yes for equipment/catalog work | Yes | Yes |
| Assign Trainer to member | No | Yes | Yes | No | No |
| Coaching dashboard, create club plan templates | No | Yes | No | Yes | No |
| Assigned member plan/performance/reviews/feedback | No | Active explicit Trainer assignment | No | Active explicit assignment | Own records |
| View unrelated members' private training records | No | No | No | No | No |
| Read another member's wellness | No | Explicit assignment + metric-specific consent | No | Explicit assignment + metric-specific consent | Own records only |
| Own plans, goals, history, wellness, permitted tracked edits | Only if separately a club member | If separately a member | If separately a member | If separately a member | Yes |
| Record NFC activity / start new club workout | Separate active club membership required | Same | Same | Same | Active membership |
| Access another club by changing tenant ID | No implicit access | No | No | No | No |

Club Admin has full operational authority, not an exemption from protected training/wellness access. Club Manager is an operations role, not automatically a Trainer. Platform Admin manages subscription policy through `/platform/*`, without receiving club staff permissions. A platform administrator with an explicit staff record can separately switch into that authorized club workspace.

Role resolution is per `(tenant_id, account_id)` staff row; memberships are separately club-scoped. One user can manage club A, train in club B, and be a member in club C. UI selection must never combine one club's role with another club's ID. Inactive staff/club rows confer no authority.

## Compatibility and ownership

Stored `owner` resolves to CLUB_ADMIN, `admin` to CLUB_MANAGER, and `coach` to TRAINER. They are legacy aliases, not additional product roles. Existing rows and histories are not rewritten. `/auth/me` and staff responses retain the stored `role` for compatibility and add `effective_role`; updated clients normalize both forms. Updated client writes use canonical roles. Legacy aliases remain accepted at the API boundary with identical permission checks. New platform-provisioned clubs receive CLUB_ADMIN.

A Club Admin invitation is provisioned initially as Manager/Trainer. The target must sign in with a verified email before an existing Club Admin can promote them. Staff mutations serialize on the club row and re-check current actor/target roles. The last active Club Admin cannot be demoted, suspended, removed or deleted, including simultaneous database requests. Ownership handoff requires promoting a verified successor first, then revoking the former administrator. No emergency platform impersonation or last-admin bypass endpoint is introduced.

Removal means access revocation (`removed`), not deletion of the account, workouts, versions or plan history. Card deletion retains activity records. Invitations provision an email-bound account/club relationship; they do not send an email automatically.

## Enforcement and evidence

Frontend navigation, protected native routes, API guards and PostgreSQL read policies all enforce tenant scope. Direct authenticated database mutations are denied; writes use checked backend transactions. Server roles are re-read on requests. Existing offline navigation can use cached identity; unseen revocations cannot take effect on an offline phone until synchronization. Rejected offline recordings remain visible.

Staff invitations/transitions, membership invitations/reviews/transitions, NFC revocations/removals, billing-profile changes and subscription requests/reviews create transactional audit entries. Tax identifiers and billing addresses are not copied to audit details. PostgreSQL prevents audit alteration.

See [migration plan](NFCFIT_CLUB_ROLE_MIGRATION.md), [screen inventory](NFCFIT_SCREEN_INVENTORY.md), and [pre-pilot acceptance report](NFCFIT_CLUB_ROLES_ACCEPTANCE.md).
