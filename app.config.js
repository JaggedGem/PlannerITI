import "dotenv/config";

// Read environment variables set in eas.json
module.exports = () => {
  const appVariant = process.env.APP_VARIANT || 'production';
  const androidPackage = process.env.ANDROID_PACKAGE || 'me.jagged.planneriti';
  const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER || 'me.jagged.planneriti';

  // Use the environment variables directly - they already have the variant suffix
  const variantConfig = {
    androidPackage,
    iosBundleIdentifier,
  };

  // Set app name based on variant
  const appName = appVariant === 'beta' ? 'PlannerITI Beta' : 
                  appVariant === 'development' ? 'PlannerITI Dev' : 
                  'PlannerITI';

  return {
    expo: {
      name: appName,
      slug: "PlannerITI",
      version: "1.2.0",
      orientation: "portrait",
      icon: "assets/images/icon.png",
      scheme: "myapp",
      userInterfaceStyle: "automatic",
      newArchEnabled: true,
      ios: {
        supportsTablet: true,
        bundleIdentifier: variantConfig.iosBundleIdentifier
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "assets/images/adaptive-icon.png",
          backgroundColor: "#232433"
        },
        package: variantConfig.androidPackage
      },
      plugins: [
        "expo-router",
        [
          "expo-splash-screen",
          {
            "image": "assets/images/splash-icon.png",
            "imageWidth": 200,
            "resizeMode": "contain",
            "backgroundColor": "#232433"
          }
        ]
      ],
      experiments: {
        typedRoutes: true
      },
      extra: {
        router: {
          origin: false
        },
        eas: {
          projectId: "fe01b043-f283-48db-a683-3c5f23546a96"
        },
        environment: appVariant,
        gravatarApiKey: process.env.GRAVATAR_API_KEY,
        apiKey: process.env.API_KEY
      },
      owner: "planneriti",
      runtimeVersion: "1.2.0",
      updates: {
        url: "https://u.expo.dev/fe01b043-f283-48db-a683-3c5f23546a96"
      }
    }
  };
};