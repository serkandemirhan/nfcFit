# NFCFit pre-pilot screen inventory

Updated 2026-11-08 for the five-role B2B model. Web entry: `/` and `/console`; the old task UI is development-only `/legacy`. Native entry: Yönetim. Tenant selection uses the user's active scoped staff grants.

| Screen / capability | CLUB_ADMIN panel | CLUB_MANAGER panel | Trainer / Member / Platform distinction |
| --- | --- | --- | --- |
| Workspace / club selector | Admin grants only for chosen club | Manager grants only for chosen club | Platform workspace separate; Trainer does not enter operational console |
| Operational overview | Members/capacity, requests, card usage, recent operational activity | Same operational view | No blanket Trainer member/activity list |
| Member list | Search, provision, approve/reject, suspend/reactivate, revoke membership | Same | Member sees own memberships; Trainer sees assigned members in coaching |
| NFC list/details | Register unassigned or exercise-linked cards, edit/link/write/revoke/remove | Same | Member scan/record is separate from card administration |
| Exercise catalog / equipment | Club catalog, equipment and card mappings | Same | Exercise library remains browseable; no equipment write by Trainer/Member |
| Staff | Manager/Trainer invitations; verified Admin promotion; role/status changes; remove | Trainer invitation/status/removal only | Higher-role controls absent for Manager; APIs also deny forged calls |
| Trainer assignment | Choose active Trainer and active member | Same, inside operational staff section | Does not grant Manager coaching access or wellness consent |
| Subscription / usage | Plan, member/card limits and usage; requested changes and review status | Hidden | Platform reviews changes through its separate workspace/API |
| Billing profile | Legal name, billing email, tax ID, address | Hidden | No card collection or fictitious invoice/payment portal |
| Club settings | Club name | Hidden | Manager cannot edit Admin-only settings through API |
| Audit log | Most recent 200 entries, no wellness payloads | Hidden | Member/Trainer/Platform without scoped Admin grant cannot read club audit API |
| Coaching | Templates, assigned members/plans/reports/feedback; assignment and consent limits apply | Hidden | Trainer has coaching; Member has own plans, execution, goals/history |
| Member Today/Plan/Progress/Wellness/Sync | Available if separately a member | Available if separately a member | Personal UX and offline data continue independently of staff administration |

## Pre-pilot review applied to both administrative panels

- Separate section navigation for overview, members, NFC cards, catalog, staff and operational activity. Subscription/settings/billing/audit only appear for Club Admin.
- Manager Trainer assignment stays in staff operations; no detour into a protected coaching workspace.
- Native selectors remove suspended clubs/staff and filter operators; web selectors remove inactive grants. Changing tenant/role remounts the relevant scoped console to avoid retaining another selected club's UI state.
- Search for member/card lists, compact section controls and existing card details sheet retained.
- Destructive member/staff removals have confirmation and preserve historical records. Role changes have explicit role labels; the server explains last-admin/verified-successor failures.
- Forms report errors and save state. Admin subscription requests remain pending until platform approval; approved capacity is explicit and cannot be below current usage.
- Native Admin subscription form and web Admin billing form do not expose payment collection implementation details as a user action. Platform-managed billing is explained accurately.
- Empty/error/retry states exist for subscription/audit loading. Database or API permission failures are not interpreted as a successful save.

This is a source and functional permission review. Authenticated pixel/layout, keyboard, touch, screen-reader and physical-device checks of these newly changed panels remain pending because the connected browser was unavailable. Earlier Android screenshots describe earlier builds and are not evidence for this role release. See the acceptance report for current verified checks and external limitations.

## Combined pre-pilot screen corrections

| Surface | Specific finding / applied correction | Current visual acceptance |
| --- | --- | --- |
| Today / Plans / plan setup | Explain membership activation before plan creation; retain actual and partial session priority, local dates and separate upcoming sessions | BLOCKED on 1.0.21 device |
| Progress | Compact chart and expandable status definitions; explicit completed/partial/missed counts; shared loading/error states | Baseline 1.0.20 screenshot only; 1.0.21 BLOCKED |
| Goals / Messages | Shared loading/error/retry state prevents failure being shown as an empty account | BLOCKED |
| Plan builder | Explicit club context; direct assigned-member creation; strict calendar/target validation; weekly preview; collapsible target editors; confirmed removals | BLOCKED |
| Trainer member detail | Primary create-and-assign action returns to that member, preserving historical plan versions | BLOCKED |
| Exercise selector / media | Keyboard-aware frame, validated custom input, busy guard, media error reset on exercise change | BLOCKED |
| Workout / history / revisions | Preserve actual sets, frozen snapshots, pause/partial completion, date context and tracked changes | Regression PASS; current visual BLOCKED |
| NFC / deep-link entry | Unknown club cards cannot become personal cards; manual UID resolves the club catalog; manual modal works when NFC is unsupported | Hardware BLOCKED |
| Coaching sync / card sync | HTTP-only deadlines, readable timeout/cancel errors, separate cache keys, loading/error before empty, Turkish job labels | Baseline successful real sync; new build BLOCKED |
| Profile / settings | Per-club status, active-role labels, confirmed logout, retain pending local records | BLOCKED |
| Wellness | Guard saves, show local confirmation/failure, accessible add control | BLOCKED |
| Admin / Manager operations | Keyboard-aware sheets, member/staff cache and counts update after server confirmation, scoped settings refresh | BLOCKED |
| Web member activity | Persistent account-scoped request ID and pending retry across reload; no blind duplicate post | Regression PASS; signed-in web BLOCKED |
| Web entry / protected APIs | B2B console is public entry; verified-session RLS client replaces Origin-only service-role access | Deployed HTTP PASS; signed-in visuals BLOCKED |

All current routes, including retained legacy task/card/layout screens and aliases, are enumerated in the current acceptance package. Retained legacy surfaces have no new visual acceptance claim. No screenshots from previous APKs are represented as screenshots of the new build.
