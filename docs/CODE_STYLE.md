# PlannerITI Code Style

This guide defines the conventions for application code. Prefer small, readable changes that preserve the existing domain behavior and public data contracts.

## 1. Naming

- Use `PascalCase` for React components, classes, interfaces, and type aliases.
- Use `camelCase` for variables, functions, hooks, props, and object fields in client code.
- Use `UPPER_SNAKE_CASE` only for immutable module-level constants.
- Name booleans with `is`, `has`, `can`, `should`, or `did` prefixes.
- Name event handlers with `handle` and callbacks with `on`.
- Use domain vocabulary consistently: `assignment`, `course`, `period`, `semester`, and `subgroup`.
- Keep API spelling quirks such as `diriginte` at the service boundary; normalize them before exposing data to UI code.
- Avoid abbreviations unless they are established domain terms such as `IDNP`, `API`, or `URL`.
- Do not use one-letter names outside short mathematical callbacks.

## 2. File and Module Design

- Keep route files focused on routing and screen composition.
- Keep reusable visual behavior in `components/` and business logic in `services/` or `utils/`.
- Keep custom hooks focused on one stateful concern.
- Prefer one primary exported component or service per file.
- Put shared constants and types at module scope, above implementation code.
- Keep imports grouped and sorted by the project Prettier configuration.
- Use path aliases for root-level application imports and relative imports only within a nearby feature.
- Keep wire-format conversion at API boundaries.
- Avoid circular dependencies; extract shared types or helpers instead.

## 3. TypeScript

- Keep `strict` mode enabled and fix type errors rather than suppressing them.
- Prefer explicit domain types over `any`, especially for API responses and event payloads.
- Use `unknown` for untrusted input and narrow it before use.
- Use `type` for unions and object shapes; use `interface` when extension or declaration merging is useful.
- Make nullable state explicit with `T | null`.
- Use `readonly` for values that should not be mutated.
- Validate parsed JSON at the boundary before treating it as a domain object.
- Keep public functions' input and output types explicit.
- Avoid non-null assertions unless a local invariant makes them unavoidable.

## 4. React and React Native

- Keep render functions declarative and move transformations into named helpers.
- Keep effect dependencies complete and make asynchronous effects cancel-safe.
- Do not perform storage or network work during render.
- Load expensive detail data when it becomes visible or expanded.
- Use stable keys from domain identifiers, never array indexes for reorderable content.
- Memoize only when profiling or a clear render boundary justifies it.
- Prefer `FlatList` or `SectionList` for unbounded collections.
- Keep animation work on the UI thread and avoid recreating animated values in render.
- Clean up timers, subscriptions, listeners, and pending requests on unmount.
- Use `Pressable` or platform-appropriate controls for interactions.
- Give icon-only controls an accessibility role and a localized label.

## 5. Data, Network, and Security

- Treat API responses, storage values, deep-link parameters, and environment values as untrusted.
- Use a single request helper per backend contract for headers, timeouts, and error parsing.
- Preserve authentication options when retrying a request.
- Never log access tokens, passwords, IDNP values, API keys, or full request bodies.
- Store authentication tokens only in SecureStore; fail closed when secure storage is unavailable.
- Do not retain plaintext passwords longer than the backend contract requires. Prefer server-issued encryption keys or key wrapping for future sync APIs.
- Encode URL parameters and prefer request bodies for sensitive values.
- Cache only data with a defined expiration and invalidate it when the source changes.
- Make retries bounded and idempotent.
- Keep secrets out of source control, logs, screenshots, and error messages.

## 6. State and Performance

- Keep state as close as possible to the component that owns it.
- Derive values during render instead of storing duplicate state.
- Batch related storage reads and cache settings per operation.
- Avoid one timer, listener, or storage read per list row when a shared parent update is sufficient.
- Use incremental rendering only as a bridge; prefer virtualization for large lists.
- Avoid sorting or grouping the same collection repeatedly in nested renders.
- Cancel stale requests when inputs change.
- Measure before adding memoization or changing animation strategy.

## 7. UI and Accessibility

- Use semantic theme tokens from `constants/Colors.ts`; do not scatter raw colors through screens.
- Keep spacing, radii, typography, and shadows consistent with neighboring components.
- Make touch targets large enough for reliable use and keep destructive actions visually distinct.
- Ensure text remains readable in both theme modes and at larger font sizes.
- Provide loading, empty, error, and offline states for data-driven views.
- Avoid nested touchables unless event ownership is explicit.
- Use localized user-facing text; do not hard-code copy in a single language.
- Add accessibility labels, roles, hints, and state values where the visual icon or styling is not self-describing.
- Respect reduced-motion and platform conventions when adding animation.

## 8. Comments and Documentation

- Prefer expressive code over comments.
- Add comments only for non-obvious domain rules, compatibility constraints, or security decisions.
- Keep comments current and explain why, not what.
- Update README or feature documentation when behavior, setup, or supported versions change.
- Record intentional dependency compatibility pins in the package manifest or upgrade notes.

## 9. Validation

Before submitting a change, run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm exec jest --watchAll=false --runInBand --passWithNoTests
npx expo-doctor
```

For changes to authentication, storage, notifications, navigation, or list rendering, add or update a focused test when the behavior can be exercised without a device.
