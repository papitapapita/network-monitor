export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

// Unset SMTP_HOST leaves the install without email (IDN-180); once it is set,
// a missing piece stops the boot rather than failing every message later.
export function loadSmtpConfig(
  env: NodeJS.ProcessEnv
): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(env.SMTP_PORT?.trim() || '587');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `SMTP_PORT is not a valid port: "${env.SMTP_PORT}"`
    );
  }

  const missing = ['SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].filter(
    (name) => !env[name]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `SMTP_HOST is set, so ${missing.join(', ')} must be set too`
    );
  }

  return {
    host,
    port,
    user: env.SMTP_USER!.trim(),
    password: env.SMTP_PASSWORD!.trim(),
    from: env.SMTP_FROM!.trim()
  };
}
