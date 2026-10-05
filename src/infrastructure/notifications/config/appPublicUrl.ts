// Where the operator's phone opens the dashboard, so a device alert can link
// straight to the device (NOT-103). Unset leaves the link out; a malformed
// value stops the boot, since every alert would carry a broken link.
export function loadAppPublicUrl(
  env: NodeJS.ProcessEnv
): string | null {
  const raw = env.APP_PUBLIC_URL?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`APP_PUBLIC_URL is not a valid URL: "${raw}"`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('APP_PUBLIC_URL must be an http(s) URL');
  }
  if (url.search || url.hash) {
    throw new Error(
      'APP_PUBLIC_URL must not carry a query or fragment, e.g. https://app.example.com'
    );
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}
