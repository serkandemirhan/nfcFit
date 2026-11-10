# Exercise media ingestion

The 102-entry catalog has no third-party media bundled. This workflow accepts original or rights-cleared files and preserves provenance; it does not establish ownership or download assets from arbitrary sites.

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

`docs/EXERCISE_MEDIA_MANIFEST.json` intentionally contains an empty asset list until licensed files are supplied. Technique demonstrations still require qualified content review. No professional demonstration or full offline media pack is claimed by the current test release.
