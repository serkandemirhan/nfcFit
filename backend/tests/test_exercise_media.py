import hashlib
import tempfile
import unittest
from pathlib import Path
from exercise_media import validate_manifest, public_https


class ExerciseMediaTests(unittest.TestCase):
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
