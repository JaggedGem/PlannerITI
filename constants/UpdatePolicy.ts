import type { UpdatePolicy } from '@/services/nativeUpdateClient';

// Explicit release policy. Select 'immediate' only for a designated critical release.
// Google Play presents consent directly; ordinary releases remain optional and cancellable.
export const NATIVE_UPDATE_POLICY: UpdatePolicy = 'flexible';
