import { parseAuthResponse, parseUserData } from './authData';

it('accepts both supported token field names', () => {
  expect(parseAuthResponse({ access_token: 'one' }).access_token).toBe('one');
  expect(parseAuthResponse({ token: 'two' }).token).toBe('two');
});

it.each([null, [], { access_token: 42 }, { token: {} }])(
  'rejects invalid authentication data: %j',
  (value) => {
    expect(() => parseAuthResponse(value)).toThrow('Invalid authentication response');
  },
);

it('validates user profiles without accepting arbitrary extra fields', () => {
  expect(
    parseUserData({ email: 'student@example.com', is_verified: true, extra: 'ignored' }),
  ).toEqual({ email: 'student@example.com', is_verified: true });
  expect(() => parseUserData({ email: 'student@example.com', is_verified: 'false' })).toThrow(
    'Invalid user profile',
  );
});
