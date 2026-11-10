# Compact workspace header

Supersedes the separate top switcher row from the previous workspace-switcher report.

- Original problem: The workspace switcher occupied its own row above a second title/account row, wasting vertical space.
- Files: `web/TenantConsole.tsx`, `web/FacilityAdminLayout.tsx`, `web/workspace-switcher.css`, `web/facility-admin.css`.
- Correction: Desktop title/breadcrumb, centered switcher and right-aligned account actions share one 64–65px header. Trainer title now reads “Antrenör paneli” for a club owner using Trainer. Removed the redundant NFCFit/Kulüp caption in the Trainer header. Facility switcher sits within its existing header. At narrower widths, switcher wraps into a centered second row; account controls remain reachable.
- Functional checks: Real Chrome with local authenticated owner/manager fixtures, 1440px and 375px. Bidirectional switching, active indication, collapsed sidebar, mobile drawer section selection, header height, centering, horizontal overflow and role restrictions tested. See functional-results.json and SCREENSHOT_INDEX.md.
- Build: Web TypeScript check and production build passed.
- Limitations: In-app browser discovery returned no browsers, so standalone Chrome was used. Production authenticated session not tested. Narrow displays use two compact rows to keep controls usable.

Run: `PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node web/tests/workspace-switcher.browser.cjs`.
