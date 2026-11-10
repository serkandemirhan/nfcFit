# Known issues and verification limits

- **Native OS keyboard: not verified in this pass.** CoreSimulator/Appium could not initialize reliably. No old native image is represented as new evidence. Actual375px browser editing/reload and reduced375×450 viewport checks passed. See [result](keyboard/RESULT.json) and [driver log](keyboard/appium-setup.log).
- **Dependency release follow-up:** overall web dependency audit reports10 advisories, including8 high. See [audit](dependency-audit.json). Major upgrades across shared role infrastructure were outside this Trainer-only change.
- Live Supabase, production hosting, physical iOS/Android phones and physical NFC scans were not tested. No auth/NFC/schema/backend behavior was changed; actual local API/SQL persistence and relevant backend isolation tests passed.
- Existing assignment copies remain independently published; overlap resolution preserves data and offers the existing later-start workflow. No unsupported destructive replacement/archive operation was added.
- Existing shared Tailwind CDN remains for untouched interfaces. Trainer components and scoped utilities are bundled locally.

The requested20 browser/API workflows passed. These limits remain relevant to a production release decision; no production deployment or security certification is claimed.
