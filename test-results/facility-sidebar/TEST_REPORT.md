# Facility navigation and shared sidebar — 2026-11-10

Implemented in the running React/Vite panel, preserving existing sections, APIs, role conditions and forms. Upper facility tabs and workspace-switch buttons are now in a left sidebar, matching the Trainer layout. The final user instruction referring to the left menu was used to resolve the earlier mention of the right side.

## Findings and corrections

| Original problem | Changed files | Implemented correction | Functional result | Evidence | Remaining limit |
|---|---|---|---|---|---|
| Facility header, workspace buttons and horizontally scrolling section tabs consume vertical space. | `web/TenantConsole.tsx`, new `web/FacilityAdminLayout.tsx`, `web/facility-admin.css` | One compact account/breadcrumb header; role-allowed sections and workspace switches in the sidebar; club/capacity information retained. | Eight administrator links are retained; member, card, exercise, staff, activity and settings screens were opened. Workspace switching between facility and Trainer works. | Screenshots 01, 03, 05, 06; browser results. | This does not redesign the existing section forms/tables or change their data model. |
| Facility content is capped by the old centered shell, limiting useful detail width. | Facility shell/CSS | Use available viewport width, with a 220px sidebar and 72px icon rail. Sidebar remains accessible while long lists scroll. | At 1920px, content width is 1674px expanded and 1822px collapsed: **148px gained**. Search content and active selection survive toggling. | Screenshots 01 and 02; `functional-results.json`. | Existing mobile tables retain their internal horizontal scrolling; page itself does not overflow. |
| Collapse preference is lost and facility lacks the Trainer navigation behavior. | Shared `web/components/trainer-ui/sidebar.tsx` | Separate device-local facility and Trainer preferences, accessible labels/tooltips, expanded/control attributes and Ctrl/Cmd+B toggle. Storage failures do not block navigation. | Collapse persists through section navigation and page reload. Facility and Trainer preferences remain independent. Keyboard shortcut is ignored in form fields. | Screenshots 02 and 04; browser results. | Preference is local to this browser/device; selected facility section itself is not persisted across reloads. |
| Mobile needs navigation without reserving permanent content width. | Facility layout + shared sidebar/Sheet primitives | Mobile drawer with facility title; selecting a section closes it. Escape closes it and explicitly restores focus to the menu trigger. | 375x812 navigation/selection/Escape/focus restoration pass; no document horizontal overflow. | Screenshots 05–07. | This is responsive web validation, not native mobile application validation. |
| Navigation refactor must retain role restrictions. | Existing role conditions in TenantConsole; isolated fixture roles added only for testing. | Administrator-only subscription/settings remain hidden for operations managers; operations manager has no Trainer workspace action. | Manager UI restrictions pass; actual manager GET subscription request returns 403. Existing 30 club-role regression tests pass. | Screenshot 08; `role-regression.log`. | No production test accounts or role assignments were changed. |
| Loading/error states should retain account/navigation access. | `ClubConsole` loading fallback within FacilityAdminLayout | Facility shell, messages and account controls remain available while dashboard data loads or retry is offered. | TypeScript/build pass; actual fixture loads real facility data. | Source, build/type logs. | No production API outage is induced for this layout change. |

## Validation

- Actual Chrome/Playwright browser suite: **8 checks passed**, no uncaught page errors.
- Viewports: 1920x1080 expanded/collapsed facility, 1440x900 Trainer/manager and 375x812 responsive web.
- Web TypeScript and production build passed. Shared UI is lazy-loaded, keeping the main entry bundle around 426 KB rather than eagerly loading the navigation libraries on the login page.
- 30 backend club-role regression tests passed. No production backend domain logic was changed.
- In-app Browser was unavailable (empty browser list); existing standalone Playwright tooling was used.
- Isolated fixture: owner@planning.test and manager@planning.test use the existing fixture-only password. They are added idempotently to the disposable planning club; existing trainer memberships/workouts are retained. The fixture server is excluded from production deployment.

Screenshots are actual UI captures with synthetic local data. Publication details will be recorded separately after GitHub-triggered deployments complete.
