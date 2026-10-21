"""Exercise real archive verification and download failures without EAS credentials."""

import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock
import urllib.error
import zipfile

from download_eas_build import build_details, save_artifact

ROOT = Path(__file__).resolve().parents[2]
BUILD_ID = "b0163bc5-c2df-4ab8-b8aa-1e4a28d2c9d3"
SIGNED_URL = "https://example.invalid/build?signature=private"


def result(profile="development", **overrides):
    build = {
        "id": BUILD_ID,
        "status": "FINISHED",
        "platform": "ANDROID",
        "buildProfile": profile,
        "artifacts": {"applicationArchiveUrl": SIGNED_URL},
        "app": {"slug": "PlannerITI", "ownerAccount": {"name": "planneriti"}},
        "appVersion": "1.6.0",
        "appBuildVersion": "43",
        "runtime": {"version": "test-runtime"},
        "gitCommitHash": "test-commit",
    }
    return [{**build, **overrides}]


def response(extension):
    content = io.BytesIO()
    with zipfile.ZipFile(content, "w") as archive:
        entries = ["AndroidManifest.xml"] if extension == "apk" else [
            "BundleConfig.pb", "base/manifest/AndroidManifest.xml"
        ]
        for entry in entries:
            archive.writestr(entry, "fixture")
    data = content.getvalue()
    stream = io.BytesIO(data)
    stream.geturl = lambda: SIGNED_URL
    return stream, data


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((ROOT / "eas.json").read_text())
        self.temp = tempfile.TemporaryDirectory()
        self.output = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def test_real_apk_and_aab_archives_are_verified_and_checksummed(self):
        for profile, extension in [("development", "apk"), ("production", "aab")]:
            with self.subTest(profile=profile):
                stream, data = response(extension)
                opener = Mock(return_value=stream)
                metadata = save_artifact(result(profile), profile, self.config, self.output, opener)
                archive = self.output / metadata["artifact"]
                self.assertEqual(archive.suffix, "." + extension)
                self.assertEqual(archive.read_bytes(), data)
                self.assertEqual(metadata["sha256"], hashlib.sha256(data).hexdigest())
                saved = (self.output / "build-metadata.json").read_text()
                self.assertNotIn("signature", saved)
                self.assertNotIn("applicationArchiveUrl", saved)
                self.assertIn(metadata["sha256"], (self.output / "SHA256SUMS").read_text())
                opener.assert_called_once_with(SIGNED_URL, timeout=60)

    def test_failed_canceled_incomplete_and_wrong_builds_are_rejected(self):
        for override in [
            {"status": "ERRORED"}, {"status": "CANCELED"}, {"status": "IN_PROGRESS"},
            {"platform": "IOS"}, {"buildProfile": "production"}, {"id": "../outside"},
            {"artifacts": {}}, {"artifacts": {"applicationArchiveUrl": "http://invalid/build"}},
        ]:
            with self.subTest(override=override), self.assertRaises((ValueError, KeyError)):
                build_details(result(**override), "development", self.config)

    def test_no_builds_multiple_builds_or_unsupported_profiles_are_rejected(self):
        for builds, profile in [([], "development"), (result() * 2, "development"),
                                ({}, "development"), (result(), "beta")]:
            with self.subTest(profile=profile), self.assertRaises(ValueError):
                build_details(builds, profile, self.config)

    def test_aab_cannot_be_mislabeled_as_apk(self):
        stream, _ = response("aab")
        with self.assertRaises(ValueError):
            save_artifact(result(), "development", self.config, self.output, Mock(return_value=stream))
        self.assertEqual(list(self.output.iterdir()), [])

    def test_corrupt_download_is_rejected_without_leaving_partial_artifacts(self):
        stream = io.BytesIO(b"not a zip")
        stream.geturl = lambda: SIGNED_URL
        with self.assertRaises(zipfile.BadZipFile):
            save_artifact(result(), "development", self.config, self.output, Mock(return_value=stream))
        self.assertEqual(list(self.output.iterdir()), [])

    def test_transient_download_failure_is_retried_without_resubmitting_build(self):
        stream, _ = response("apk")
        opener = Mock(side_effect=[urllib.error.URLError("network failure"), stream])
        sleep = Mock()
        save_artifact(result(), "development", self.config, self.output, opener, sleep)
        self.assertEqual(opener.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_permanent_download_failure_has_bounded_attempts(self):
        opener = Mock(side_effect=urllib.error.URLError("network failure"))
        with self.assertRaisesRegex(ValueError, "three attempts"):
            save_artifact(result(), "development", self.config, self.output, opener, Mock())
        self.assertEqual(opener.call_count, 3)
        self.assertEqual(list(self.output.iterdir()), [])

    def test_expired_or_unauthorized_url_is_not_retried(self):
        error = urllib.error.HTTPError(SIGNED_URL, 403, "Forbidden", {}, None)
        opener = Mock(side_effect=error)
        with self.assertRaisesRegex(ValueError, "HTTP 403"):
            save_artifact(result(), "development", self.config, self.output, opener, Mock())
        self.assertEqual(opener.call_count, 1)

    def test_insecure_redirect_is_rejected(self):
        stream, _ = response("apk")
        stream.geturl = lambda: "http://example.invalid/build"
        with self.assertRaises(ValueError):
            save_artifact(result(), "development", self.config, self.output, Mock(return_value=stream))
        self.assertEqual(list(self.output.iterdir()), [])

    def test_oversized_download_is_rejected_and_partial_file_removed(self):
        from unittest.mock import patch
        stream, _ = response("apk")
        with patch("download_eas_build.MAX_BYTES", 1), self.assertRaisesRegex(ValueError, "2 GiB"):
            save_artifact(result(), "development", self.config, self.output, Mock(return_value=stream))
        self.assertEqual(list(self.output.iterdir()), [])

    def test_build_from_another_commit_is_rejected_before_download(self):
        opener = Mock()
        with self.assertRaisesRegex(ValueError, "different Git revision"):
            save_artifact(result(), "development", self.config, self.output, opener,
                          expected_commit="expected-commit")
        opener.assert_not_called()

    def test_tooling_versions_and_eas_environments_match_repository_configuration(self):
        node = (ROOT / ".node-version").read_text().strip()
        package_manager = json.loads((ROOT / "package.json").read_text())["packageManager"]
        for profile, environment in [("development", "development"), ("beta", "preview"),
                                     ("production", "production")]:
            build = self.config["build"][profile]
            self.assertEqual(build["node"], node)
            self.assertEqual("pnpm@" + build["pnpm"], package_manager)
            self.assertEqual(build["environment"], environment)
        self.assertEqual(self.config["build"]["development"]["android"]["buildType"], "apk")
        self.assertEqual(self.config["build"]["production"]["android"]["buildType"], "app-bundle")


if __name__ == "__main__":
    unittest.main()
