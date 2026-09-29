import { Result } from 'domain/shared/core';

const PREFIX = 'pk1';

export interface PairingKeyParts {
  backendUrl: string;
  pairingCode: string;
}

// The one string an installer asks for (ADR 0002, R1): where the backend is
// and the one-time code, so the customer configures nothing else. Shared by
// the backend (format) and the agent (parse).
export class PairingKey {
  static format(parts: PairingKeyParts): string {
    const url = Buffer.from(parts.backendUrl, 'utf8').toString(
      'base64url'
    );
    return `${PREFIX}.${url}.${parts.pairingCode}`;
  }

  static parse(raw: string): Result<PairingKeyParts> {
    const segments = raw.trim().split('.');
    if (segments.length !== 3 || segments[0] !== PREFIX) {
      return Result.fail('Invalid pairing key format');
    }
    const [, encodedUrl, pairingCode] = segments;
    if (!encodedUrl || !pairingCode) {
      return Result.fail('Invalid pairing key format');
    }

    const backendUrl = Buffer.from(encodedUrl, 'base64url').toString(
      'utf8'
    );
    if (!/^https?:\/\/[^\s]+$/.test(backendUrl)) {
      return Result.fail('Invalid pairing key: bad backend URL');
    }
    return Result.ok({ backendUrl, pairingCode });
  }
}
