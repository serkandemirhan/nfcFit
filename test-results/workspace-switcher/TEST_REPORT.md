# Centered workspace switcher

- Original problem: Facility/Trainer workspace controls appeared in the facility sidebar footer and below the Trainer account header.
- Changed: `web/WorkspaceSwitcher.tsx`, `web/workspace-switcher.css`, `web/TenantConsole.tsx`, `web/FacilityAdminLayout.tsx`, `web/facility-admin.css`.
- Correction: A shared, topmost centered segmented control appears in both workspaces. Green active styling and `aria-pressed` identify the selected workspace. Facility navigation stays in its collapsible sidebar. Existing role filtering is preserved.
- Verification: Real local Chrome, authenticated isolated fixture owner/manager; 1440×900 desktop and 375×812 mobile. Both directions of workspace switching, centered top position, active state, collapsed sidebar, mobile section selection, lack of horizontal overflow, manager restrictions and absence of uncaught browser errors passed (8 results).
- Build: `npx tsc --noEmit` and `npm run build` passed.
- Evidence: [Screenshot index](SCREENSHOT_INDEX.md), [functional results](functional-results.json).
- Limitation: In-app Browser backend was unavailable (discovery returned no browsers); standalone Chrome/Playwright was used. Production authenticated accounts were not used. This change does not persist the selected workspace across reloads, matching existing behavior.

Run: `PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node web/tests/workspace-switcher.browser.cjs`.
