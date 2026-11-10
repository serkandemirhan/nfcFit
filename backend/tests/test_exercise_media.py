import hashlib
import tempfile
import unittest
from pathlib import Path
from exercise_media import validate_manifest, public_https, library_media
import json


class ExerciseMediaTests(unittest.TestCase):
    def test_bundled_pilot_checksums_roles_and_existing_media_preserved(self):
        root = Path(__file__).resolve().parents[2]
        manifest = json.loads((root / "docs/EXERCISE_MEDIA_MANIFEST.json").read_text())
        ids = {e["id"] for e in json.loads((root / "backend/data/exercise_catalog.json").read_text())}
        grouped = validate_manifest(manifest, root / "web/public/media/exercises/everkinetic-v1", ids)
        self.assertEqual(len(grouped), 10)
        self.assertEqual(sum(map(len, grouped.values())), 29)
        self.assertEqual(grouped, json.loads((root / "backend/data/exercise_media.json").read_text()))
        self.assertEqual({m["role"] for m in grouped["lib-bench-press"]}, {"thumbnail", "position_1", "position_2"})
        self.assertEqual({m["role"] for m in grouped["lib-side-plank"]}, {"thumbnail", "pose"})
        self.assertEqual(library_media("lib-bench-press", None, []), grouped["lib-bench-press"])
        self.assertEqual(library_media("lib-bench-press", "custom-owner", []), [])
        self.assertEqual(library_media("unknown", None, []), [])
        supplied = [{"url": "https://club.example/owned.webp"}]
        self.assertIs(library_media("lib-bench-press", None, supplied), supplied)
        self.assertIs(library_media("lib-bench-press", "custom-owner", supplied), supplied)
        bad = {**manifest["assets"][0], "role": "invented"}
        with self.assertRaises(ValueError):
            validate_manifest({"version": 1, "assets": [bad]}, root / "web/public/media/exercises/everkinetic-v1", ids)

    def test_verified_bytes_rights_and_scope_required(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "exercise.webp").write_bytes(
                b"operator-supplied-test-bytes"
            )
            asset = dict(
                exercise_id="exercise",
                file="exercise.webp",
                media_type="image",
                url="https://cdn.example.com/exercise.webp",
                source="https://example.com/source",
                license_url="https://example.com/license",
                license="Owned",
                attribution="NFCFit",
                rights_holder="Owner",
                alt="Movement demonstration",
                commercial_use=True,
                redistribution=True,
                sha256=hashlib.sha256(b"operator-supplied-test-bytes").hexdigest(),
            )
            manifest = {"version": 1, "assets": [asset]}
            self.assertEqual(
                validate_manifest(manifest, directory, {"exercise"})["exercise"][0][
                    "alt"
                ],
                "Movement demonstration",
            )
            for change in [
                {"sha256": "bad"},
                {"commercial_use": False},
                {"exercise_id": "unknown"},
                {"file": "../outside.webp"},
                {"url": "http://example.com/insecure"},
                {"alt": ""},
            ]:
                with self.assertRaises((ValueError, FileNotFoundError)):
                    validate_manifest(
                        {"version": 1, "assets": [{**asset, **change}]},
                        directory,
                        {"exercise"},
                    )

    def test_private_or_credential_urls_rejected(self):
        for url in [
            "https://127.0.0.1/a",
            "https://localhost/a",
            "https://10.0.0.1/a",
            "https://user:pass@example.com/a",
            "https://host.internal/a",
            "javascript:alert(1)",
        ]:
            with self.assertRaises(ValueError):
                public_https(url)
