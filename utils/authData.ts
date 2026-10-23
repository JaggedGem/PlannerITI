import type { AuthResponse, UserData } from '@/types/auth';

import { isRecord } from './json';

export const parseAuthResponse = (value: unknown): AuthResponse => {
  if (!isRecord(value)) throw new Error('Invalid authentication response');
  for (const field of ['token', 'access_token', 'message'] as const) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      throw new Error('Invalid authentication response');
    }
  }
  return {
    token: typeof value.token === 'string' ? value.token : undefined,
    access_token: typeof value.access_token === 'string' ? value.access_token : undefined,
    message: typeof value.message === 'string' ? value.message : undefined,
  };
};

export const parseUserData = (value: unknown): UserData => {
  if (
    !isRecord(value) ||
    typeof value.email !== 'string' ||
    typeof value.is_verified !== 'boolean'
  ) {
    throw new Error('Invalid user profile');
  }
  return {
    email: value.email,
    is_verified: value.is_verified,
    idnp: typeof value.idnp === 'string' ? value.idnp : undefined,
  };
};
