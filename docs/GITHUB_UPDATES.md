# GitHub Update Notifications

## Overview

PlannerITI includes an automatic GitHub release update notification system that alerts users when new versions are available. This feature supports both **beta** and **production** release channels.

## How It Works

### For End Users

When you open the app, it automatically checks for updates from GitHub releases (once per hour). If a newer version is available that you haven't dismissed, you'll see a beautiful notification card at the top of the screen.

**What you can do:**
- **View version info**: See your current version vs the latest available
- **Read what's new**: Expand the release notes to see changes
- **Download update**: Tap to download the latest APK directly
- **Dismiss**: Tap "Remind Me Later" - you won't see this version again

### For Developers

The system automatically detects your build variant:
- **Production builds**: Show only stable releases (from `/releases/latest`)
- **Beta builds**: Show all releases including prereleases (from `/releases`)

## Architecture

### Service Layer (`services/githubUpdateService.ts`)

The `GitHubUpdateService` class handles all update logic:

```typescript
// Check for updates
const updateInfo = await githubUpdateService.checkForUpdate();

// Returns:
{
  isAvailable: boolean,
  release?: GitHubRelease,
  currentVersion: string,
  latestVersion: string
}
```

**Key Features:**
- Semantic version comparison (v1.0.2 > v1.0.1)
- Rate limiting (checks max once per hour)
- Dismissal tracking per version
- Channel detection (beta/production)
- Network error handling

### UI Component (`components/GitHubUpdateNotification.tsx`)

A React Native component that displays the update notification:

**Features:**
- Smooth animations (slide down, fade in, scale up)
- Gradient backgrounds (green for production, orange for beta)
- Material Design icons
- Haptic feedback
- Expandable release notes
- Direct download links

## Integration

The component is integrated in `app/_layout.tsx`:

```tsx
<UpdateNotification />        {/* Expo OTA updates */}
<GitHubUpdateNotification />  {/* GitHub releases */}
<LoginNotification />         {/* Login promotion */}
```

## Configuration

### Environment Detection

The service automatically reads from Expo Constants:

```typescript
// From app.config.js
environment: 'beta' | 'production' | 'development'

// From package.json
version: '1.0.1'
```

### Customization

Edit these constants in `services/githubUpdateService.ts`:

```typescript
const GITHUB_API_BASE = 'https://api.github.com/repos/JaggedGem/PlannerITI';
const CHECK_INTERVAL = 3600000; // 1 hour in milliseconds
```

## Translations

All text is localized in `constants/Translations.ts`:

```typescript
githubUpdate: {
  title: 'Update Available',
  newVersionAvailable: 'A new version of PlannerITI is available!',
  currentVersion: 'Current',
  latestVersion: 'Latest',
  betaVersion: 'Beta Update',
  updateNow: 'Download Update',
  dismiss: 'Remind Me Later',
  releaseNotes: 'What\'s New',
}
```

**Supported Languages:**
- English (en)
- Romanian (ro)
- Russian (ru)

## User Experience Flow

```
App Launch
    ↓
[2 second delay]
    ↓
Check if 1 hour since last check
    ↓
Fetch latest GitHub release
    ↓
Compare: latest > current?
    ↓
Check: version dismissed?
    ↓
Show notification with animations
    ↓
User action:
    - Download → Open APK URL → Auto-dismiss
    - Dismiss → Store version → Hide notification
```

## Testing

### Manual Testing

1. **Test update detection:**
   - Create a new GitHub release with higher version
   - Launch the app
   - Notification should appear after 2 seconds

2. **Test dismissal:**
   - Tap "Remind Me Later"
   - Restart app
   - Notification should NOT appear again for same version

3. **Test download:**
   - Tap "Download Update"
   - Should open browser to APK download
   - Notification should dismiss

### Version Comparison Tests

```typescript
// Examples that work:
'1.0.2' > '1.0.1' ✓
'1.1.0' > '1.0.9' ✓
'2.0.0' > '1.9.9' ✓
'v1.0.2' > 'v1.0.1' ✓ (handles 'v' prefix)
```

## Troubleshooting

### Notification not showing?

1. Check app variant matches release type
2. Verify version in package.json is lower than latest release
3. Clear dismissed version:
   ```typescript
   await githubUpdateService.clearDismissed();
   ```
4. Check console for errors (GitHub API issues)

### Network errors?

The service handles network failures gracefully:
- Logs errors to console (for debugging)
- Returns `isAvailable: false`
- Doesn't crash or show error UI
- Will retry on next check (after 1 hour)

## Best Practices

### Creating Releases

When publishing a new version:

1. **Update version** in `package.json`
2. **Create GitHub release** with:
   - Tag: `v1.0.2` (semantic version with 'v' prefix)
   - Title: Clear version name
   - Description: Well-formatted release notes
   - Assets: Include APK file
   - Prerelease: Check for beta versions

3. **Users get notified** within 1 hour

### Release Notes

Format release notes for readability:
- Use markdown formatting
- Keep it concise (first 300 chars shown)
- Highlight important changes
- Group by category (Features, Bug Fixes, etc.)

Example:
```markdown
# What's New in v1.0.2

## Features
- Added automatic update notifications
- Improved grade calculator

## Bug Fixes
- Fixed crash on startup
- Resolved notification timing issues

## Performance
- Faster app launch
- Reduced memory usage
```

## Security

### Security Measures

- ✅ No API keys required
- ✅ HTTPS-only GitHub API
- ✅ Safe AsyncStorage usage
- ✅ No eval() or dynamic code
- ✅ Sanitized version strings
- ✅ Rate limiting to prevent abuse

### CodeQL Analysis

The feature has been analyzed by CodeQL and shows:
- **0 security vulnerabilities**
- **0 code quality issues**
- **Safe networking patterns**

## API Reference

### GitHubUpdateService

```typescript
class GitHubUpdateService {
  // Check for available updates
  async checkForUpdate(): Promise<UpdateInfo>
  
  // Dismiss a specific version
  async dismissUpdate(version: string): Promise<void>
  
  // Clear dismissed version (for testing)
  async clearDismissed(): Promise<void>
  
  // Get current app variant
  getAppVariant(): string
}
```

### UpdateInfo Interface

```typescript
interface UpdateInfo {
  isAvailable: boolean;
  release?: GitHubRelease;
  currentVersion: string;
  latestVersion: string;
}
```

### GitHubRelease Interface

```typescript
interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}
```

## Future Enhancements

Potential improvements:
- [ ] Auto-download and install (with permission)
- [ ] Download progress indicator
- [ ] Update history viewer
- [ ] Preference to disable update checks
- [ ] iOS TestFlight integration
- [ ] Silent background updates
- [ ] Update size estimation

## Credits

Implemented following the app's existing design patterns from `LoginNotification.tsx` and `UpdateNotification.tsx`.

---

**Last Updated**: November 2025
**Version**: 1.0.0
**Maintainer**: PlannerITI Development Team
