#!/usr/bin/env python3
"""Download the exact completed EAS Android build, never an unrelated latest build."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

MAX_BYTES = 2 * 1024**3
RETRYABLE_CODES = {408, 429, 500, 502, 503, 504}


def build_details(results, profile, config):
    if profile not in {"development", "production"}:
        raise ValueError("Unsupported build profile")
    if not isinstance(results, list) or len(results) != 1 or not isinstance(results[0], dict):
        raise ValueError("Expected exactly one Android build in EAS JSON output")
    build = results[0]
    if not isinstance(build.get("id"), str):
        raise ValueError("Missing EAS build ID")
    build_id = str(uuid.UUID(build["id"]))
    if build.get("platform") != "ANDROID" or build.get("buildProfile") != profile:
        raise ValueError("EAS returned a different platform or build profile")
    if build.get("status") != "FINISHED":
        raise ValueError("The EAS build did not finish successfully")
    build_type = config["build"][profile]["android"]["buildType"]
    if build_type not in {"apk", "app-bundle"}:
        raise ValueError("Unsupported Android artifact type in eas.json")
    extension = "apk" if build_type == "apk" else "aab"
    url = (build.get("artifacts") or {}).get("applicationArchiveUrl")
    require_https(url)
    return build, build_id, extension, url


def require_https(url):
    if not isinstance(url, str):
        raise ValueError("Missing HTTPS artifact URL")
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("EAS artifact URL must use HTTPS without embedded credentials")


def verify_archive(path, extension):
    with zipfile.ZipFile(path) as archive:
        entries = set(archive.namelist())
    expected = {"AndroidManifest.xml"} if extension == "apk" else {
        "BundleConfig.pb", "base/manifest/AndroidManifest.xml"
    }
    if not expected.issubset(entries):
        raise ValueError(f"Downloaded archive is not the expected Android {extension.upper()}")


def download(url, destination, extension, opener=urllib.request.urlopen, sleep=time.sleep):
    require_https(url)
    partial = destination.with_suffix(destination.suffix + ".partial")
    for attempt in range(3):
        try:
            digest = hashlib.sha256()
            size = 0
            # No Expo token is sent to the download host. EAS provides a signed HTTPS URL.
            with opener(url, timeout=60) as response, partial.open("wb") as output:
                require_https(response.geturl())
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise ValueError("Artifact exceeds the 2 GiB download limit")
                    digest.update(chunk)
                    output.write(chunk)
            verify_archive(partial, extension)
            partial.replace(destination)
            return digest.hexdigest(), size
        except (urllib.error.URLError, TimeoutError) as error:
            partial.unlink(missing_ok=True)
            if isinstance(error, urllib.error.HTTPError) and error.code not in RETRYABLE_CODES:
                raise ValueError(f"Artifact download failed with HTTP {error.code}") from None
            if attempt == 2:
                raise ValueError("Artifact download failed after three attempts") from None
            sleep(2 ** (attempt + 1))
        except Exception:
            partial.unlink(missing_ok=True)
            raise


def save_artifact(results, profile, config, output_dir, opener=urllib.request.urlopen,
                  sleep=time.sleep, expected_commit=None):
    build, build_id, extension, url = build_details(results, profile, config)
    if expected_commit and build.get("gitCommitHash") != expected_commit:
        raise ValueError("EAS returned a build from a different Git revision")
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact = output_dir / f"PlannerITI-{profile}-{build_id}.{extension}"
    checksum, size = download(url, artifact, extension, opener, sleep)
    app = build.get("app") or {}
    owner = urllib.parse.quote((app.get("ownerAccount") or {}).get("name", ""), safe="")
    slug = urllib.parse.quote(app.get("slug", ""), safe="")
    build_url = f"https://expo.dev/accounts/{owner}/projects/{slug}/builds/{build_id}" if owner and slug else None
    metadata = {
        "buildId": build_id,
        "profile": profile,
        "easEnvironment": config["build"][profile]["environment"],
        "status": build["status"],
        "easBuildUrl": build_url,
        "gitCommitHash": build.get("gitCommitHash"),
        "appIdentifier": build.get("appIdentifier"),
        "nativeVersion": build.get("appVersion"),
        "nativeBuildVersion": build.get("appBuildVersion"),
        "runtimeVersion": (build.get("runtime") or {}).get("version"),
        "artifact": artifact.name,
        "sha256": checksum,
        "bytes": size,
    }
    # Do not publish signed download URLs or the raw authenticated CLI response.
    (output_dir / "build-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    (output_dir / "SHA256SUMS").write_text(f"{checksum}  {artifact.name}\n")
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--result-file", type=Path, required=True)
    parser.add_argument("--profile", choices=["development", "production"], required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("artifacts"))
    args = parser.parse_args()
    try:
        results = json.loads(args.result_file.read_text())
        config = json.loads(Path("eas.json").read_text())
        metadata = save_artifact(results, args.profile, config, args.output_dir,
                                 expected_commit=os.environ.get("GITHUB_SHA"))
        print(f"Verified {metadata['artifact']} ({metadata['bytes']} bytes)")
        if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(summary, "a") as output:
                output.write(f"## Android {args.profile} build\n\n")
                output.write(f"Build ID: `{metadata['buildId']}`\n\n")
                if metadata["easBuildUrl"]:
                    output.write(f"[EAS build and logs]({metadata['easBuildUrl']})\n\n")
                output.write(f"Artifact: `{metadata['artifact']}`\n\nSHA-256: `{metadata['sha256']}`\n")
    except (KeyError, TypeError, ValueError, OSError, zipfile.BadZipFile):
        # Exceptions can contain a signed URL; keep logs free of the raw response/URL.
        print("Artifact validation/download failed. Check EAS status, profile and archive availability.", file=sys.stderr)
        return 1
    finally:
        if args.result_file.exists():
            args.result_file.unlink()
    return 0


if __name__ == "__main__":
    sys.exit(main())
