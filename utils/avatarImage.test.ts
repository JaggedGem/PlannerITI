import { getAvatarImageUrl } from './avatarImage';

it('bounds Gravatar image requests and preserves the remaining cacheable URL', () => {
  expect(getAvatarImageUrl('https://www.gravatar.com/avatar/hash?d=mp&size=2048&s=2048')).toBe(
    'https://www.gravatar.com/avatar/hash?d=mp&s=192',
  );
  expect(getAvatarImageUrl('https://gravatar.com/avatar/hash')).toBe(
    'https://gravatar.com/avatar/hash?s=192',
  );
});

it('does not rewrite signed URLs from other image providers', () => {
  const source = 'https://cdn.example.com/avatar.jpg?size=512&signature=abc';
  expect(getAvatarImageUrl(source)).toBe(source);
  expect(getAvatarImageUrl('https://gravatar.com.example.com/avatar?size=2048')).toContain(
    'size=2048',
  );
});
