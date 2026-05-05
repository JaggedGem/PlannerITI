# PlannerITI 1.3.0 Release Notes

This release focuses on three big areas: a rebuilt OTA update flow, major schedule engine upgrades, and a round of build and performance cleanup work. The history since v1.2.0 also includes a few branch-side duplicate commits from beta merges; where that happened, the notes below consolidate the same change so the release notes stay readable without losing detail.

## Highlights

- OTA updates were reworked to be more reliable, with clearer channel handling and version visibility in settings.
- Schedule calculations became more accurate and more flexible, especially for special schedules, recovery days, subgroup assignment, and thesis or exam handling.
- The app startup path now initializes more background services automatically, which improves freshness for schedule and grade data.
- Several UI animations and legacy update components were removed or simplified to improve performance and reduce maintenance overhead.
- Build configuration, icons, and dependency packaging were updated in preparation for distribution.

## Commit-by-Commit Details

- 7b0d37e chore: bump version to 1.2.0-beta.1
  - Updated the app version metadata in app.config.js, package.json, and package-lock.json to align the beta build identifiers.
  - This was a release-prep step rather than a feature change.

- f39972c / 2ea9a60 fix(update service): attempt to fix wrong update channels
  - Tightened the logic in services/updateService.ts that decides which update channel the app should query.
  - Prevented the app from checking the wrong branch of OTA updates, which could cause stale update checks or false positives.

- 2be718d / b018fd2 fix(update service): fix the development release channel mismatch
  - Corrected a mismatch between the development channel name used by the app and the one configured for release.
  - Reduced the chance of dev builds looking at production updates or vice versa.

- af242ed / 1fe0fa4 feat: add dynamic runtime version from eas.json
  - Changed app.config.js so runtimeVersion is read dynamically from eas.json instead of being hardcoded.
  - This makes OTA/runtime compatibility track the actual build configuration more reliably.

- ee88768 feat(OTA update): add a better built OTA update system
  - Introduced a redesigned OTA flow in app/_layout.tsx and services/updateService.ts.
  - Added more robust update checking and handling so updates are managed centrally and with less manual intervention.

- 2291d98 feat(update service): add method to retrieve current OTA version and display in settings
  - Added a service method to read the installed OTA version.
  - Exposed that version in the settings screen so users can see which build/update track they are on.

- d1abc40 feat(schedule service): initialize schedule on app startup and ensure selected group exists
  - Hooked schedule initialization into app startup in app/_layout.tsx.
  - Added a guard in services/scheduleService.ts to ensure the selected group is valid before continuing.

- 9111495 feat(grades service): trigger background grades refresh on app load if IDNP is available
  - Added a startup refresh path in app/_layout.tsx so grades data can update automatically when user identity is present.
  - Improves data freshness without requiring a manual refresh.

- 8eb135a refactor: remove layout springify from animated views for performance optimization
  - Removed layout spring animations from several components, including assignments and schedule UI.
  - Cleaned up notification and update-related animation behavior to reduce overhead and simplify transitions.

- 362084c feat(schedule): Enhance date-based period times management and recovery days handling
  - Expanded the schedule engine so period times can be resolved by date more accurately.
  - Improved recovery-day handling in both day and week views.
  - This was one of the larger correctness-focused changes in the release.

- 30fe2ba fix: current week type formula fixed to match ceiti's calculation
  - Corrected the week-type formula so it matches the CEITI calculation path.
  - This directly affects whether the app shows the right schedule variant for the current week.

- 062d756 fix(schedule service): make in app formula match ceiti's formula
  - Aligned the in-app formula used by services/scheduleService.ts with CEITI’s own calculation logic.
  - Reduced discrepancies between local schedule display and the upstream source.

- f74d479 feat: fix/improve custom overrides to allow removing periods and changing days for other days with custom schedule support - add custom API configuration and fetch utility for local development
  - Added support for custom schedule overrides that can remove periods or change days, even when the target day is not the same as the source.
  - Introduced utils/customApi.ts plus supporting changes to .env.example, .gitignore, app.config.js, and README.md for local development against a custom API.
  - Expanded services/scheduleService.ts, DayView, and WeekView to consume the override logic.

- 3d5ba2a feat(schedule): enhance week view with special schedule integration
  - Integrated special schedule logic into the week view and shared schedule service.
  - Added utils/specialScheduleUtils.ts so special-case calendar behavior could be resolved consistently.
  - Updated grades, day view, and week view rendering so special schedules appear correctly across the app.

- 8446762 feat(schedule): enhance exam and thesis handling in schedule views with improved UI and translations
  - Improved how exam and thesis events are represented in the schedule views.
  - Added translation keys in constants/Translations.ts and supporting schedule-service logic so those event types display more clearly.
  - Adjusted the schedule UI to better surface those event states in day and week views.

- 52db3a6 feat(schedule): add subgroup handling for thesis events and improve subject matching logic
  - Added more accurate subgroup handling for thesis-related events.
  - Improved subject matching so thesis entries map to the right course or subject context more consistently.

- bee54be feat(schedule): improve subgroup assignment logic and handle unassigned periods in event resolution
  - Refined subgroup assignment in the schedule engine.
  - Added handling for periods that do not have an assignment so event resolution is more resilient.

- 6407253 feat: update README with enhanced features and OTA update details
  - Refreshed the README to describe the new OTA system and the broader feature set more accurately.
  - Serves as the main documentation update for users and contributors.

- cdb9a96 feat: update package.json and pnpm-lock.yaml for new dependencies and scripts
  - Added or adjusted project scripts and dependencies required by the new OTA and build workflows.
  - Introduced scripts/build-apks.js for APK build automation.
  - Expanded services/updateService.ts and updated settings/update UI wiring to support the new flow.

- 39aa59a refactor: remove UpdateNotification component and related update logic
  - Removed the old UpdateNotification component entirely.
  - Simplified update handling by moving responsibility into the newer service-based flow and trimming redundant code from settings and app startup.

- b318531 feat: add eas.json configuration for build environments
  - Added eas.json so build environments are defined in a real config file instead of only a template.
  - Removed the template indirection and cleaned up the associated ignore rule.

- 967db83 update icons readying for play store release
  - Replaced the icon and splash asset set in assets/images.
  - Updated app.config.js so the app branding matches the Play Store release preparation.

- d3e8941 chore: remove unused dependencies from the project
  - Removed unused dependencies from package.json and pruned the lockfiles.
  - This reduces maintenance noise and keeps the dependency graph tighter.

## Integration Notes

- The release history includes merge commits from beta branch integration, but the user-facing work is captured in the commits above.
- The net result is a more stable OTA experience, more accurate schedule calculations, better support for special and custom schedules, and cleaner build output.

## Suggested GitHub Release Description

PlannerITI 1.3.0 is a major quality and infrastructure release. It introduces a rebuilt OTA update system, significantly improves schedule accuracy and special-case handling, and cleans up the app’s startup and build configuration. It also removes legacy update UI, streamlines animations for performance, and refreshes the app assets and documentation in preparation for distribution.