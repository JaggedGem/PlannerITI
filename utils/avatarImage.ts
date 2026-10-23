/** Ask Gravatar for a small, stable image; other providers keep their original URLs. */
export function getAvatarImageUrl(source: string): string {
  try {
    const url = new URL(source);
    if (url.hostname === 'gravatar.com' || url.hostname.endsWith('.gravatar.com')) {
      url.searchParams.delete('size');
      url.searchParams.set('s', '192');
      return url.toString();
    }
  } catch {
    // Metadata validation rejects invalid URLs; tolerate legacy cached values here.
  }
  return source;
}
