// Which proxies in front of the backend may name the real client address in
// X-Forwarded-For. Every per-address limit (sign-in, agent enrollment) keys
// on that address: behind Cloudflare Tunnel, without this, every request
// comes from cloudflared and all callers share one bucket.
//
// Unset trusts no proxy, as before. `loopback` fits cloudflared on the same
// machine; a hop count or a comma-separated list of addresses/CIDRs also
// works (Express "trust proxy"). An invalid value stops the boot when Express
// compiles it.
export function loadTrustProxy(
  env: NodeJS.ProcessEnv
): boolean | number | string {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw || raw === 'false') return false;
  if (raw === 'true') {
    throw new Error(
      'TRUST_PROXY=true would let any caller fake its address; name the proxy instead, e.g. TRUST_PROXY=loopback'
    );
  }
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}
