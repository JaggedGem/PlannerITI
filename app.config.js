import 'dotenv/config';

// Read environment variables set in eas.json
module.exports = () => {
  const appVariant = process.env.APP_VARIANT || 'production';
  const { version: appVersion } = require('./package.json');
  const androidPackage = process.env.ANDROID_PACKAGE || 'site.jagged.planneriti';
  const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER || 'site.jagged.planneriti';

  // Use the environment variables directly - they already have the variant suffix
  const variantConfig = {
    androidPackage,
    iosBundleIdentifier,
  };

  // Set app name based on variant
  const appName =
    appVariant === 'beta'
      ? 'PlannerITI Beta'
      : appVariant === 'development'
        ? 'PlannerITI Dev'
        : 'PlannerITI';

  return {
    expo: {
      name: appName,
      slug: 'PlannerITI',
      version: appVersion,
      orientation: 'default',
      icon: 'assets/images/ios-light.png',
      scheme: 'planneriti',
      userInterfaceStyle: 'automatic',
      jsEngine: 'hermes',
      newArchEnabled: true,
      ios: {
        icon: {
          light: 'assets/images/ios-light.png',
          dark: 'assets/images/ios-dark.png',
          tinted: 'assets/images/ios-tinted.png',
        },
        supportsTablet: true,
        bundleIdentifier: variantConfig.iosBundleIdentifier,
      },
      android: {
        adaptiveIcon: {
          foregroundImage: 'assets/images/adaptive-icon.png',
          backgroundColor: '#232433',
        },
        package: variantConfig.androidPackage,
      },
      plugins: [
        'expo-router',
        'expo-font',
        'expo-image',
        'expo-secure-store',
        'expo-sharing',
        'expo-status-bar',
        'expo-navigation-bar',
        [
          'expo-splash-screen',
          {
            image: 'assets/images/ios-dark.png',
            imageWidth: 200,
            resizeMode: 'contain',
            backgroundColor: '#05060f',
          },
        ],
        [
          'expo-build-properties',
          {
            android: {
              usePrecompiledHeaders: true,
              enableMinifyInReleaseBuilds: true,
              enableShrinkResourcesInReleaseBuilds: true,
              // rnforge 1.0.2 looks this class up by name from JNI but omits @Keep/consumer rules.
              extraProguardRules: '-keep class dev.rnforge.inappupdates.HybridInAppUpdates { *; }',
            },
          },
        ],
      ],
      experiments: {
        typedRoutes: true,
      },
      extra: {
        router: {
          origin: false,
        },
        eas: {
          projectId: 'fe01b043-f283-48db-a683-3c5f23546a96',
        },
        environment: appVariant,
        // Displayed release can advance through OTA without changing the native version/runtime.
        releaseVersion: process.env.RELEASE_VERSION?.trim() || appVersion,
        // Beta has a different package and needs its own Play listing/testing setup.
        betaPlayUpdatesEnabled: process.env.BETA_PLAY_UPDATES_ENABLED === 'true',
        apiKey: process.env.API_KEY || '',
        customApiLocalUrl: process.env.CUSTOM_API_LOCAL_URL || '',
        customApiLocalHost: process.env.CUSTOM_API_LOCAL_HOST || '',
        customApiLocalPort: process.env.CUSTOM_API_LOCAL_PORT || '5000',
      },
      owner: 'planneriti',
      // A native release starts a new runtime; compatible OTAs keep its runtime unchanged.
      runtimeVersion: process.env.RUNTIME_VERSION || appVersion,
      updates: {
        // The JS coordinator owns checks/downloads; Expo still selects cached updates on cold start.
        checkAutomatically: 'NEVER',
        url: 'https://u.expo.dev/fe01b043-f283-48db-a683-3c5f23546a96',
      },
    },
  };
};
