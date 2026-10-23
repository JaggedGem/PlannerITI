# Profile caching and Reanimated compatibility

Automatic `/auth/me` loads share an in-flight request and reuse the last successful profile for five minutes. Network and server failures retain the profile and postpone automatic retries for 30 seconds. `loadUserData({ forceRefresh: true })` bypasses freshness for an explicit account refresh or email verification. Login and logout invalidate the cached session. Auth-state subscribers consume the published state; they must not fetch the profile in response to each profile-loaded event.

Gravatar metadata is cached per normalized email in memory and under the existing hashed AsyncStorage key for 24 hours. Concurrent lookups share one request, including the initial disk read. A missing Gravatar profile is cached for the same interval. Refresh failures preserve the last successful avatar and retry after five minutes. Disk-cache failures do not discard a successfully fetched profile. Avatar URLs stay stable; rendering never adds a cache-busting timestamp.

Reanimated 4.7 warns when native animation hooks receive dependency arrays. The app preserves these arrays on web and omits them on native. Bottom-sheet 5.2.14 still supplies them internally, so its native source entry has a version-specific pnpm patch recorded in `pnpm-workspace.yaml` and the lockfile. This changes the hook arguments rather than suppressing Reanimated warnings. Keep the patch and package version together when upgrading the library.

After pulling this change, apply the dependency patch and clear Metro's cache:

```sh
pnpm install --frozen-lockfile
pnpm dev:clear
```

The patch changes JavaScript only; these fixes do not require rebuilding the native development client. Tests cover request deduplication, freshness and retry windows, offline avatars, account isolation, and the installed bottom-sheet native entry. A native-device smoke test should exercise opening and scrolling assignment sheets, switching accounts, and returning to settings while watching network requests.
