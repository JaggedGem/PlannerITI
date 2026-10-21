"""Exercise local APK/AAB validation without Expo access or a native toolchain."""

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from local_build_artifact import artifact_path, verify_artifact

ROOT = Path(__file__).resolve().parents[2]


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((ROOT / "eas.json").read_text())
        self.temp = tempfile.TemporaryDirectory()
        self.output = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def fixture(self, profile, entries=None):
        artifact = artifact_path(self.config, profile, self.output)
        if entries is None:
            entries = ["AndroidManifest.xml"] if artifact.suffix == ".apk" else [
                "BundleConfig.pb", "base/manifest/AndroidManifest.xml"
            ]
        with zipfile.ZipFile(artifact, "w") as archive:
            for entry in entries:
                archive.writestr(entry, "fixture")
        return artifact

    def test_apk_and_aab_are_verified_with_exact_file_checksums_and_commit(self):
        for profile, extension in [("development", ".apk"), ("production", ".aab")]:
            with self.subTest(profile=profile):
                artifact = self.fixture(profile)
                data = artifact.read_bytes()
                metadata = verify_artifact(self.config, profile, self.output, "test-commit")
                self.assertEqual(artifact.suffix, extension)
                self.assertEqual(metadata["sha256"], hashlib.sha256(data).hexdigest())
                self.assertEqual(metadata["bytes"], len(data))
                self.assertEqual(metadata["gitCommitHash"], "test-commit")
                self.assertEqual(metadata["buildLocation"], "github-actions-runner")
                self.assertEqual(json.loads((self.output / "build-metadata.json").read_text()), metadata)
                self.assertEqual((self.output / "SHA256SUMS").read_text(),
                                 f"{metadata['sha256']}  {artifact.name}\n")

    def test_missing_output_cannot_publish_metadata(self):
        with self.assertRaises(ValueError):
            verify_artifact(self.config, "production", self.output)
        self.assertEqual(list(self.output.iterdir()), [])

    def test_mislabeled_and_corrupt_archives_cannot_publish_metadata(self):
        for entries in [["BundleConfig.pb"], ["AndroidManifest.xml"]]:
            self.fixture("production", entries)
            with self.assertRaises(ValueError):
                verify_artifact(self.config, "production", self.output)
        artifact_path(self.config, "production", self.output).write_bytes(b"not an archive")
        with self.assertRaises(zipfile.BadZipFile):
            verify_artifact(self.config, "production", self.output)
        self.assertFalse((self.output / "build-metadata.json").exists())

    def test_zip_crc_corruption_is_detected(self):
        artifact = self.fixture("development")
        artifact.write_bytes(artifact.read_bytes().replace(b"fixture", b"corrupt", 1))
        with self.assertRaises((ValueError, zipfile.BadZipFile)):
            verify_artifact(self.config, "development", self.output)
        self.assertFalse((self.output / "SHA256SUMS").exists())

    def test_symlink_cannot_publish_an_unrelated_file(self):
        original = self.fixture("development")
        artifact_path(self.config, "production", self.output).symlink_to(original)
        with self.assertRaises(ValueError):
            verify_artifact(self.config, "production", self.output)

    def test_unsupported_profile_and_build_type_are_rejected(self):
        with self.assertRaises(ValueError):
            artifact_path(self.config, "../../outside", self.output)
        self.config["build"]["production"]["android"]["buildType"] = "other"
        with self.assertRaises(ValueError):
            artifact_path(self.config, "production", self.output)

    def test_output_type_and_tool_versions_match_eas_profiles(self):
        self.assertEqual(artifact_path(self.config, "development", self.output).suffix, ".apk")
        self.assertEqual(artifact_path(self.config, "production", self.output).suffix, ".aab")
        node = (ROOT / ".node-version").read_text().strip()
        package_manager = json.loads((ROOT / "package.json").read_text())["packageManager"]
        for profile, environment in [("development", "development"), ("beta", "preview"),
                                     ("production", "production")]:
            build = self.config["build"][profile]
            self.assertEqual(build["node"], node)
            self.assertEqual("pnpm@" + build["pnpm"], package_manager)
            self.assertEqual(build["environment"], environment)


if __name__ == "__main__":
    unittest.main()
