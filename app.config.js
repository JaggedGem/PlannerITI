const config = require('./app.json');

// Read environment variables set in eas.json
module.exports = () => {
  const appVariant = process.env.APP_VARIANT || 'production';
  const androidPackage = process.env.ANDROID_PACKAGE || 'me.jagged.planneriti';
  const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER || 'me.jagged.planneriti';
  
  // Add your API keys here from environment variables
  const apiKey = process.env.API_KEY;
  const gravatarApiKey = process.env.GRAVATAR_API_KEY;

  // Validate required environment variables
  if (!apiKey) {
    throw new Error('API_KEY environment variable is required');
  }

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
  }[appVariant] || variantConfig.production;

  return {
    ...config,
    expo: {
      ...config.expo,
      android: {
        ...config.expo.android,
        package: variantConfig.androidPackage,
      },
      ios: {
        ...config.expo.ios,
        bundleIdentifier: variantConfig.iosBundleIdentifier,
      },
      extra: {
        ...config.expo.extra,
        apiKey,
        gravatarApiKey,
        environment: appVariant,
      },
    },
  };
};