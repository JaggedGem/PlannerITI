# Manual Android builds from GitHub Actions

The **Android EAS Build** workflow (`.github/workflows/eas-build.yml`) runs only when manually dispatched. Choose `development` or `production` and a branch/tag. Quality checks run first; a separate job then uploads the selected revision to **EAS cloud Build**, waits for the actual build to finish, downloads that exact build, and publishes it as a GitHub Actions artifact.

This uses Expo's [official CI approach](https://docs.expo.dev/build/building-on-ci/). It does not use `eas build --local`, GitHub's Android SDK, or a GitHub-built signing keystore.

## What each selection builds

| Workflow selection | EAS profile/environment       | Package                      | Output | Intended use                                        |
| ------------------ | ----------------------------- | ---------------------------- | ------ | --------------------------------------------------- |
| `development`      | `development` / `development` | `site.jagged.planneriti.dev` | `.apk` | Installable Expo development client; use with Metro |
| `production`       | `production` / `production`   | `site.jagged.planneriti`     | `.aab` | Google Play Internal Testing or production release  |

Development's previous `app-bundle` setting was changed to `apk`. Beta remains its existing separate profile/package and is not offered by this workflow. Production builds still use EAS remote version management and `autoIncrement`, so each build can consume a new Android version code, including builds later discarded. Building production does not submit or publish to Google Play.

## Versions and checks

- Node **24.19.0**: `.node-version` on GitHub and the `node` fields in EAS profiles.
- pnpm **11.1.2**: `packageManager` in `package.json`, read by the pnpm setup action, and EAS profiles.
- EAS CLI **25.3.0**: installed by the official Expo action and required in `eas.json`.
- GitHub runner: **ubuntu-24.04**, including its Python 3.12 runtime for artifact validation.
- Actions are pinned to reviewed commit SHAs: checkout 6.0.2, setup-node 6.3.0, pnpm setup 5.0.0, Expo action v9, upload-artifact 6.0.0. Update the pinned action SHA and its version comment together.
- The EAS worker image remains SDK-selected (`auto`), so EAS selects the native toolchain for Expo SDK 58. The workflow does not guess an Android SDK/NDK installation on GitHub.

The reusable `CI` workflow performs frozen-lockfile dependency installation, repository formatting, lint, TypeScript checks, Jest tests, and Python artifact/configuration regression tests. It runs without Expo credentials. The build job repeats the frozen installation on its own clean runner and only exposes `EXPO_TOKEN` to its token-check and EAS-build steps. It never gives that token to project installation or the artifact downloader.

The CLI runs with `--platform android --non-interactive --wait --json --freeze-credentials`. It cannot silently prompt for/create missing credentials. A successful queue submission is not considered a successful run: the cloud build must finish successfully, and its artifact must validate and upload.

## One-time setup: complete these steps

### 1. Make the workflow available on the default branch

GitHub requires a `workflow_dispatch` workflow to exist on the repository's **default branch** before it is available for manual triggering. This implementation is committed to `feature/google-play-in-app-updates`, as requested. Merge the reviewed changes to the default branch before expecting the **Run workflow** button to appear. The workflow calls the reusable `ci.yml`, so include that file and the helper/config changes too.

After registration on the default branch, you can select `feature/google-play-in-app-updates`, or another trusted branch/tag containing these files, when dispatching. GitHub checks out the selected revision in both quality and build jobs. Merely pushing a workflow to a new feature branch may not register it for manual dispatch; `gh workflow run --ref` does not remove this default-branch requirement.

In repository **Settings → Actions → General**, enable GitHub Actions and allow the pinned `actions/*`, `pnpm/action-setup`, and `expo/expo-github-action` actions if your organization uses an allowlist. The workflow needs only `contents: read` for `GITHUB_TOKEN`; no repository-write or OIDC permission is required. Ensure the artifact-retention policy permits 14 days, or lower `retention-days` in the workflow to your allowed limit.

### 2. Finish interactive EAS setup for both packages

On your computer, check out this branch/change, install Node 24.19.0, then run:

```sh
npm install --global pnpm@11.1.2 eas-cli@25.3.0
pnpm install --frozen-lockfile
eas login
eas whoami
pnpm run build:dev
pnpm run build
```

These commands start real EAS cloud builds. Run them once for any profile that has not already built successfully, allowing EAS to complete project/credentials/version setup interactively. If both profiles already have valid credentials, you do not need to repeat successful bootstrap builds just for CI.

Confirm you are building the existing project **PlannerITI** under Expo account/organization **planneriti**, project ID `fe01b043-f283-48db-a683-3c5f23546a96`. Production and development have different package names and can need separate credential setup. Use the existing production upload keystore for the existing Google Play listing; do not replace that signing identity. EAS-managed remote credentials are the default; this workflow does not upload keystores to GitHub.

Confirm the production remote Android version counter is initialized and higher than previously uploaded Play builds. A prior successful interactive production build normally establishes it. If adjustment is needed, use `eas build:version:set --platform android --profile production` interactively. CI's automatic increments cannot fix an incorrectly initialized counter below the Play listing's version history.

### 3. Configure the EAS environments

In the Expo dashboard, open the project and its environment variables. Configure **development** and **production** separately. These are EAS environments, not GitHub environments, EAS channels, or Play testing tracks.

The build profiles explicitly select the EAS environment. `eas.json` already supplies the following build configuration:

| Variable                | Development profile          | Production profile       |
| ----------------------- | ---------------------------- | ------------------------ |
| `APP_VARIANT`           | `development`                | `production`             |
| `ANDROID_PACKAGE`       | `site.jagged.planneriti.dev` | `site.jagged.planneriti` |
| `IOS_BUNDLE_IDENTIFIER` | `site.jagged.planneriti.dev` | `site.jagged.planneriti` |
| `RUNTIME_VERSION`       | `1.6.0-dev.2`                | `1.6.0-native-updates.1` |

Build-profile `env` values take precedence over local `.env` and duplicate server values. To change a build runtime, edit the selected profile's committed `RUNTIME_VERSION`. Keep the corresponding EAS environment value aligned for OTA publishing, because `eas update` does not read the build profile's `env` block. Use the values from your selected revision if you subsequently advance the runtime.

Also configure:

| Variable             | Setup and visibility                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_KEY`            | The app's real API key for that environment. Use **Sensitive** when the same variable is needed for config resolution and OTA publishing. It is embedded in `expo.extra.apiKey`, so treat it as a client-readable value, not a backend credential. |
| `RELEASE_VERSION`    | Desired displayed app version, such as `1.6.1`. **Plain text** or **Sensitive**; it is intentionally visible in the app. Set it in each EAS environment where needed.                                                                              |
| `CUSTOM_API_LOCAL_*` | Normally leave unset for cloud production builds. Use a deliberate reachable endpoint only when testing against a custom server. A developer computer's LAN address is not reachable by general testers.                                           |

`GRAVATAR_API_KEY` is not read by the current code and is not required by this workflow. The production Play-update check needs no extra Play API key. `BETA_PLAY_UPDATES_ENABLED` is unrelated to the two offered profiles.

Your ignored local `.env` is not included in GitHub's checkout or the EAS upload. Do not commit it. Application variables belong in EAS; you do not need to duplicate them as GitHub secrets for this cloud-build workflow.

**Secret visibility:** EAS variables marked **Secret** work on the remote EAS build worker, including build-only/file secrets, because this is a normal cloud build. They are not readable on GitHub for EAS CLI's local configuration-resolution phase, and they are unavailable to `eas update`. Therefore do not make package IDs, runtime/profile selectors, or variables needed for OTA config/export Secret. If a value is exclusively used by native build steps on EAS, Secret is appropriate. For example, a secret file can be available to a native EAS build, but its contents/path cannot be assumed to exist on GitHub before upload. A truly confidential server credential must not be embedded in `expo.extra` or client JavaScript.

See [EAS environment usage and visibility](https://docs.expo.dev/eas/environment-variables/usage/).

### 4. Create the Expo access token

In Expo account settings, open **Access tokens** ([official token instructions](https://docs.expo.dev/accounts/programmatic-access/#personal-access-tokens)) and create a token for a user/automation account with permission to build the existing `planneriti/PlannerITI` project and use its remote credentials. A robot account is an option if available to your organization. The token is an Expo credential, not a GitHub token or a Google Play service-account key.

Copy it once. Do not put it in `.env.example`, `app.config.js`, `eas.json`, repository variables, or workflow YAML. Revoke/rotate it through Expo when necessary.

### 5. Add GitHub environments and the `EXPO_TOKEN` secret

In the GitHub repository's **Settings → Environments**, create:

- `development`
- `production`

These GitHub environments control which token/protection rules the build job receives. They do not supply application variables to EAS automatically. Where your GitHub plan supports it, optionally restrict production branches and require a reviewer. If testing the feature branch, ensure the environment's deployment-branch rules permit it; a disallowed branch cannot run the build job.

Add an environment **secret** named **`EXPO_TOKEN`** to each environment, with the Expo token from step 4. You can instead add one repository Actions secret named `EXPO_TOKEN` under **Settings → Secrets and variables → Actions** for both builds; a same-named environment secret takes precedence. If your organization supplies the secret, grant this repository access. The name must be `EXPO_TOKEN`, not an Actions variable.

No Google Play service-account key, Android keystore GitHub secret, Apple credential, or extra GitHub token is required to **build and download** these Android artifacts. Those would be separate concerns for a future store-submission workflow. Only dispatch trusted code: a selected workflow revision with access to a build token is trusted executable code.

### 6. Trigger a build and download it

1. Open **Actions → Android EAS Build → Run workflow**.
2. Select the branch/tag containing the revision you want to build.
3. Choose `development` for an APK or `production` for an AAB. These profile choices also select the matching EAS and GitHub environments.
4. Leave **Clear the EAS build cache** off normally; enable it for deliberate cache troubleshooting. It does not change package/runtime/version settings.
5. Run the workflow. Quality checks must pass before the build job starts. Complete any GitHub environment approval you configured.
6. Watch the build step's EAS dashboard link for cloud logs/queue progress. It waits for completion rather than stopping at queue submission.
7. On success, use the download link in the workflow summary, or the run's **Artifacts** section. The artifact is named `PlannerITI-android-<profile>-<run-id>-<attempt>`.
8. Unzip the GitHub artifact. It contains the `.apk` or `.aab`, `SHA256SUMS`, and `build-metadata.json` (EAS build ID/link, source commit, runtime/native version, file hash/size). Checksums refer to the extracted app file, not GitHub's outer ZIP. On Linux run `sha256sum --check SHA256SUMS`; on PowerShell use `Get-FileHash .\PlannerITI-...apk -Algorithm SHA256` and compare the result with `SHA256SUMS`.

You can also dispatch with GitHub CLI, after the default-branch registration in step 1:

```sh
gh workflow run eas-build.yml --ref feature/google-play-in-app-updates -f profile=development
gh workflow run eas-build.yml --ref feature/google-play-in-app-updates -f profile=production
```

Install the development APK on a test device and run `pnpm dev` for its Metro server. This is a development client, not a standalone production app; its Google Play update flows are intentionally disabled. The production AAB must go through Play (Internal Testing is fine) to validate real Play updates. The workflow does not submit it or make a release live.

## Failure behavior, cost, and limitations

- **Checks are mandatory:** a failed format/lint/typecheck/test job prevents EAS submission. Existing lint warnings remain nonfatal; errors fail.
- **Cloud credentials/secrets remain available:** unlike local native builds, the remote EAS worker gets its EAS environment and managed credentials. The CLI/GitHub side still cannot read EAS Secret values, as described above.
- **There are two resource budgets:** EAS cloud quotas/credits/queue limits apply as usual. GitHub Actions minutes are also consumed while `--wait` runs. This tradeoff is necessary for this single run to return the finished artifact; fire-and-forget submission alone would not do that.
- **Bounded execution:** the build step waits up to 210 minutes; download up to 15; the build job up to 240. Long EAS queues can exceed this. A canceled/timed-out GitHub run may leave the remote EAS build running; cancel it in Expo's dashboard or retrieve the completed build there. Do not assume canceling GitHub refunded/canceled the EAS build. A rerun submits a new build and can increment the production version code again.
- **Concurrency:** builds of the same profile are serialized across branches, with no automatic cancellation of the running one. Development and production can run independently. GitHub concurrency normally retains only one pending run per group; another dispatch can replace an older pending run. Manual builds outside this workflow are not serialized by GitHub.
- **Artifact checks:** only the one completed Android build returned by this invocation is accepted, with matching profile and Git revision. The downloader requires HTTPS, validates APK/AAB ZIP entries, computes SHA-256, retries transient downloads at most three times, rejects corrupt/mismatched files, and limits downloads to 2 GiB. It never sends the Expo token to the artifact host. Signed URLs/raw EAS JSON are not uploaded as artifacts.
- **Retention:** GitHub artifacts request 14 days of retention. This value must fit your organization/repository policy; lower it if the allowed maximum is shorter. Artifact storage quotas also apply. The EAS copy follows Expo's retention/access rules. An application key embedded in an app remains recoverable from its binary, regardless of EAS/GitHub variable visibility.
- **Scope:** this workflow builds Android only. It does not publish OTA updates, submit to stores, validate Play eligibility on a physical device, or promise that a successful build passes runtime testing. Existing `pnpm run update`/`update:ios` and iOS build commands remain separate.

## Validation of this implementation

Workflow syntax and expressions were checked with actionlint 1.7.11. Python tests exercise APK/AAB validation, failed/wrong builds, wrong commits, missing/unsafe URLs, corrupt downloads, retries, checksum generation, and the pinned tooling/profile configuration. Existing formatting, lint, TypeScript and Jest checks are run as well. No real EAS build or authenticated GitHub Actions run was launched from the development environment: the Expo token and GitHub environment setup are intentionally left for the repository owner above.
