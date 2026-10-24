DayView and WeekView now share a persisted, context-aware subject color assignment. No package dependencies were added.

The schedule service supplies the full CEITI timetable, not just the displayed day. `useSubjectColors` normalizes it after rendering, combines odd/even layouts and locally cached date overrides, and reconciles one shared `SubjectColorStore`. Cards perform cached presentation lookups. Grades and assignments do not currently consume the timetable's subject color palette; their existing status/type colors remain separate.

`subjectColorId` prefers an upstream subject `_id` or `id`. The current API model commonly supplies only a name, so older payloads use a case/whitespace-normalized name identity. Names used for identity retain punctuation and diacritics; semantic matching uses separate normalization. Stable IDs distinguish identical display names and survive renames. Without upstream IDs, a rename cannot reliably be distinguished from a new subject. Custom periods use their own ID namespace, and assignment identifiers are untouched.

Geometry uses day columns and start/end minutes. Same-day or adjacent-column cards conflict if their time intervals overlap or are within 45 minutes, covering the existing 10-minute breaks and 40-minute lunch. The minimum card height is conservatively represented using WeekView's 35px minimum at 65px/hour. Irregular durations can create several neighbors for one long card. Each scenario is independent: odd and even lessons never conflict with one another directly. Actual date layouts include removed slots, time overrides and recovery weekdays; omitted weekend columns are compressed as in WeekView. Ordinary cached weeks with unchanged geometry do not add conflict counts when navigating.

The graph unions conflicts across all occurrences. Same-day and overlapping adjacent-day relationships have base weight 10; diagonals have weight 7. Gaps reduce weight by up to 40%. Repeated relationships use average relationship weight multiplied by `1 + log(1 + count)`, so frequent pairs matter without growing linearly. Thresholds and weights are explicit in `NEIGHBORHOOD`.

The allocator uses weighted DSATUR followed by up to ten best-improvement reassignment/swap passes. It first minimizes the number of severe collisions (OKLab distance below 0.018 or meaningful hue distance below 10°). Its soft score combines weighted neighborhood costs, a squared worst-pair penalty, semantic preferences, existing-color stability and duplicate-color penalties. The default separation targets are 50° in OKLCH and 0.09 in OKLab. Near-neutral colors use perceptual distance without unreliable hue angles. All comparisons use the actual opaque weekly background colors. Deterministic subject ordering and a tiny stable tie-break preference replace independent name-to-palette hashing.

Candidates start with 24 OKLCH hue samples at controlled lightness/chroma and expand deterministically using golden-angle hues and bounded lightness/chroma variation. Out-of-gamut colors reduce chroma at constant hue/lightness. The small reference-matrix color conversion implementation is covered by reference-coordinate and round-trip tests. No runtime color library was needed.

Exact normalized Romanian/English aliases define soft semantic preferences, including Mathematics → blue, Biology → green, Chemistry → purple, Physics → orange, History → amber, Geography → earthy green, Informatics → cyan and Literature/Romanian → rose. Unknown or ambiguous names, including `Pv` and physical education, remain unclassified. Spatial penalties can outweigh these associations.

Assignments are scoped to CEITI group and selected subgroup in versioned AsyncStorage keys. The store retains deleted subjects for reintroduction, preserves locked colors and serializes updates per scope. Existing colors carry a strong stability penalty during ordinary reconciliation. Matching graph fingerprints skip allocation, unchanged assignments skip persistence writes, and failed writes retry on later updates. Group provenance prevents a pending group switch from assigning the old group's timetable to the new group. `reconcile(scope, layout, { rebalance: true })` allows internal global optimization while preserving locks; no settings UI was added. The former palettes were implicit, so migration requires no user-data schema changes: colors may change once on first allocation.

Both schedule components currently render dark surfaces regardless of the OS theme. WeekView uses opaque gradients derived from the shared hue, with white title/room/teacher text and no secondary-text opacity reduction. Active cards use an accent border. DayView keeps its existing accent/dot/chevron design and now respects explicit custom-period colors. Light presentation variants are available and tested for future theme adoption. Tests check at least 4.5:1 foreground contrast at both gradient endpoints and three intermediate samples; generated accents exceed 3:1 against the dark daily surface.

Server-side Node profiling of representative irregular layouts produced the following measurements. Warm values average three runs; incremental values include allocation using existing assignments. These are execution-environment measurements, not Android device measurements. Unchanged-input store hits skip the allocator entirely.

| Subjects | First allocation | Warm allocation | Incremental allocation |
| -------- | ---------------: | --------------: | ---------------------: |
| 5        |           8.3 ms |          2.4 ms |                 1.3 ms |
| 10       |           2.5 ms |          1.7 ms |                 1.7 ms |
| 20       |           3.8 ms |          4.9 ms |                 2.4 ms |
| 30       |           5.6 ms |          6.8 ms |                 4.6 ms |

On the 11-subject fixture inspired by the supplied weekly screenshot, exact neighbor-color collisions fall from 2 to 0, pairs below the 50° target fall from 6 to 1, and weighted perceptual conflict cost falls from 1308.66 to 3.02. The remaining pair is 45.30° apart; minimum neighboring OKLab distance is 0.1119. These metrics compare assignments under the new rendering transform, not a pixel analysis of the screenshots. Dense graphs and conflicting locks cannot guarantee ideal hue separation. The bounded heuristic seeks a good deterministic compromise rather than a mathematical optimum. Color vision deficiency simulation and native visual verification were not performed.

Validation completed:

- All six relevant suites pass: 42 tests covering the engine, geometry, color science, persistence, shared-hook consumption and schedule-service identity propagation.
- The full Jest run reports 34 passing suites and 223 passing tests. Three suites fail for baseline issues: the missing `@rnforge/react-native-in-app-updates` dependency in two native-update suites, and the absent bottom-sheet compatibility patch in `test/reanimatedCompatibility.test.js`. These three failures were reproduced from an unchanged HEAD archive with the same dependencies.
- Targeted ESLint passes for every changed TypeScript file. Repository ESLint reports the existing unresolved `expo-image` import in settings. The Expo lint wrapper also encounters its inaccessible home-directory telemetry path; direct ESLint uses the repository configuration.
- Typecheck reports the same baseline errors: missing `expo-image`, missing native-update dependency declarations, and the nullable update-status promise in `services/nativeUpdateClient.ts`. The unchanged HEAD archive produces the same errors.
- Formatting and whitespace checks pass for the changed files. No native build, emulator run or device screenshot comparison was performed.

Actual files changed:

| File                                     | Change                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `components/schedule/DayView.tsx`        | Consume shared accent colors and remove the local hash function.                       |
| `components/schedule/WeekView.tsx`       | Consume shared card presentations, accessible gradients/text and active borders.       |
| `constants/Colors.ts`                    | Remove the two unused legacy subject palettes.                                         |
| `services/scheduleService.ts`            | Preserve upstream subject identity and timetable source-group provenance.              |
| `services/scheduleService.test.ts`       | Verify lesson identity propagation and source-group tagging.                           |
| `services/subjectColorService.ts`        | Shared scoped persistence, reconciliation, caching and rebalance entry point.          |
| `services/subjectColorService.test.ts`   | Persistence, rapid updates, recovery, isolation, locks and write suppression.          |
| `hooks/useSubjectColors.ts`              | Connect full schedule/date geometry to the store and both views.                       |
| `hooks/useSubjectColors.test.ts`         | Verify cross-view consistency, custom colors and group-switch isolation.               |
| `utils/subjectColors/layout.ts`          | Normalize recurring/date geometry and build weighted conflicts.                        |
| `utils/subjectColors/layout.test.ts`     | Test all eight neighbors, irregular times, recurrence, recovery and malformed data.    |
| `utils/subjectColors/colorSpace.ts`      | OKLab/OKLCH transforms, gamut mapping, palette expansion and presentations.            |
| `utils/subjectColors/colorSpace.test.ts` | Reference conversions, gamut, contrast, expansion and alias recognition.               |
| `utils/subjectColors/semantics.ts`       | Explicit semantic aliases and stable subject color identities.                         |
| `utils/subjectColors/allocator.ts`       | Deterministic graph allocation, stability, local optimization and quality diagnostics. |
| `utils/subjectColors/allocator.test.ts`  | Quality, determinism, stability, locks, dense graphs and seeded irregular fixtures.    |
| `test/subjectColorFixtures.ts`           | Reusable API-shaped fixtures based on the supplied schedule.                           |
| `docs/subject-colors.md`                 | Architecture, tuning, validation results, measurements and limitations.                |
