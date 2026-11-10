# Exercise media ingestion

The 102-entry catalog includes an explicitly mapped 10-exercise Everkinetic pilot (29 WebP assets, including thumbnails). The remaining 92 entries retain their fallback display. This workflow accepts original or rights-cleared files and preserves provenance; it does not establish ownership or download assets from arbitrary sites.

1. Obtain files and permission for commercial use and redistribution. Keep the license evidence. Use JPG/PNG/WebP for images, GIF/WebP for animations, MP4/WebM for videos, GLB for models.
2. Publish the exact files to an HTTPS media host you control. Do not overwrite an existing URL with different bytes; use versioned filenames.
3. Create a version 1 JSON manifest. Each `assets` entry needs `exercise_id`, relative `file`, `media_type`, HTTPS `url`, HTTPS `source`, HTTPS `license_url`, `license`, `attribution`, `rights_holder`, meaningful `alt`, SHA256 `sha256`, and boolean `commercial_use: true`, `redistribution: true`.
4. Run from the backend directory with the intended database environment:

   ```sh
   .venv/bin/python scripts/import_exercise_media.py manifest.json --asset-root /absolute/asset/directory
   ```

   Default behavior only validates. It rejects unknown/private custom exercise IDs, missing rights fields, insecure/private URLs, duplicate references, path escapes, wrong extensions, oversized assets and checksum mismatches. It performs no network fetches or uploads.
5. After confirming the hosted bytes match the manifest, rerun with `--apply`. Only the named global exercise records' media arrays change, within one database transaction. No workout, activity, user or plan is changed. A rerun replaces each referenced exercise's array with the same validated array.
6. Refresh the mobile exercise library (normal sync cache expires after 15 minutes). Native images/animations use the disk cache; videos and 3D files open their HTTPS URL in the device's compatible viewer. First-time media access needs connectivity. A missing/failed asset shows a readable state; workout recording remains available.

`docs/EXERCISE_MEDIA_MANIFEST.json` records the licensed pilot files. `docs/EXERCISE_MEDIA_MAPPING.json` lists matched and pending exercise IDs. Optional image `role` values are `thumbnail`, `position_1`, `position_2`, and `pose`. The thumbnail is never treated as another position. Technique demonstrations still require qualified content review. No professional demonstration or full offline media pack is claimed by the current test release.


## Bundled pilot and existing databases

`backend/data/exercise_media.json` is generated from the validated manifest.
The library endpoint uses it as a read-only fallback **only for global exercises
whose stored media array is empty**. Custom exercises and any existing operator
media take precedence. No database migration, startup update, member assignment,
plan version or workout snapshot is changed by this fallback.

Assets are served from `https://nfc-fit.vercel.app/media/exercises/everkinetic-v1/`.
WebP filenames include their content hash. Publish web assets before the backend
fallback. The full license, attribution and selected original SVGs are hosted
alongside them. Do not replace an already published hash URL with different bytes.

To reproduce the pilot, install Pillow in a development Python environment and
run `python3 backend/scripts/build_exercise_media_pilot.py` from the repo root.
This intentionally networked build tool fetches only a pinned upstream revision;
the runtime endpoint and existing ingestion validator perform no media downloads.
All generated outputs must be reviewed and committed together. The selected
source SVGs are retained. The initial squat candidate was excluded after visual
review because one source frame lacked the lower body; it remains pending.

Web details show positions together on desktop and use explicit position buttons
at <=600px. Mobile uses explicit position buttons and disk-cached images. There
is no automatic cycling of stills, including with reduced-motion enabled.
First access still requires a network connection. Legacy video/3D links remain.
