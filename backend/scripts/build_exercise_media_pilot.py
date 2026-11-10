"""Build the explicitly mapped Everkinetic pilot (development tool; needs Pillow).

Run from the repo root. Downloads only from the pinned upstream revision.
Original SVGs and license are retained; WebP files use content-addressed names.
This command writes repository assets, never database/member records.
"""
import hashlib
import io
import json
import sys
from pathlib import Path
from urllib.request import urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from exercise_media import validate_manifest

REVISION = "446bb9a3d0c3beb6b84f7c9d77dfc8af707a2ab6"
UPSTREAM = f"https://raw.githubusercontent.com/everkinetic/data/{REVISION}/"
HOST = "https://nfc-fit.vercel.app"
DIRECTORY = "media/exercises/everkinetic-v1"
# IDs are explicit: never select a media variant by fuzzy name matching.
MAPPING = {
    "lib-bench-press": ("0042", False),
    "lib-incline-bench-press": ("0043", False),
    "lib-dumbbell-bench-press": ("0055", False),
    "lib-dumbbell-curl": ("0224", False),
    "lib-leg-press": ("0127", False),
    "lib-deadlift": ("0099", False),
    "lib-romanian-deadlift": ("0118", False),
    "lib-push-up": ("0077", False),
    "lib-hammer-curl": ("0227", False),
    "lib-side-plank": ("0113", True),
}


def main():
    directory = ROOT / "web/public" / DIRECTORY
    source = directory / "source"
    source.mkdir(parents=True, exist_ok=True)
    catalog = {e["id"]: e for e in json.loads((ROOT / "backend/data/exercise_catalog.json").read_text())}
    upstream = {e["id"]: e for e in json.load(urlopen(UPSTREAM + "dist/exercises.json", timeout=30))}
    (directory / "LICENSE.txt").write_bytes(urlopen(UPSTREAM + "LICENSE.md", timeout=30).read())
    assets, mapping = [], []

    def add(exercise_id, image, role, index):
        image = image.convert("RGB")
        image.thumbnail((192, 192) if role == "thumbnail" else (640, 640), Image.Resampling.LANCZOS)
        data = io.BytesIO()
        image.save(data, format="WEBP", quality=85, method=6)
        contents = data.getvalue()
        sha = hashlib.sha256(contents).hexdigest()
        filename = f"{exercise_id}-{role}-{sha[:12]}.webp"
        (directory / filename).write_bytes(contents)
        assets.append(dict(exercise_id=exercise_id, file=filename, media_type="image", role=role,
            url=f"{HOST}/{DIRECTORY}/{filename}",
            source=f"https://github.com/everkinetic/data/tree/{REVISION}/dist",
            license_url="https://creativecommons.org/licenses/by-sa/4.0/", license="CC BY-SA 4.0",
            attribution="Everkinetic / Greg Priday · NFCFit uyarlaması",
            rights_holder="Greg Priday / Everkinetic", alt=f"{catalog[exercise_id]['name']} · {'küçük görsel' if role == 'thumbnail' else 'sabit duruş' if role == 'pose' else 'pozisyon ' + str(index)}",
            sha256=sha, commercial_use=True, redistribution=True))

    for exercise_id, (upstream_id, static) in MAPPING.items():
        entry = upstream[upstream_id]
        # The supported side-plank pose is the elevated position; not a fake loop.
        paths = entry["png"][-1:] if static else entry["png"]
        images = []
        originals = []
        for index, png in enumerate(paths, 1):
            payload = urlopen(UPSTREAM + "dist/" + png, timeout=30).read()
            image = Image.open(io.BytesIO(payload))
            images.append(image.copy())
            svg = png.replace("png/", "svg/").replace(".png", ".svg")
            (source / Path(svg).name).write_bytes(urlopen(UPSTREAM + "dist/" + svg, timeout=30).read())
            originals.append(dict(path=png, sha256=hashlib.sha256(payload).hexdigest()))
            add(exercise_id, image, "pose" if static else f"position_{index}", index)
        add(exercise_id, images[0], "thumbnail", 1)
        mapping.append(dict(exercise_id=exercise_id, source_id=upstream_id, source_title=entry["title"],
            status="matched", equipment=catalog[exercise_id]["equipment"], originals=originals,
            review="Equipment/variant and visible positions checked; not a certified technique demonstration."))
    manifest = dict(version=1, catalog_count=len(catalog), assets=assets)
    grouped = validate_manifest(manifest, directory, set(catalog))
    (ROOT / "docs/EXERCISE_MEDIA_MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "backend/data/exercise_media.json").write_text(json.dumps(grouped, ensure_ascii=False, indent=2) + "\n")
    report = dict(source_revision=REVISION, matched=mapping,
        pending=[dict(exercise_id=k, status="needs_review") for k in catalog if k not in MAPPING])
    (ROOT / "docs/EXERCISE_MEDIA_MAPPING.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(f"Built {len(grouped)} matched exercises / {len(assets)} assets; {len(catalog) - len(grouped)} pending review.")


if __name__ == "__main__":
    main()
