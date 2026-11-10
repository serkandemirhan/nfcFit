# Open-source UI selection

Date: 2026-11-09. Branch: `feat/trainer-admin-ui-completion`.

## Decision

Use **official shadcn/ui composition patterns and Radix primitives**, adapted to NFCFit's navy/lime styling and scoped CSS, within the existing web application. Do not import the entire Shadcn Admin application.

Evaluated sources:

- [Shadcn Admin](https://github.com/satnaing/shadcn-admin), MIT, observed package 2.2.1: React 19, Vite 8, TypeScript 6, Tailwind 4, TanStack Router, Clerk integration, Zustand and unrelated template feature pages.
- [Official shadcn/ui Vite installation](https://ui.shadcn.com/docs/installation/vite).
- [Official Sidebar](https://ui.shadcn.com/docs/components/sidebar), [Dialog](https://ui.shadcn.com/docs/components/dialog), [Sheet](https://ui.shadcn.com/docs/components/sheet), [Data Table](https://ui.shadcn.com/docs/components/data-table), [Native Select](https://ui.shadcn.com/docs/components/native-select), [Sonner](https://ui.shadcn.com/docs/components/sonner).

NFCFit already uses React 19.2, TypeScript 5.8 and Vite 6 (resolved versions in `dependencies.json`). `/console` is selected by the existing entrypoint; Trainer navigation uses local screen state rather than a router. Existing Supabase identity, role predicates, tenant selection and transport must remain authoritative. Existing utilities are Tailwind 3 via a shared CDN script, with custom Trainer styles.

The full Shadcn Admin scaffold would bring unnecessary routing, auth and global CSS migration into shared role surfaces. Its reusable component foundation is compatible, so the official shadcn/ui components are selected as the lower-impact alternative explicitly allowed by the task. No Clerk, second app, template demo pages, mock business data, global theme reset or replacement route is introduced.

## Actual integration

- `components/trainer-ui/primitives.tsx`: shadcn Button/CVA/Slot, Input, Label, Badge, native select, semantic Table, Radix Dialog/Sheet portal composition.
- `components/trainer-ui/sidebar.tsx`: adapted official provider/state, responsive Sheet, icon collapse, tooltip labels and Cmd/Ctrl+B shortcut. Kept only used component surface; NFCFit navigation remains role-scoped application content.
- `components/trainer-ui/data-table.tsx`: official TanStack Table pattern, real rows, sorting, pagination and honest empty state. Pinned Table **8.21.3**, matching the evaluated shadcn pattern; latest v9 has a different API.
- `TrainerAdminLayout.tsx`: application-specific page/menu content composed from those reusable components.
- `TrainerPlanning.tsx`: existing dialogs now use Radix focus trap, Escape, portal and title association; existing field/save/business handlers retained.
- `TrainerExerciseLibrary.tsx`: actual server catalog, composable table/search/filters, full-screen phone details and exercise-to-workout handoff.
- `trainer-admin.css`: shared tokens, all application overrides scoped to `.nfc-admin`/actual Trainer ancestry; portals carry the same scope.

Upstream source snapshots and MIT notices are included in `sources/`. These are **adapted component sources**, not a claim that the entire Shadcn Admin template is installed. Trainer utilities are compiled locally with pinned Tailwind 3.4.17, `important: ".nfc-admin"`, and preflight disabled. The shared legacy CDN script remains for other role surfaces; the new component styles and scoped Trainer utilities are bundled by Vite. No proprietary dependency was introduced. Package lock records exact dependency resolution.
