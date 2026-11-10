"""Offline validation for operator-supplied, licensed exercise assets.

This module never fetches URLs or uploads files. Deployment of the verified bytes
and confirmation of commercial rights remain the operator's responsibility.
"""

import hashlib
import ipaddress
from pathlib import Path
from urllib.parse import urlsplit


def public_https(value):
    url = urlsplit(value)
    if (
        url.scheme != "https"
        or not url.hostname
        or url.username
        or url.password
        or url.fragment
    ):
        raise ValueError(
            "Media and provenance URLs must use HTTPS without credentials or fragments."
        )
    hostname = url.hostname.lower()
    if (
        hostname == "localhost"
        or hostname.endswith((".local", ".localhost", ".internal"))
        or "." not in hostname
    ):
        raise ValueError("Public HTTPS hostname required.")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        if not address.is_global:
            raise ValueError("Private addresses are not allowed.")
    return value


def validate_manifest(manifest, asset_root, exercise_ids):
    root = Path(asset_root).resolve(strict=True)
    if manifest.get("version") != 1 or not isinstance(manifest.get("assets"), list):
        raise ValueError("Expected a version 1 media manifest with assets.")
    grouped, seen = {}, set()
    extensions = {
        "image": {".png", ".jpg", ".jpeg", ".webp"},
        "animation": {".gif", ".webp"},
        "video": {".mp4", ".webm"},
        "model3d": {".glb"},
    }
    for asset in manifest["assets"]:
        exercise_id = asset["exercise_id"]
        if exercise_id not in exercise_ids:
            raise ValueError("Unknown exercise: " + exercise_id)
        kind = asset["media_type"]
        if kind not in extensions:
            raise ValueError("Unsupported media type.")
        relative = Path(asset["file"])
        file = (root / relative).resolve(strict=True)
        if (
            relative.is_absolute()
            or not file.is_relative_to(root)
            or not file.is_file()
            or file.suffix.lower() not in extensions[kind]
        ):
            raise ValueError("Asset must be a supported file inside the asset root.")
        if not 0 < file.stat().st_size <= 100 * 1024 * 1024:
            raise ValueError("Asset must be between 1 byte and 100 MB.")
        sha = hashlib.sha256(file.read_bytes()).hexdigest()
        if sha != asset["sha256"]:
            raise ValueError("Asset checksum mismatch: " + relative.as_posix())
        for field in ("license", "attribution", "rights_holder", "alt"):
            if not isinstance(asset.get(field), str) or not asset[field].strip():
                raise ValueError("Missing rights/accessibility field: " + field)
        if (
            asset.get("commercial_use") is not True
            or asset.get("redistribution") is not True
        ):
            raise ValueError(
                "Commercial use and redistribution rights must be explicitly confirmed."
            )
        url = public_https(asset["url"])
        if (exercise_id, url) in seen:
            raise ValueError("Duplicate exercise asset.")
        seen.add((exercise_id, url))
        item = {
            k: asset[k]
            for k in (
                "media_type",
                "url",
                "license",
                "attribution",
                "rights_holder",
                "alt",
                "sha256",
            )
        }
        item["source"] = public_https(asset["source"])
        item["license_url"] = public_https(asset["license_url"])
        grouped.setdefault(exercise_id, []).append(item)
    return grouped
