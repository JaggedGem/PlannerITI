import "dotenv/config";

const GRAVATAR_API_KEY = process.env.GRAVATAR_API_KEY;
const API_KEY = process.env.API_KEY;

// Read environment variables set in eas.json
module.exports = () => {
  const appVariant = process.env.APP_VARIANT || 'production';
  const androidPackage = process.env.ANDROID_PACKAGE || 'me.jagged.planneriti';
  const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER || 'me.jagged.planneriti';

  // Configure variant-specific settings
  const variantConfig = {
    production: {
      androidPackage,
      iosBundleIdentifier,
    },
    development: {
      androidPackage: `${androidPackage}.dev`,
      iosBundleIdentifier: `${iosBundleIdentifier}.dev`,
    },
    beta: {
      androidPackage: `${androidPackage}.beta`,
      iosBundleIdentifier: `${iosBundleIdentifier}.beta`,
    },
  }[appVariant] || variantConfig.production;

  return {
    expo: {
      name: "PlannerITI",
      slug: "PlannerITI",
      version: "1.0.1",
      orientation: "portrait",
      icon: "assets/images/icon.png",
      scheme: "myapp",
      userInterfaceStyle: "automatic",
      newArchEnabled: true,
      ios: {
        supportsTablet: true,
        bundleIdentifier: variantConfig.iosBundleIdentifier,
        buildNumber: "2"
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "assets/images/adaptive-icon.png",
          backgroundColor: "#232433"
        },
        package: variantConfig.androidPackage,
        versionCode: 2
      },
      web: {
        bundler: "metro",
        output: "static",
        favicon: "assets/images/favicon.png"
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
      runtimeVersion: "appVersion",
      updates: {
        url: "https://u.expo.dev/fe01b043-f283-48db-a683-3c5f23546a96"
      }
    }
  };
};