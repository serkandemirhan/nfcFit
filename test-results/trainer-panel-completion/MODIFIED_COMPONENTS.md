# Modified components for this pass

The workspace already contained broad uncommitted backend, native and web changes. Those are preserved. This pass starts from snapshots under `/tmp/nfcfit-panel-before`; it does not attribute prior work to this delivery.

| File | Change |
| --- | --- |
| `web/TrainerAdminLayout.tsx` | Trainer-only shadcn sidebar, responsive menu, page title/breadcrumb, refresh, Sonner host. |
| `web/components/trainer-ui/primitives.tsx` | Reusable shadcn/Radix buttons, fields, select, badge, table, dialog and sheet. |
| `web/components/trainer-ui/sidebar.tsx` | Responsive collapse/provider/tooltip/navigation primitives adapted from upstream. |
| `web/components/trainer-ui/data-table.tsx` | TanStack real-data sorting, pagination, empty states and semantic tables. |
| `web/TrainerExerciseLibrary.tsx` | Search, muscle/equipment filters, details, real instruction/media attribution and selected-exercise handoff. |
| `web/CoachingConsole.tsx` | Compose Trainer shell, replace horizontal navigation and member cards, retain all member/report/message flows, real successful-action toast, hide false zero metrics while loading. |
| `web/TrainerPlanning.tsx` | Reuse form/button primitives, replace custom dialog behavior with Radix, exercise-to-workout request, retain calendar/editor/save/publish/assignment code. |
| `web/trainer-admin.css` | Scoped professional layout, responsive table rows, full-screen details, mobile 44px calendar correction, portal styling. |
| `web/trainer.tailwind.config.cjs`, `web/trainer-tailwind.input.css`, `web/trainer-utilities.css` | Bundled Tailwind 3 utilities scoped to `.nfc-admin`, with preflight disabled; no global CDN or other-role migration. |
| `web/package.json`, `web/package-lock.json` | MIT/open-source UI dependencies and reproducible test/style scripts. |
| `web/tests/trainer-panel.*.cjs`, `web/tests/trainer-panel-keyboard.ios.cjs` | Isolated browser regression, five-size captures, focused UI and native keyboard verification for the new shell. |

No backend API, database schema, authentication implementation, NFC rules, native application or other-role component was edited in this pass. `TenantConsole.tsx` and `TrainerPlanningUI.tsx` remain byte-identical to their pre-pass snapshots. Existing routes and tenant/role checks are reused.
