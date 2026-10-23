# Responsive layouts

The app supports phone and tablet windows in both orientations. Layout decisions use the current window and safe-area insets, so resizing and tablet split-screen follow the same rules as rotation. Font scaling can switch dense content back to one column.

- Phone portrait retains the existing colors, cards, spacing, date strip, and bottom navigation.
- Day view places the date picker beside the chronological schedule in landscape when at least 640 points remain inside the safe area. The picker and schedule scroll independently. Portrait keeps the date strip above the schedule. Cards have a maximum reading width of 720 points including padding.
- Week view shares one safe-area width between its headings, grid, and time indicator. Five, six, and seven days all fit, including weekend recovery days. Wider columns show multiline titles and teachers; tall tablet windows increase the hour spacing from 65 to 80 points. Short windows keep the denser timeline and combine the toolbar only when it fits.
- Assignment groups and grade subjects use two columns from 760 available points, accounting for the font scale and the 960-point page limit. Their keys and component structure remain stable through rotation, preserving expanded content.
- Settings uses two continuous columns at the same breakpoint. Account and schedule preferences appear first, followed by subgroup, custom periods, and notifications.
- Forms, authentication screens, and sheets have bounded reading widths. Short windows use a compact tab bar and time picker. An open picker retains its selected time when rotated. Native modals explicitly support both landscape directions.

## Validation

Automated tests cover timetable geometry for five to seven days, phone and tablet sizes, font-scale fallbacks, expanded-content preservation, and time-picker selection through repeated rotation. Run the repository format, lint, type, and Jest checks, plus Expo exports for Android and iOS.

The schedule components were also inspected in a browser fixture using React Native Web at 320×568, 390×844, 667×375, 844×390 with 44-point side insets, 768×1024, 1024×768, 834×1194, and 1194×834. This checks layout with deterministic schedule data; it substitutes native animation and service bindings. Additional cases cover both weekend recovery days, empty schedules, Romanian and Russian labels, and retaining expanded assignments while resizing.

Before release, verify native behavior on an Android phone, iPhone, and tablet:

1. Rotate day and week views with long subject names, expanded assignments, and five, six, and seven scheduled days. Check room, teacher, badges, and the current-time indicator.
2. Resize a tablet split-screen and increase the system font size. Check single-column fallbacks and chronological reading order.
3. Rotate assignments and grades with expanded cards. Check that selection, expansion, scrolling, and add/edit actions remain usable.
4. Open a dropdown, group selection, calculator, and time picker; rotate while open. Check dismissal, safe areas, the keyboard, and all confirm/cancel controls.
5. Check empty, exam-only, loading, error, and offline screens, along with Romanian and Russian labels.

Native device and simulator interaction has not been exercised in the cloud workspace; successful bundle exports do not replace those checks.

Expo Doctor passed 18 of 20 checks in the cloud workspace. Its Expo schema and React Native Directory checks could not complete because their remote services were unreachable; Android and iOS JavaScript/Hermes bundle exports completed successfully.
