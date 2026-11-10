# Actual screenshot index — 2026-11-10

Captured from the running application. Each file is an independent actual capture. Full-page screenshots can exceed the viewport height. Older reports are historical baselines; their images were not reused as current evidence.

## Current optimization evidence

| Scenario | Capture |
|---|---|
| New draft/workout with unsaved targets | [Unsaved recoverable](screenshots/01-unsaved-recoverable.png) |
| Recovery decision after reload | [Desktop recovery prompt](screenshots/02-recovery-prompt.png) |
| Restored second-week/day and numeric targets | [Restored editor](screenshots/03-recovered-focused-target.png) |
| Another device changed the server revision | [Independent recovered copy](screenshots/04-conflicting-recovery-copy.png) |
| 375px recovery dialog | [Mobile prompt](screenshots/05-mobile-recovery-prompt.png) |
| 375px restored standalone exercise | [Mobile exercise](screenshots/06-mobile-recovered-exercise.png) |
| Member with future assignment | [Scheduled state](screenshots/07-upcoming-member-state.png) |
| Member future program list | [Future assignments](screenshots/08-future-assignments.png) |
| Explicit cancellation with member/program/date/reason | [Cancellation confirmation](screenshots/09-cancel-confirmation.png) |
| Assignment/changes/cancellation with actor and reason | [Audit history](screenshots/10-assignment-audit.png) |
| Second server history page | [History page two](screenshots/11-history-server-page-two.png) |
| Opening a record outside the first page | [Older record](screenshots/12-old-history-record.png) |
| 375px history/audit after desktop resize | [Mobile history](screenshots/13-mobile-history-audit.png) |
| Cancellation succeeded; one injected list-refresh 503 | [Reload list without repeating cancellation](screenshots/14-cancel-succeeded-refresh-retry.png) |
| Initial 375px history with five rows | [Five-row history](screenshots/15-mobile-five-row-history.png) |
| Initial 375px audit with five rows | [Five-row audit](screenshots/16-mobile-five-row-audit.png) |
| 375px cancellation dialog; dismissed without mutation | [Mobile cancel review](screenshots/17-mobile-cancel-review.png) |
| 375px member with future assignment | [Mobile scheduled member](screenshots/18-mobile-upcoming-member.png) |
| **Actual iOS OS numeric keyboard**; 4→5 sets; save clear of keyboard | [iOS 17.2 SE screenshot](keyboard/screenshots/precision/S17-ios-system-numeric-keyboard.png) |

The native screenshot is 750×1334 device pixels at 375px CSS width. This is Safari in an iPhone SE simulator with the actual software keyboard, not a reduced browser-viewport substitute. Saved API result and input/save/keyboard geometry: [native-keyboard-results.json](keyboard/native-keyboard-results.json). It is not a physical-phone test.

## Persisted regression workflow

- [01-unsaved-program](persistence/workflows/01-unsaved-program.png)
- [02-focused-exercise-targets](persistence/workflows/02-focused-exercise-targets.png)
- [03-template-save-failed](persistence/workflows/03-template-save-failed.png)
- [04-applied-to-day-not-persisted](persistence/workflows/04-applied-to-day-not-persisted.png)
- [05-saving-program](persistence/workflows/05-saving-program.png)
- [06-saved-draft](persistence/workflows/06-saved-draft.png)
- [07-published-program](persistence/workflows/07-published-program.png)
- [08-published-with-unpublished-changes](persistence/workflows/08-published-with-unpublished-changes.png)
- [09-program-save-failed-retry](persistence/workflows/09-program-save-failed-retry.png)
- [10-overlap-final-review](persistence/workflows/10-overlap-final-review.png)
- [11-non-overlapping-final-review](persistence/workflows/11-non-overlapping-final-review.png)
- [12-member-persisted-schedule](persistence/workflows/12-member-persisted-schedule.png)
- [13-ada-five-of-four-extra](persistence/workflows/13-ada-five-of-four-extra.png)
- [14-emre-four-of-four](persistence/workflows/14-emre-four-of-four.png)

Distinct member data: [Ada 5/4 (+1 extra)](persistence/workflows/13-ada-five-of-four-extra.png) and [Emre 4/4](persistence/workflows/14-emre-four-of-four.png).

[Test report](TEST_REPORT.md).
