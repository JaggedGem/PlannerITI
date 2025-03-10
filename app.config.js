const config = require('./app.json');

// Read environment variables set in eas.json
module.exports = () => {
  const appVariant = process.env.APP_VARIANT || 'production';
  const androidPackage = process.env.ANDROID_PACKAGE || 'me.jagged.planneriti';
  const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER || 'me.jagged.planneriti';
  
  // Add your API keys here from environment variables
  const apiKey = process.env.API_KEY || '';
  const apiUrl = process.env.API_URL || '';
  // Add other environment variables as needed

  console.log(`Building app variant: ${appVariant}`);
  console.log(`Using Android package: ${androidPackage}`);
  console.log(`Using iOS bundle identifier: ${iosBundleIdentifier}`);

  return {
    ...config,
    expo: {
      ...config.expo,
      android: {
        ...config.expo.android,
        package: androidPackage,
      },
      ios: {
        ...config.expo.ios,
        bundleIdentifier: iosBundleIdentifier,
      },
      extra: {
        ...config.expo.extra,
        apiKey,
        apiUrl,
        // Add other environment variables as needed
      },
    },
  };
};