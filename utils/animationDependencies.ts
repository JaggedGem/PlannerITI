import { Platform } from 'react-native';

// Reanimated 4.7 ignores explicit dependencies on native; web still needs them without the Babel plugin.
export const getAnimationDependencies = <T>(dependencies: T): T | undefined =>
  Platform.OS === 'web' ? dependencies : undefined;
