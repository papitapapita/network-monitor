// The address agents use to reach this backend, baked into every pairing key
// (ADR 0002, R1/R20). Unset leaves pairing unavailable rather than stopping
// the boot, so an install that runs no agents needs no change; a malformed
// value does stop it, since every key issued with it would be useless.
export function loadAgentPublicUrl(
  env: NodeJS.ProcessEnv
): string | null {
  const raw = env.AGENT_PUBLIC_URL?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`AGENT_PUBLIC_URL is not a valid URL: "${raw}"`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('AGENT_PUBLIC_URL must be an http(s) URL');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(
      'AGENT_PUBLIC_URL must be an origin only, e.g. https://api.example.com'
    );
  }
  return url.origin;
}
