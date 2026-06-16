import 'dotenv/config';

// Read environment variables set in eas.json
module.exports = () => {
  const appVariant = process.env.APP_VARIANT || 'production';
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

  const widgetConfig = {
    fonts: ['./assets/fonts/SpaceMono-Regular.ttf'],
    widgets: [
      {
        name: 'TodayGlance',
        label: 'Today at a Glance',
        minWidth: '320dp',
        minHeight: '180dp',
        targetCellWidth: 4,
        targetCellHeight: 3,
        description: 'Your entire day in one snapshot',
        previewImage: './assets/widget-preview/today-glance.png',
        updatePeriodMillis: 1800000,
      },
      {
        name: 'AssignmentPressure',
        label: 'Assignments Pressure',
        minWidth: '250dp',
        minHeight: '150dp',
        targetCellWidth: 3,
        targetCellHeight: 3,
        description: 'Priority assignments at a glance',
        previewImage: './assets/widget-preview/assignment-pressure.png',
        updatePeriodMillis: 1800000,
      },
      {
        name: 'GradeImpact',
        label: 'Grade Impact',
        minWidth: '250dp',
        minHeight: '150dp',
        targetCellWidth: 3,
        targetCellHeight: 3,
        description: 'Grades and what you need next',
        previewImage: './assets/widget-preview/grade-impact.png',
        updatePeriodMillis: 3600000,
      },
      {
        name: 'Countdown',
        label: 'Next Class Countdown',
        minWidth: '200dp',
        minHeight: '100dp',
        targetCellWidth: 2,
        targetCellHeight: 2,
        description: 'Countdown to your next class',
        previewImage: './assets/widget-preview/countdown.png',
        updatePeriodMillis: 60000,
      },
      {
        name: 'Notifications',
        label: 'Smart Reminders',
        minWidth: '250dp',
        minHeight: '150dp',
        targetCellWidth: 3,
        targetCellHeight: 2,
        description: 'Upcoming reminders and deadlines',
        previewImage: './assets/widget-preview/notifications.png',
        updatePeriodMillis: 1800000,
      },
      {
        name: 'EndOfDay',
        label: 'Day Summary',
        minWidth: '250dp',
        minHeight: '150dp',
        targetCellWidth: 3,
        targetCellHeight: 2,
        description: 'End of day reflection',
        previewImage: './assets/widget-preview/end-of-day.png',
        updatePeriodMillis: 3600000,
      },
      {
        name: 'ExamAlert',
        label: 'Exam Alert',
        minWidth: '200dp',
        minHeight: '100dp',
        targetCellWidth: 2,
        targetCellHeight: 2,
        description: 'Next exam countdown',
        previewImage: './assets/widget-preview/exam-alert.png',
        updatePeriodMillis: 3600000,
      },
    ],
  };

  return {
    expo: {
      name: appName,
      slug: 'PlannerITI',
      version: '1.5.0',
      orientation: 'portrait',
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
            android: { usePrecompiledHeaders: true },
          },
        ],
        ['react-native-android-widget', widgetConfig],
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
        apiKey: process.env.API_KEY || '',
        customApiLocalUrl: process.env.CUSTOM_API_LOCAL_URL || '',
        customApiLocalHost: process.env.CUSTOM_API_LOCAL_HOST || '',
        customApiLocalPort: process.env.CUSTOM_API_LOCAL_PORT || '5000',
      },
      owner: 'planneriti',
      runtimeVersion: process.env.RUNTIME_VERSION || '1.5.0',
      updates: {
        url: 'https://u.expo.dev/fe01b043-f283-48db-a683-3c5f23546a96',
      },
    },
  };
};
