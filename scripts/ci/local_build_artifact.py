#!/usr/bin/env python3
"""Validate the locally compiled Android artifact and publish safe build metadata."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import zipfile


def artifact_path(config, profile, output_dir):
    if profile not in {"development", "production"}:
        raise ValueError("Unsupported build profile")
    build_type = config["build"][profile]["android"]["buildType"]
    extensions = {"apk": "apk", "app-bundle": "aab"}
    if build_type not in extensions:
        raise ValueError("Unsupported Android buildType in eas.json")
    return output_dir / f"PlannerITI-{profile}.{extensions[build_type]}"


def verify_artifact(config, profile, output_dir, commit=None):
    artifact = artifact_path(config, profile, output_dir)
    if artifact.is_symlink() or not artifact.is_file():
        raise ValueError("Local build did not produce the expected regular artifact file")
    expected = {"AndroidManifest.xml"} if artifact.suffix == ".apk" else {
        "BundleConfig.pb", "base/manifest/AndroidManifest.xml"
    }
    with zipfile.ZipFile(artifact) as archive:
        if not expected.issubset(archive.namelist()):
            raise ValueError("Local artifact does not match the profile's Android buildType")
        if archive.testzip() is not None:
            raise ValueError("Local artifact failed ZIP integrity verification")
    with artifact.open("rb") as stream:
        checksum = hashlib.file_digest(stream, "sha256").hexdigest()
    metadata = {
        "buildLocation": "github-actions-runner",
        "profile": profile,
        "easEnvironment": config["build"][profile]["environment"],
        "gitCommitHash": commit,
        "artifact": artifact.name,
        "sha256": checksum,
        "bytes": artifact.stat().st_size,
    }
    # Do not serialize the environment, signing credentials, or resolved Expo config.
    (output_dir / "build-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    (output_dir / "SHA256SUMS").write_text(f"{checksum}  {artifact.name}\n")
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=["development", "production"], required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("artifacts"))
    parser.add_argument("--prepare", action="store_true", help="Only create the output directory and step output")
    args = parser.parse_args()
    try:
        config = json.loads(Path("eas.json").read_text())
        if args.prepare:
            artifact = artifact_path(config, args.profile, args.output_dir).resolve()
            artifact.parent.mkdir(parents=True, exist_ok=True)
            if artifact.exists():
                raise ValueError("Artifact destination already exists; refusing to reuse a stale build")
            with open(os.environ["GITHUB_OUTPUT"], "a") as output:
                output.write(f"artifact-path={artifact}\n")
        else:
            metadata = verify_artifact(config, args.profile, args.output_dir, os.environ.get("GITHUB_SHA"))
            print(f"Verified {metadata['artifact']} ({metadata['bytes']} bytes)")
            if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
                with open(summary, "a") as output:
                    output.write(f"## Android {args.profile} build\n\nCompiled on the GitHub runner.\n\n")
                    output.write(f"Artifact: `{metadata['artifact']}`\n\nSHA-256: `{metadata['sha256']}`\n")
    except (KeyError, TypeError, ValueError, OSError, zipfile.BadZipFile) as error:
        print(f"Local artifact preparation/verification failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
