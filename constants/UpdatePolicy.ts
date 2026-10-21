import type { UpdatePolicy } from '@/services/nativeUpdateClient';

// Explicit release policy. Select 'immediate' only for a designated critical release.
// This selects the flow after the user taps Update; ordinary releases remain optional.
export const NATIVE_UPDATE_POLICY: UpdatePolicy = 'flexible';
