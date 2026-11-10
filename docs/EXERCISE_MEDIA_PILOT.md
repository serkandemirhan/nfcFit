# NFCFit exercise media pilot

Implemented scope: 10 of the 102 existing exercises. Source: Everkinetic / Greg Priday, CC BY-SA 4.0. No RepDB media is bundled. RepDB's MIT examples informed the list/detail interaction; NFCFit retains its existing routes, framework, permissions and design.

The full match/pending inventory is `EXERCISE_MEDIA_MAPPING.json`; reproducible conversion and manifest validation are described in `EXERCISE_MEDIA_WORKFLOW.md`. Source revision and source PNG checksums are recorded. The initially considered squat picture was rejected due to an incomplete frame. No fuzzy matching is performed at runtime.

Read-only API fallback supplies media only when an existing global exercise has no stored media. No member assignment, historical target, actual set or custom exercise is changed. Deploy web assets first, then backend. Existing mobile installations can receive catalog media on refresh; the new position-selector UI requires a new app build.

Validation and screenshots: `test-results/exercise-media/TEST_REPORT.md` and `SCREENSHOT_INDEX.md`.

References:
- https://github.com/everkinetic/data
- https://github.com/RepDB/repdb-example-react-native
- https://github.com/RepDB/repdb-example-nextjs
- https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
