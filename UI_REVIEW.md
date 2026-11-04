# NFCFit UI and Functional Review

## Summary

The web app was run at `http://localhost:3000` and reviewed in the signed-in, mobile-width browser view. Per the requested scope, this report covers the web app only; the separate Expo mobile app is not included. The main reliability issue was that several screens displayed sample-looking values as if they were real account data. Some visible controls were also inert or did not match their displayed period.

## Improvement list

1. Replaced fabricated dashboard, fitness, wellness, and member metrics with values calculated from recorded logs; added honest empty states.
2. Made fitness and wellness day/week/month selectors filter the displayed data and date range.
3. Implemented CSV export for the currently filtered activity history and clarified imported, NFC, and manual sources.
4. Replaced the non-functional web NFC scan call-to-action with clear mobile-app guidance; surfaced tag validation and save errors.
5. Prevented exercise add/remove failures from appearing as successful changes.
6. Reworked the account/profile screens and added an avatar fallback when the profile image cannot load.
7. Improved activity history for narrow screens and added empty states for goals, logs, and tags.

## Screen-by-screen comparison

### Login

The sign-in and sign-up screen was left unchanged to preserve the existing in-progress authentication edits. Before and after are therefore the same.

- Before: [screenshot](./ui-review-screenshots/before-login.png)
- After: [screenshot](./ui-review-screenshots/after-login.png)

### Overview / Dashboard

Removed hard-coded steps, workouts, calories, streak, and chart values. Summary cards, goals, recent activity, and the 7-day chart now use recorded data and explain when there is no data.

- Before: [screenshot](./ui-review-screenshots/before-dashboard.png)
- After: [screenshot](./ui-review-screenshots/after-dashboard.png)

### Members

Removed the non-functional “Add Member” action and sample activity figures. The page now reflects the signed-in account and its actual daily activity. Added a letter avatar fallback for broken or missing profile images.

- Before: [screenshot](./ui-review-screenshots/before-members.png)
- After: [screenshot](./ui-review-screenshots/after-members.png)

### Fitness

Replaced fixed workout counts, calorie totals, trends, and exercise quantities with log-based calculations. Day/week/month now changes the selected date range; an empty period no longer shows sample charts.

- Before: [screenshot](./ui-review-screenshots/before-fitness.png)
- After: [screenshot](./ui-review-screenshots/after-fitness.png)

### Wellness

Applied the selected day/week/month period to wellness logs and goal totals. Removed the sample score, streak, water intake, and target; the screen now shows actual progress or a clear no-goals/no-logs state.

- Before: [screenshot](./ui-review-screenshots/before-wellness.png)
- After: [screenshot](./ui-review-screenshots/after-wellness.png)

### Activity History

Health-imported entries are now categorized as Health, and statuses distinguish imported, NFC, and manual logs. Search includes category and source; CSV export uses the current filter and is disabled when there is nothing to export. The table becomes a readable card layout on narrow screens.

- Before: [screenshot](./ui-review-screenshots/before-tasks.png)
- After: [screenshot](./ui-review-screenshots/after-tasks.png)

### Tags

Removed the inert “Add Tag from Scan” control because NFC scanning is not supported in this web screen. The page now directs scanning to the mobile app, explains the empty state, validates edits, and displays save failures.

- Before: [screenshot](./ui-review-screenshots/before-cards.png)
- After: [screenshot](./ui-review-screenshots/after-cards.png)

### Exercises

Kept the working library search/category filters. Failed add/remove requests now show an error instead of updating the screen as though the change were saved. The account’s exercise list was not modified during review.

- Before: [screenshot](./ui-review-screenshots/before-exercises.png)
- After: [screenshot](./ui-review-screenshots/after-exercises.png)

### Profile

Replaced the minimal name/email card with structured account details, a resilient initials avatar, and explicit sign-out error feedback.

- Before: [screenshot](./ui-review-screenshots/before-profile.png)
- After: [screenshot](./ui-review-screenshots/after-profile.png)

### Settings

Replaced the generic settings placeholder with an accurate account/session panel and clarified that theme and notification preferences are not available in the web app yet. Sign-out failures are surfaced on the page.

- Before: [screenshot](./ui-review-screenshots/before-settings.png)
- After: [screenshot](./ui-review-screenshots/after-settings.png)

## Functional checks and remaining work

- Verified navigation, the mobile menu state, fitness and wellness period selection, exercise search, the Health history filter, and export-disabled behavior for an empty history.
- Verified `npm --prefix web run build` succeeds.
- `npx tsc --noEmit -p tsconfig.json` still reports existing errors in `old_App.tsx` and `KanbanPage.tsx`; those unrelated legacy errors were not changed.
- No tag edits, exercise writes, or sign-out were performed against the signed-in account. Consequently, persistence/write flows need a disposable test account or test data for end-to-end verification.
- The browser also reports the Tailwind CDN production warning from `web/index.html`; move Tailwind to the build pipeline before production deployment.
- Remaining product work: connect real step data, implement web-side member/tag creation if intended, and provide full localization (the current web screens mix English and Turkish).
