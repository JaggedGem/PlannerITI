import 'dotenv/config';

// Read environment variables set in eas.json
module.exports = () => {
    const appVariant = process.env.APP_VARIANT || 'production';
    const androidPackage =
        process.env.ANDROID_PACKAGE || 'site.jagged.planneriti';
    const iosBundleIdentifier =
        process.env.IOS_BUNDLE_IDENTIFIER || 'site.jagged.planneriti';

    // Use the environment variables directly - they already have the variant suffix
    const variantConfig = {
        androidPackage,
        iosBundleIdentifier,
    };

    // Set app name based on variant
    const appName =
        appVariant === 'beta' ? 'PlannerITI Beta'
        : appVariant === 'development' ? 'PlannerITI Dev'
        : 'PlannerITI';

    return {
        expo: {
            name: appName,
            slug: 'PlannerITI',
            version: '1.4.0',
            orientation: 'portrait',
            icon: 'assets/images/ios-light.png',
            scheme: 'myapp',
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
                customApiLocalUrl: process.env.CUSTOM_API_LOCAL_URL || '',
                customApiLocalHost: process.env.CUSTOM_API_LOCAL_HOST || '',
                customApiLocalPort: process.env.CUSTOM_API_LOCAL_PORT || '5000',
                gravatarApiKey: process.env.GRAVATAR_API_KEY,
                apiKey: process.env.API_KEY,
            },
            owner: 'planneriti',
            runtimeVersion: process.env.RUNTIME_VERSION || '1.4.0',
            updates: {
                url: 'https://u.expo.dev/fe01b043-f283-48db-a683-3c5f23546a96',
            },
        },
    };
};
