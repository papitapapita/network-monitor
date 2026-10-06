// The dashboards allowed to call the API from a browser: CORS answers them,
// and a cookie-signed change must come from one of them (IDN-085).
export function loadAllowedOrigins(env: NodeJS.ProcessEnv): string[] {
  return (env.ALLOWED_ORIGINS || 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
