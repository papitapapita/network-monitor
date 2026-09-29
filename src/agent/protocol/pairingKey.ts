const PREFIX = 'pk1';

export interface PairingKeyParts {
  backendUrl: string;
  pairingCode: string;
}

// The one string an installer asks for (ADR 0002, R1): where the backend is
// and the one-time code, so the customer configures nothing else. The backend
// formats it and the agent parses it, so both live here.
export function formatPairingKey(parts: PairingKeyParts): string {
  const url = Buffer.from(parts.backendUrl, 'utf8').toString(
    'base64url'
  );
  return `${PREFIX}.${url}.${parts.pairingCode}`;
}

export function parsePairingKey(raw: string): PairingKeyParts | null {
  const segments = raw.trim().split('.');
  if (segments.length !== 3 || segments[0] !== PREFIX) return null;
  const [, encodedUrl, pairingCode] = segments;
  if (!encodedUrl || !pairingCode) return null;

  const backendUrl = Buffer.from(encodedUrl, 'base64url').toString(
    'utf8'
  );
  if (!/^https?:\/\/[^\s]+$/.test(backendUrl)) return null;
  return { backendUrl, pairingCode };
}
