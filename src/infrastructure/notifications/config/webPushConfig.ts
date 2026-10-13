export interface WebPushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

// Phone notifications are on only when both VAPID keys are set (NOT-228).
// One key without the other, or a subject the push services would refuse,
// stops the boot rather than failing every alert later.
export function loadWebPushConfig(
  env: NodeJS.ProcessEnv,
  appPublicUrl: string | null
): WebPushConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey && !privateKey) return null;
  if (!publicKey || !privateKey) {
    throw new Error(
      'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together'
    );
  }

  const subject = env.VAPID_SUBJECT?.trim() || appPublicUrl;
  if (
    !subject ||
    !(subject.startsWith('mailto:') || subject.startsWith('https://'))
  ) {
    throw new Error(
      'VAPID_SUBJECT must be a mailto: or https:// contact (or set APP_PUBLIC_URL to an https URL)'
    );
  }
  return { publicKey, privateKey, subject };
}
