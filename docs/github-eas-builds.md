# Manual Android builds on the GitHub runner

The **Android Runner Build** workflow (`.github/workflows/eas-build.yml`) compiles Android **on the GitHub Actions runner** using `eas build --local`. Select a branch/tag and a development or production profile. Quality checks run first, then Ubuntu runs prebuild, Metro, Gradle, native compilation, and signing. The completed app is uploaded directly from the runner to GitHub Actions artifacts.

**No EAS cloud build is submitted.** There is no EAS build queue, cloud build worker, or cloud build credit consumption. The EAS CLI still authenticates with Expo, reads the linked project's configuration/environment, downloads existing managed signing credentials, and uses the existing remote version counter and update channels. Those Expo services still require network access; this is not an offline or Expo-independent build.

References: Expo's [local build documentation](https://docs.expo.dev/build-reference/local-builds/), [CI authentication guide](https://docs.expo.dev/build/building-on-ci/), and [environment-variable documentation](https://docs.expo.dev/eas/environment-variables/usage/).

## Profile selection

| Workflow selection | EAS profile/environment       | Package                      | Output | Use                                                 |
| ------------------ | ----------------------------- | ---------------------------- | ------ | --------------------------------------------------- |
| `development`      | `development` / `development` | `site.jagged.planneriti.dev` | `.apk` | Installable Expo development client; use with Metro |
| `production`       | `production` / `production`   | `site.jagged.planneriti`     | `.aab` | Upload to Google Play, including Internal Testing   |

The profile dropdown also selects the matching **GitHub environment**. Output format comes from `android.buildType` in `eas.json`. Beta retains its separate configuration but is not offered by this workflow. Production builds use the existing `autoIncrement` and remote version counter. A failed, canceled, or discarded build can consume a version code; that is harmless, but rerunning is a new build. Creating an AAB does not publish or submit it to Google Play.

## One-time setup

### 1. Enable the workflow and GitHub Actions

GitHub requires a `workflow_dispatch` workflow to exist on the repository's **default branch** before manual dispatch is available. The release merges the workflow, reusable `ci.yml`, scripts, and configuration into `main`. Choose `main` for the production release, or another trusted revision in **Run workflow**. `gh workflow run --ref` does not bypass the registration requirement.

In **Settings → Actions → General**, enable Actions. If using an action allowlist, allow `actions/checkout`, `actions/setup-node`, `actions/setup-java`, `actions/upload-artifact`, `pnpm/action-setup`, `android-actions/setup-android`, and `expo/expo-github-action`. All are pinned to commit SHAs. The workflow requires only `contents: read` from GitHub's automatic token; no repository-write permission, OIDC setup, or extra GitHub token is needed.

Allow 14 days of artifact retention, or lower `retention-days` in the workflow if your policy requires it. Ensure GitHub Actions minutes and artifact storage are available for the repository. Standard hosted Ubuntu runners are used; a self-hosted runner is not required.

### 2. Prepare existing Expo signing credentials and version counters

On your computer, install Node **24.19.0**, pnpm **11.1.2**, and EAS CLI **25.3.0**, then authenticate:

```sh
npm install --global pnpm@11.1.2 eas-cli@25.3.0
pnpm install --frozen-lockfile
eas login
eas whoami
eas credentials --platform android
```

In the credentials menu, select each profile (`development`, then `production`) and ensure its Android keystore is configured in EAS. This is credential administration; **you do not need to start a cloud build**. If the credentials already exist, reuse them. For the existing Play listing, preserve the existing production upload keystore and alias; generating an unrelated replacement would prevent Play from accepting the upload. Development's separate package can have its own credentials.

Confirm the linked Expo project is **planneriti/PlannerITI**, ID `fe01b043-f283-48db-a683-3c5f23546a96`. The current profiles use remote credentials by default. The local build downloads those credentials to sign on the GitHub runner; you do not need keystore/password GitHub secrets. Do not change `credentialsSource` to `local` without also implementing a secure `credentials.json`/keystore restoration step.

Check the production remote version counter against your Play Console version-code history. If initialization or correction is needed, run interactively:

```sh
eas build:version:set --platform android --profile production
```

Set an appropriate current version so the next increment exceeds previously uploaded Play builds. CI uses `--non-interactive --freeze-credentials`: missing credentials must be prepared beforehand; CI will not prompt to create or replace them. No Play service-account key or Apple credentials are needed for this Android build-only workflow.

### 3. Create an Expo token

In [Expo account settings → Access tokens](https://docs.expo.dev/accounts/programmatic-access/#personal-access-tokens), create a token for an account with access to the existing project, its managed signing credentials, and remote version management. Copy the token for the GitHub secret in the next step. It is an **Expo token**, not a GitHub or Google Play token.

Keep it out of repository files and Actions variables. Rotate or revoke it in Expo when necessary.

### 4. Create GitHub environments and configure secrets/variables

Open **Settings → Environments** and create **`development`** and **`production`**. In each environment, add:

| Kind     | Name              | Value                                                                                                                                                               |
| -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret   | `EXPO_TOKEN`      | The Expo access token from step 3.                                                                                                                                  |
| Secret   | `API_KEY`         | The API key used by the app for that environment. Required: CI fails early if absent.                                                                               |
| Variable | `RELEASE_VERSION` | Optional displayed version, for example `1.6.1`. If omitted, EAS-readable configuration or the app's `1.6.1` fallback applies. It does not change the native build. |

You can use a repository secret for `EXPO_TOKEN` if both environments use the same Expo identity. A same-named environment secret takes precedence. Keep `API_KEY` environment-specific if development and production use different keys. Organization secrets must explicitly grant this repository access.

Optional CLI setup (secret commands prompt for the value; do not put token/key values in shell history):

```sh
gh secret set EXPO_TOKEN --env development
gh secret set EXPO_TOKEN --env production
gh secret set API_KEY --env development
gh secret set API_KEY --env production
gh variable set RELEASE_VERSION --env development --body '1.6.1'
gh variable set RELEASE_VERSION --env production --body '1.6.1'
```

Where your GitHub plan supports it, configure production environment reviewers and permitted branches. Permit the feature branch if you want to test it. Only dispatch trusted code: the selected revision executes with the build credentials. Secrets are scoped to the validation/build steps; the quality job and dependency-install step receive no Expo/API secrets.

The app embeds `API_KEY` in `expo.extra.apiKey`, so its value is recoverable from the installed app. GitHub secret storage prevents accidental configuration disclosure; it does not turn an embedded client key into a confidential server credential. Play update detection needs no additional Play API key.

### 5. Align EAS variables, runtime versions, and any extra build secrets

The GitHub checkout has **none of your ignored local `.env` files**. Do not commit them. These public profile values already come from the selected revision's `eas.json`:

| Variable                | Development                  | Production               |
| ----------------------- | ---------------------------- | ------------------------ |
| `APP_VARIANT`           | `development`                | `production`             |
| `ANDROID_PACKAGE`       | `site.jagged.planneriti.dev` | `site.jagged.planneriti` |
| `IOS_BUNDLE_IDENTIFIER` | `site.jagged.planneriti.dev` | `site.jagged.planneriti` |
| `RUNTIME_VERSION`       | `1.6.1-dev.1`                | `1.6.1`                  |

To change a native runtime, edit the selected profile's committed `RUNTIME_VERSION`. Editing only a local `.env` will not change the profile value. In Expo's environment settings, also add `RUNTIME_VERSION` with **Plain text** visibility to each matching EAS environment (`development`, `preview` for beta, and `production`), using the same value as its build profile. This supplies the runtime for OTA publishing: `eas update` selects an environment but does not read the build profile's `env` block. Keep `RELEASE_VERSION` aligned in the EAS environment when you want the same displayed version in OTA updates.

**EAS Secret visibility is unavailable to local builds.** For every additional EAS variable marked **Secret** that a native plugin/build hook needs, add a GitHub environment secret and explicitly map it under the workflow's **Compile locally** step `env`. Merely creating a GitHub secret does not export it to the process. `API_KEY` is already mapped. For a secret file, store its encoded contents as a GitHub secret, restore it to a file under `$RUNNER_TEMP` in a dedicated step, pass the file path to the compile step, and delete it in the `always()` cleanup step. Never upload that file or the entire build workspace. This app currently needs no such extra file.

EAS **Plain text** and **Sensitive** variables can still be fetched by the CLI from the profile's EAS environment. Build-profile `env` takes precedence over duplicate EAS values. For values duplicated between GitHub and EAS (especially `API_KEY` and `RELEASE_VERSION`), **keep the copies identical**: config resolution and the local worker merge environments at different stages, so do not rely on GitHub overriding a same-named EAS value. If an EAS Secret is also needed by OTA publishing, use a suitable readable visibility there; `eas update` cannot read EAS Secret values either.

Leave `CUSTOM_API_LOCAL_*` unset for normal production builds. If you deliberately need them in a CI development build, explicitly map the corresponding GitHub environment variables to the compile step and use an endpoint reachable by your test devices.

### 6. Trigger the build and download the result

1. Open **Actions → Android Runner Build → Run workflow**.
2. Select the branch/tag and `development` (APK) or `production` (AAB).
3. Run the workflow and complete any environment approval you configured.
4. The quality job must pass before compilation starts. Follow native build output in **Compile locally on this GitHub runner**; there is no EAS cloud build dashboard/log URL for this build.
5. After success, click the artifact download link in the run summary or use the run's **Artifacts** section. The artifact name is `PlannerITI-android-<profile>-<run-id>-<attempt>`.
6. Extract GitHub's ZIP. It contains `PlannerITI-development.apk` or `PlannerITI-production.aab`, `SHA256SUMS`, and `build-metadata.json` with the profile, source commit, build location, file size, and SHA-256. It contains no credential/config dump. Metadata does not claim native version details that were not read from the compiled binary.
7. Verify the extracted file with `sha256sum --check SHA256SUMS` on Linux, or `Get-FileHash .\PlannerITI-production.aab -Algorithm SHA256` on PowerShell and compare it with `SHA256SUMS`.

Alternatively, after default-branch registration:

```sh
gh workflow run eas-build.yml --ref main -f profile=development
gh workflow run eas-build.yml --ref main -f profile=production
```

Install the development APK and run `pnpm dev` for Metro. It is an Expo development client and requires a development server; native Play-update checks are intentionally disabled there. Upload the production AAB to Google Play Internal Testing to test real Play update behavior. An AAB cannot be installed directly as an APK. This workflow does not publish releases or OTA updates.

## Runner toolchain and limitations

- The runner is **Ubuntu 24.04**, with Node **24.19.0** from `.node-version`, pnpm **11.1.2** from `packageManager`, EAS CLI **25.3.0**, and Temurin **Java 21**. The workflow installs Android command-line tools **23.0 / 16111833**, SDK platform **37.0**, build tools **37.0.0**, NDK **27.1.12297006**, and CMake **3.22.1** for this Expo SDK 58 / React Native 0.88 project. Update these alongside future SDK/native dependency upgrades. The SDK's platform package is named `platforms;android-37.0`.
- Local builds **ignore EAS software/image version customization**. The workflow, not an EAS worker image or `eas.json` toolchain fields, installs the tools used here. Java/SDK/NDK setup is mandatory. Your Windows computer does not need a local Android toolchain to dispatch this Linux workflow.
- EAS local build caching is unsupported, so the old **Clear EAS cache** input is removed. GitHub caches pnpm downloads only; native Gradle/EAS working directories are ephemeral and never uploaded/cached with credentials. Native compilation may take longer than a warm cloud build. Unrelated preinstalled hosted-runner SDKs are removed to free disk; native parallelism is bounded to two workers. If future dependencies exceed standard runner resources, change `runs-on` to a larger suitably provisioned runner.
- **Quality gates:** frozen dependency installation, formatting, lint, TypeScript, Jest, and Python artifact/configuration tests must pass. Existing lint warnings are nonfatal; errors fail. After compilation, the local APK/AAB must exist, match the profile's archive structure, pass ZIP CRC checks, and receive a checksum before upload. These checks do not replace runtime testing or Play validation.
- The build step is limited to **210 minutes**, and the build job to **240 minutes**. A failed/canceled local build ends on the runner; there is no remote cloud build left running. Temporary native work files, Gradle data, and downloaded signing material are cleaned on success/failure where cleanup can run; the hosted VM is discarded afterward. Native logs remain in the GitHub run. Do not enable verbose environment/config dumps when debugging secrets.
- Same-profile runs are serialized across branches; an active run is not automatically canceled by another dispatch. Development and production can run independently. GitHub normally retains only one pending run per concurrency group; another dispatch can replace an older pending one. Manual builds elsewhere are outside this serialization.
- **Costs:** GitHub Actions minutes and artifact storage apply. There is no EAS cloud build charge for `--local`; existing Expo services such as Updates remain governed by their own usage/plan. Artifacts request **14 days** of retention, subject to repository policy. Download releases you need to preserve before expiration; there is no EAS-hosted copy of this locally built artifact.
- Existing `pnpm build` and `pnpm build:dev` still request cloud builds when run manually on your computer; the workflow invokes the explicit `--local` command itself. `pnpm build:dev:local` already builds locally. No package-script change is necessary for this action to compile on GitHub. iOS and OTA commands remain separate.

The workflow was checked with actionlint and the artifact helper with automated tests. A real authenticated build still requires the token, signing, and environment setup above; no native build or GitHub workflow run was launched from the development workspace.
