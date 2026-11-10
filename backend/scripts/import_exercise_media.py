"""Validate locally supplied media; --apply updates only referenced library media.

python scripts/import_exercise_media.py manifest.json --asset-root /path/to/assets
Add --apply only after publishing those exact bytes at each declared URL.
This is an operator CLI, never exposed as an HTTP endpoint.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from exercise_media import validate_manifest
from tenant_console import ConsoleSession
from coaching import LibraryExercise
from sqlalchemy import select


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest")
    parser.add_argument("--asset-root", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with ConsoleSession.begin() as db:
        rows = {
            row.id: row
            for row in db.scalars(
                select(LibraryExercise).where(LibraryExercise.owner_id.is_(None))
            )
        }
        grouped = validate_manifest(
            json.loads(Path(args.manifest).read_text()), args.asset_root, set(rows)
        )
        if args.apply:
            for exercise_id, media in grouped.items():
                row = rows[exercise_id]
                row.content = {**row.content, "media": media}
        print(
            json.dumps(
                {
                    "mode": "applied" if args.apply else "validation_only",
                    "exercises": len(grouped),
                    "assets": sum(map(len, grouped.values())),
                }
            )
        )


if __name__ == "__main__":
    main()
