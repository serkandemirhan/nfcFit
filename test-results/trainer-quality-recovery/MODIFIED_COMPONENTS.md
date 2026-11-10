# Modified components

| File | Correction | Preserved boundary |
|---|---|---|
| `web/TrainerPlanning.tsx` | Compact program/workout hierarchy; focused mobile week/day/overview; optional filters/notes/summary; scoped save/publish/apply feedback and retry; explicit unpublish confirmation; concise preview and assignment review with independent scrolling/footer | Existing routes, API payloads, plan/day/target types, coverage rules, copy behavior and authorized assignment endpoints |
| `web/TrainerPlanningUI.tsx` | Reusable persistent `PlanningSaveState`; controlled disclosure support; measured editor/action areas and VisualViewport keyboard clearance | UI presentation; no persistence or role enforcement moved into this component |
| `web/lib/trainer-save-state.ts` | Six explicit save phases with saving/failure precedence and publication distinctions | Server content remains authoritative; no new persisted state/schema |
| `web/trainer-workspace.css` | Trainer-scoped tokens, bounded workspace, consistent gaps/type/touch targets, 25/55/20 desktop edit layout, mobile views, reserved modal footer and progress graphics | NFCFit navy/lime identity; member and other club routes excluded from the new CSS |
| `web/CoachingConsole.tsx` | Weekly completion graphic, compact historical set comparison, recent recorded workout links, missing-session summary and honest empty states and collapsed future-program section; read refresh no longer emits a generic save success | Recorded/frozen workout targets and actual sets; existing authorized reads and filters |
| `web/TenantConsole.tsx` | Trainer-only maximum-width/shell class; coordinate initial session loading so duplicate callbacks for the same token cannot leave a successful reload stuck on loading | Existing provider, tokens, role resolution, permission checks, club isolation and API transport |
| `web/package.json` | Commands for recovery workflow and save-state tests | No added application dependency |
| `web/tests/trainer-quality.*.cjs` | Actual browser workflow, visual/geometry captures, preview/reorder/validation/mobile checks and explicit publication/empty-state regression | Real fixture API/SQL; only stated one-shot failure responses are injected |
| `web/tests/trainer-save-state.test.cjs` | Six save-state unit cases | Covers user-visible state priorities and distinctions |
| `web/tests/trainer-keyboard-native.ios.cjs` | Final native Safari accessibility/real system-key check, real API verification and screenshot | No Web Inspector dependency; no native product code change |
| `web/tests/trainer-keyboard.ios.cjs` | Configurable evidence destination for reusing genuine native-keyboard check | No native app/product code change |

No backend application, database migration/schema, business API or native NFC recording file was changed for this recovery pass. The earlier workspace already had unrelated uncommitted work; it was retained.
