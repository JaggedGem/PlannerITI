# App updates

PlannerITI checks Google Play for native Android updates and stages Expo EAS OTA updates through the existing `updateService` entry point. Native updates are recommended and optional. Version availability comes from Play Core and Android version codes, never from a comparison of display-version strings.

## Implementation map

- `services/updateService.ts`: startup/lifecycle coordination, a shared disruptive-operation gate, OTA metadata, version/channel display, native actions, and observable banner state.
- `services/nativeUpdateClient.ts`: guarded Nitro loading, typed Play results, capabilities, install listeners, and bounded status checks.
- `constants/UpdatePolicy.ts`: explicit flexible/immediate release policy.
- `app/_layout.tsx`: the sole startup entry point and lifecycle attachment.
- `components/NativeUpdateBanner.tsx`, `constants/Translations.ts`: store fallback and recovery/error messages in English, Romanian, and Russian.
- `app.config.js`, `eas.json`, `.env.example`: explicit runtime boundaries and beta Play opt-in.
- `services/updateService.test.ts`, `services/nativeUpdates.test.ts`, `services/nativeModuleUnavailable.test.ts`: mocked OTA, Play, lifecycle, and concurrency tests.
- `package.json`, `pnpm-lock.yaml`: dependencies and pnpm lockfile.

## Dependency and native compatibility review

Pinned dependencies:

| Package                                | Version   | Purpose                                                                                                     |
| -------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `@rnforge/react-native-in-app-updates` | `1.0.2`   | Google Play update API                                                                                      |
| `react-native-nitro-modules`           | `0.37.1`  | Native bridge required by the library                                                                       |
| `@babel/runtime` (development)         | `7.29.10` | Makes Jest's generated Babel helpers resolvable with pnpm; the baseline tests lacked this direct dependency |

The published package's declarations and Android source were inspected. The integration uses its actual `getUpdateStatus`, capability helpers, `startFlexibleUpdate`, `startImmediateUpdate`, `addInstallStateListener`/subscription `remove`, `completeFlexibleUpdate`, and `openStorePage` APIs. The store helper opens the **installed package's** listing, with a browser fallback; it never redirects beta to production.

The library documents Android compile SDK 34+, NDK 27+, and Google Play services. This project's RN 0.88 defaults are compile SDK 37, target SDK 36, min SDK 24, NDK 27.1.12297006, and Kotlin 2.2.0. Both dependencies inherit the root SDK/NDK settings. Nitro's standalone NDK default is 29; that default is not a change to this project's root NDK. No additional Expo config plugin is documented or needed for autolinking. Both Android and iOS autolinking were checked, and `expo prebuild --no-install --platform all` succeeded in a disposable copy without adding generated native files to the repository.

Android release builds also need the targeted `extraProguardRules` entry in the existing `expo-build-properties` configuration. Library 1.0.2's C++ registration constructs `dev.rnforge.inappupdates.HybridInAppUpdates` by its literal JNI class name, but the concrete Kotlin class has no `@Keep` annotation or consumer shrinker rule. R8 can therefore remove/rename it even though the generated abstract spec is kept. The reported Internal Testing startup crash confirmed this exact `ClassNotFoundException`. The app now keeps that class and its members; release optimization remains enabled for the rest of the app.

The fix was checked with an isolated R8 reproduction (the unprotected concrete class is removed, then retained with the rule) and by verifying the generated Android `app/proguard-rules.pro` after Expo prebuild. This is not a full app/device test. The fix requires rebuilding and uploading a new AAB; an OTA cannot restore a class missing from the installed binary. Keep the existing runtime for this shrinker-only correction because the native interface is unchanged.

**Full SDK 58/RN 0.88 native compatibility still requires release builds.** Broad peer dependency ranges are not proof of native compatibility: the update library itself develops against RN 0.84.1/Nitro 0.35.6. This environment has no Android SDK/NDK toolchain or macOS/Xcode/CocoaPods build environment, so Android compilation and iOS linking were not verified. The published library includes an iOS implementation/podspec and documents Xcode 16.4+/Swift 5.9+; PlannerITI never invokes its native update API on iOS. Run Android and iOS EAS builds before merging/releasing. Expo and React Native versions were preserved.

References:

- [Library installation and requirements](https://github.com/rnforge/react-native-in-app-updates/tree/v1.0.2)
- [API and integration documentation](https://rnforge.dev/docs/in-app-updates)
- [Google Play testing requirements](https://developer.android.com/guide/playcore/in-app-updates/test)
- [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)
- [Expo Updates API](https://docs.expo.dev/versions/latest/sdk/updates/)

## Startup and coordination

1. The root layout attaches the service's lifecycle once and calls `initializeUpdates()`. Concurrent calls and Strict Mode remounts share the same startup promise. Cleanup removes AppState/install listeners; a late check cannot attach a listener after unmount.
2. Play is queried first, with a four-second deadline. Unsupported environments never load the Nitro module. An unresolved Play request is retained across check timeouts to prevent concurrent native queries; its late completion cannot launch an update flow.
3. An interrupted immediate update or an active native installation takes the disruptive-operation gate. OTA staging remains allowed, but a JavaScript OTA reload cannot acquire the gate.
4. Otherwise, a valid previously staged OTA can apply through the existing `applyPreparedOtaUpdateOnLaunch()` method. A successful reload retains the gate because `reloadAsync()` resolves before the JS runtime is actually replaced.
5. If no reload occurred, `prepareOtaUpdateForNextLaunch()` checks/downloads once in the background. Flexible downloads do not block staging. A completed Play download takes priority over an explicit OTA reload.
6. Once startup finishes and the app renders, the root layout enables native prompts. An available update opens Google's native consent UI directly, rechecking capabilities through the shared gate. No initial recommendation banner or extra Update tap is required, and waiting for consent does not hold the splash screen open. After consent, download completion automatically calls `completeFlexibleUpdate()` while the app is active. Play installs the binary and restarts the app; `Updates.reloadAsync()` cannot install a Play binary. A download completed in the background is applied on the next foreground, and an already downloaded update is applied after app readiness on cold launch. Installation holds the same gate until process replacement or a reported failure. Ready/installing states show no app banner or second restart confirmation. A banner remains for recovery, errors, and the store-page fallback when Play cannot start an allowed in-app flow.

A failed or timed-out Play check is distinct from “no update.” It still allows OTA checks/downloads. Because a failed check cannot rule out an interrupted native flow, explicit OTA reload is deferred for that cold launch; Expo can apply compatible downloaded content at the next cold start. No automatic OTA reload is attempted on foreground.

Foreground transitions recover downloaded/pending updates. Ordinary status checks are throttled to at most once per minute; active download/recovery states get a fresh status on foreground. There is no polling or automatic retry loop. After app readiness, a newly detected update can open native consent automatically once per JS lifetime. Declining, accepting, or failing that flow prevents automatic reopening on later foreground transitions or remounts. A failed flow or completion retains an explicit retry action. Automatic completion is attempted once per JS lifetime, and repeated downloaded events cannot start concurrent installations or create a retry loop. Install status takes precedence over Play's availability reason: downloaded/installing states are handled directly even when Play reports `developer-triggered-update-in-progress`. Genuine interrupted immediate flows retain store recovery. A new cold launch may offer consent again.

`updates.checkAutomatically` is explicitly `NEVER`: the coordinator owns OTA network checks/downloads, removing the previous parallel default native launch check. Expo still controls compatible cached-update selection on cold launch and its native runtime safety mechanisms.

## OTA markers and version display

The `@ota_pending_update` marker now records update ID, fetch time, Expo runtime version, application ID, and installed native build number. A marker is applied only on the same runtime/package/build and only if its update is not already running. Legacy, malformed, different-build, and already-applied markers are removed. Clearing metadata does not delete Expo's cache; the normal staging workflow can revalidate an available update on the current binary. Compatible markers on the same binary are preserved while a native action blocks reload, including install events arriving during asynchronous marker reads/clears.

Expo's runtime/selection policy remains authoritative. An AsyncStorage marker cannot make an incompatible cached update launchable. Failed reloads do not recreate a marker that could produce a restart loop.

The displayed app version prefers `extra.releaseVersion` from the running build/OTA manifest. `app.config.js` populates this from `RELEASE_VERSION`, falling back to `expo.version` when unset or blank. Older manifests with no valid release label fall back to `expo-application`'s installed version (or the project config version in Expo Go). This display label never changes the native version code, runtime compatibility, channel, or Play update eligibility. OTA identifiers still prefer manifest update-group metadata, then the update ID. EAS channel names are used exactly as reported by `expo-updates`; prerelease strings and substring matches no longer guess a channel. Expo Go is displayed as development, optionally annotated with the configured production/beta variant.

## Build variants and runtime change

| Variant     | Package (unchanged)           | EAS channel (unchanged) | New runtime    |
| ----------- | ----------------------------- | ----------------------- | -------------- |
| Production  | `site.jagged.planneriti`      | `production`            | `1.6.1`        |
| Beta        | `site.jagged.planneriti.beta` | `beta`                  | `1.6.1-beta.1` |
| Development | `site.jagged.planneriti.dev`  | `development`           | `1.6.1-dev.1`  |

The production release uses runtime `1.6.1`, replacing the feature-testing runtime suffix. These are different compatibility identifiers: install a new 1.6.1 native build before publishing OTAs targeting runtime `1.6.1`. Existing test binaries keep their embedded runtime and cannot receive the new-runtime OTA. The boundary also separates this release and its OTA cache from pre-Nitro runtimes. The production default in `app.config.js` matches EAS. Existing binaries retain their old runtime and can continue receiving compatible updates separately. Match the target build's `RUNTIME_VERSION` when publishing OTAs; do not publish Nitro-dependent content to the old runtimes. The default app display version is 1.6.1; `RELEASE_VERSION` can advance it through OTA. EAS still increments Android version codes remotely.

Production checks are enabled for its installed package. Beta checks require `BETA_PLAY_UPDATES_ENABLED=true` in the beta build **and update** environment, only after its own package has a valid Play listing/test distribution. The current beta EAS profile remains internally distributed; that alone does not make it Play-eligible. The default is false. Play Core checks the installer and services; sideloaded/unsupported installations receive no recurring update prompt. Development clients, the `.dev` package, Expo Go, web, and iOS do not invoke Nitro update functionality.

A new native build is required to deliver this feature. An OTA alone cannot add Nitro/the update module. The guarded import handles an older binary without crashing.

## Building and publishing releases

No separate Google Play app ID or API key is configured in the app. Play Core reads the installed package and version code, and Google Play determines signing, ownership, track, and rollout eligibility. Play Store submission credentials, if used by EAS Submit, are separate from update detection.

For production:

1. Run **Actions → Android Runner Build → Run workflow**, select `main` and `production`, and download the AAB after the checks and local runner compilation finish. See the [runner setup guide](github-eas-builds.md). The existing `pnpm build` command is an alternative that builds on EAS cloud servers. Both use the production profile and increment the Android version code because it has `autoIncrement: true` and remote version management.
2. Upload the AAB to Google Play Console, validate it through Internal Testing, and roll it out to the intended track. Building alone does not publish to Play. EAS Submit can automate upload after its Google service-account/Play setup is configured; Console release review/rollout still applies.
3. The first binary containing this feature must be installed through Google Play's normal update/install process. An older binary cannot acquire the new native modules via OTA. After that bootstrap release, later eligible higher-version-code releases can be offered in-app.
4. For subsequent JS/assets-only changes compatible with that binary, use `pnpm run update` (Android) or `pnpm run update:ios`. They publish an OTA using the production channel and `--environment production`, which is required on SDK 55+. A Play upload and version-code increment are not required for compatible OTA-only changes. Use `pnpm run update` explicitly: `pnpm update` is pnpm's dependency-update command.
5. For native dependencies/configuration changes, create a new runtime boundary, rebuild, and release through the stores again. Keep the runtime unchanged for compatible JS-only updates. Change `expo.version` separately when the installed binary version should change; Play availability uses the native version code.

Build-profile `env` values in `eas.json` are **not automatically applied by `eas update`**. The production EAS environment should use `APP_VARIANT=production`, `ANDROID_PACKAGE=site.jagged.planneriti`, `IOS_BUNDLE_IDENTIFIER=site.jagged.planneriti`, and `RUNTIME_VERSION=1.6.1`, matching this build generation. Those are also the config defaults, but stale values in the selected server environment can override them. Make the non-secret variant/runtime values readable for update publishing, and keep application API configuration consistent between build and update environments. With `--environment`, local `.env` files do not supply the update environment.

To advance the displayed app version with an OTA, set `RELEASE_VERSION=1.6.5` in the **production EAS environment**, keep `RUNTIME_VERSION=1.6.1` unchanged for compatible JS/assets changes, then run `pnpm run update` (and `pnpm run update:ios` if publishing for iOS). When that OTA applies, Settings displays 1.6.5 while the installed native version remains 1.6.1. No binary rebuild is needed. Local `.env` works for local Expo configuration, but these OTA scripts use the selected EAS environment rather than local `.env` files. Set the corresponding release label in the preview EAS environment for beta releases. Keep the desired `RELEASE_VERSION` in that environment for later builds/updates so it does not revert to the default.

Before building the 1.6.1 production release, set Expo's production environment variables to `RUNTIME_VERSION=1.6.1` (Plain text) and `RELEASE_VERSION=1.6.1`, and update the GitHub production environment's `RELEASE_VERSION` variable to `1.6.1` if configured. Update any local release settings too. The committed native version and default runtime come from `package.json`; explicit environment overrides remain supported. Dropping the feature-runtime suffix changes compatibility, so release a new AAB rather than publishing this runtime change as an OTA to the feature-test binaries. Keep future compatible OTA publications on runtime `1.6.1`.

For beta, use `eas build --profile beta --platform android` and publish OTAs with `eas update --channel beta --environment preview --platform android` only after configuring the preview EAS environment to match the beta profile's package/runtime values. The internally distributed beta build defaults to the preview EAS environment. An EAS environment, EAS channel, and Google Play testing track are separate concepts. A beta Play release additionally needs its own listing and explicit beta Play opt-in, as described above. No beta update script is added that could silently publish using the production config defaults.

See [Expo's EAS environment documentation](https://docs.expo.dev/eas/environment-variables/usage/#using-environment-variables-with-eas-update).

## Flexible and immediate policy

`NATIVE_UPDATE_POLICY` in `constants/UpdatePolicy.ts` defaults to `flexible`. Set it explicitly to `immediate` only for a designated critical release, distributed in the build or a compatible OTA. No backend endpoint or automatic priority threshold was invented. Both modes show Google's consent UI directly and remain cancellable; accepting the flexible update also authorizes automatic installation and restart when the download completes.

- Flexible policy uses flexible only. If Play permits only immediate, offer the valid package's Play Store page instead of escalating.
- Immediate policy uses immediate when allowed, otherwise flexible when allowed, otherwise a store-page action when supported.
- If Play permits neither an update flow nor a store action, no unusable banner action is shown.
- Consent actions recheck status. A downloaded event authorizes completion directly; the native completion API performs its own fresh Play check. Initial consent opens automatically once the app is ready; a failed flow retries only on an explicit user action. Cancellation is a normal outcome. API, download, and install errors are logged and handled without stopping app use.

**Interrupted immediate-flow limitation in library 1.0.2:** its Android source returns `developer-triggered-update-in-progress` from `startImmediateUpdate()` instead of calling Play Core's flow launcher in that branch. There is no separate public resume method. PlannerITI detects that state on cold start/foreground, defers OTA reloads, and offers Play Store recovery. It does not pretend that repeatedly calling this API resumes the native UI. Full in-app resumption requires an upstream library fix/verified newer version; there is no artificial forced-update loop.

## Automated validation

Using pnpm **11.1.2**, the project's configured version:

- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 36 existing `no-explicit-any` warnings in unrelated files; no errors.
- `pnpm test`: passed (93 tests across five suites, including automatic Play completion regressions).
- Changed-file formatting and `git diff --check`: passed.
- Frozen-lockfile installation from an empty `node_modules`: passed offline with the existing store.
- Android/iOS prebuild and autolinking: passed in a disposable copy; no generated native files committed.
- `pnpm exec expo-doctor`: 18/20 checks passed after a clean install. Expo config schema and React Native Directory lookups could not complete in this environment's network configuration. The CLI was supplied from a temporary pnpm installation because the repo does not depend on expo-doctor. An initial run also detected stale duplicate packages in the provided `node_modules`; a fresh frozen-lockfile install resolved that warning.
- No physical-device Google Play update flow, Android compilation, or iOS compilation was performed.

The tests cover no update, both allowed modes, neither allowed, unsupported platforms/Expo Go/dev/missing module, beta opt-in, sideloads/API failures/timeouts, shared startup, OTA/native exclusion, downloads/install completion, cancellation/errors, listener cleanup, late-event races, and pending OTA metadata across runtime/native upgrades.

## Manual Google Play validation

Use a physical Android device with Google Play services and a tester account that owns/can access the app. Internal Testing is the recommended first path.

1. Build an older **release** binary from this branch with the correct package, runtime, Play signing setup, and a known Android version code. Upload it to that package's Internal Testing track. Enroll the tester, accept the opt-in, and install through Google Play. Debug clients and `adb install` cannot validate real in-app updates.
2. Upload a second release for the **same package/signing identity** with a higher Android version code to a track accessible to the same tester. A different display version is optional; version code and Play eligibility determine availability. Wait for Play to publish/recognize it. Keep the older app installed.
3. Cold-launch the older app. Confirm Google's update consent UI opens directly once the app is ready, with no initial recommendation banner or extra Update tap. Decline consent, background/foreground the app, and verify it does not reopen consent. A new cold launch may offer consent again.
4. Cold-launch again and accept Google's flexible UI. Continue using the planner during download. Background/foreground and restart it during download. Confirm no JS-triggered restart occurs while downloading. Once downloaded, verify Play automatically installs and restarts without an app toast, a second restart action, or a store redirect. Confirm the installed Android version code advances to the uploaded build. Repeat with a small download that finishes before the consent flow promise returns.
5. Decline Google's consent, disconnect the network, and exercise download/install failure where possible. Confirm the planner remains usable, errors do not create retry loops, and a user-driven retry can recover. Reopen with an already downloaded update and confirm installation starts automatically after app readiness. Complete a download while backgrounded and verify automatic installation on foreground. After an installation failure, verify the Retry action retries completion without an automatic retry loop.
6. Test immediate mode separately: set the explicit policy to `immediate` in the **older test build** (or a compatible OTA for it), then publish another higher-version-code build. Confirm the immediate consent UI appears directly once the app is ready, only when Play allows it, without an initial app banner. Test cancellation and process termination. On interrupted immediate recovery, verify the documented 1.0.2 limitation: OTA reload stays deferred and the store action provides recovery. Do not report native UI resumption as implemented by this library version.
7. Publish a JS-only OTA to the matching EAS channel/runtime. Confirm it stages in the background and applies on the next cold launch, including while a flexible native download is still in progress. If the Play download is already complete, confirm native installation takes priority over an explicit OTA reload. Verify there is no simultaneous explicit OTA reload and native installation/UI.
8. Stage an OTA, then install a newer native version through Play. Test both a changed runtime and a higher native build number on the same runtime. Confirm obsolete marker cleanup does not cause a redundant reload loop. Expo may already have selected a compatible OTA before JS begins; the displayed OTA identifier helps verify this.
9. Repeat for beta only after its separate `.beta` Play setup and opt-in flag are configured. Verify it never opens the production listing. Verify Expo Go/dev/iOS remain usable with their native-update checks disabled.

Internal App Sharing is an alternative when the account/device has it enabled: install the older build from its sharing link, upload a higher-version-code build for the same package, open the newer sharing link without manually installing it, then return to the older app to check. Follow Google's signing/ownership requirements and current sharing instructions. A local sideload is not a substitute.

Development/Jest can test guards, UI state, coordinator behavior, and mocked failures. Only eligible Play-distributed builds can establish real availability, Google consent, background downloading, signing/track eligibility, or actual installation behavior. Complete Android/iOS release builds and this physical-device plan before release.
