import React, { useEffect } from 'react';
import * as Updates from 'expo-updates';

export default function UpdateNotification() {
  useEffect(() => {
    // Only check for updates in production mode
    if (Updates.channel !== 'development') {
      // Use setTimeout to ensure it doesn't impact startup times
      setTimeout(() => {
        silentlyCheckAndApplyUpdates();
      }, 1000);
    }
  }, []);

  // Silent update check and application
  const silentlyCheckAndApplyUpdates = async () => {
    try {
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        try {
          await Updates.fetchUpdateAsync();
          // Quietly apply the update next time the app is launched
          await Updates.reloadAsync();
        } catch (error) {
          // Silently fail - user doesn't need to know about update failures
        }
      }
    } catch (error) {
      // Silently fail - user doesn't need to know about update check failures
    }
  };

  // Component doesn't render anything visible
  return null;
}