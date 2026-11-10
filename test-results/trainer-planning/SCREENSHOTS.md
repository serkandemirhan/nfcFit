# Trainer precision screenshot index

Actual running application captures; no generated UI or composited keyboard. Desktop Chrome 1440×900; mobile Chrome 375×667 unless noted. S12–S14 use full-page capture, so fixed controls retain their original viewport position in the full document. Other precision images show the current viewport. S17 is a full iPhone SE simulator capture (750×1334 physical pixels, 375 CSS px) with the actual iOS system keyboard. S16 is a reduced viewport, **not an OS keyboard screenshot**.

| ID | Scenario | Evidence |
|---|---|---|
| S01 | Selected week 2 / day and independent workout editor | [S01-selected-week-day-workout-desktop.png](screenshots/precision/S01-selected-week-day-workout-desktop.png) |
| S02 | Intentional rest beside unconfigured day | [S02-rest-versus-unconfigured-desktop.png](screenshots/precision/S02-rest-versus-unconfigured-desktop.png) |
| S03 | Named exercise removal confirmation | [S03-safe-exercise-removal.png](screenshots/precision/S03-safe-exercise-removal.png) |
| S04 | Saved four-week draft | [S04-saved-draft.png](screenshots/precision/S04-saved-draft.png) |
| S05 | Incomplete program with exact missing-day actions | [S05-actionable-incomplete-program.png](screenshots/precision/S05-actionable-incomplete-program.png) |
| S06 | Published fully configured four-week program | [S06-published-four-week-program.png](screenshots/precision/S06-published-four-week-program.png) |
| S07 | Published version with unpublished local edits | [S07-unpublished-changes.png](screenshots/precision/S07-unpublished-changes.png) |
| S08 | Final assignment confirmation: member/program/dates | [S08-assignment-final-confirmation.png](screenshots/precision/S08-assignment-final-confirmation.png) |
| S09 | Overlapping affected existing assignment | [S09-overlap-affected-assignment.png](screenshots/precision/S09-overlap-affected-assignment.png) |
| S10 | Reviewed later start avoids the overlap | [S10-overlap-rescheduled-confirmation.png](screenshots/precision/S10-overlap-rescheduled-confirmation.png) |
| S11 | Explicit preserve-and-add coexistence confirmation | [S11-explicit-overlap-coexistence.png](screenshots/precision/S11-explicit-overlap-coexistence.png) |
| S12 | 375px selected week/day, workout/rest labels | [S12-mobile-week-day-selection.png](screenshots/precision/S12-mobile-week-day-selection.png) |
| S13 | Emre: independent completed workout, planned 4/completed 4/extra 0 | [S13-emre-progress-4-of-4.png](screenshots/precision/S13-emre-progress-4-of-4.png) |
| S14 | Ada: different workout, planned 4/completed 5/extra +1 | [S14-ada-progress-5-of-4-extra-1.png](screenshots/precision/S14-ada-progress-5-of-4-extra-1.png) |
| S15 | 375px exercise search, filters and persistent context | [S15-mobile-exercise-search-filters.png](screenshots/precision/S15-mobile-exercise-search-filters.png) |
| S16 | 375×450 reduced viewport: focused numeric input and save actions | [S16-mobile-focused-number-reduced-viewport.png](screenshots/precision/S16-mobile-focused-number-reduced-viewport.png) |
| S17 | Genuine iOS 17.2 numeric keyboard, focused 5-set input and visible Save | [S17-ios-system-numeric-keyboard.png](screenshots/precision/S17-ios-system-numeric-keyboard.png) |

Each mandatory scenario has its own capture. S13/S14 use distinct members and completed workout IDs; the automated test verifies different image bytes. The images are not reused for each other’s proof.

The [prior screenshot index](FIRST_PASS_SCREENSHOTS.md) retains 27 broader regression captures. The [baseline review directory](baseline-review/) preserves the original images used to identify these refinements. Generic prior images 16 and 17 are not the separate 4/4 versus 5/4 precision proof.
