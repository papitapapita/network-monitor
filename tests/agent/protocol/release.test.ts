import { createHash, generateKeyPairSync, sign } from 'crypto';
import {
  AGENT_PLATFORMS,
  RELEASE_PUBLIC_KEY,
  isNewerVersion,
  isReleaseVersion,
  releaseFileName,
  releaseManifestName,
  releaseSignaturePayload,
  verifyReleaseSignature
} from '../../../src/agent/protocol/release';

const keys = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey,
    publicPem: publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString()
  };
};

const SHA = createHash('sha256').update('binary').digest('hex');

const signFor = (
  privateKey: ReturnType<typeof keys>['privateKey'],
  version: string,
  platform: 'win-x64' | 'linux-x64',
  sha256: string
) =>
  sign(
    null,
    Buffer.from(
      releaseSignaturePayload(version, platform, sha256),
      'utf8'
    ),
    privateKey
  ).toString('base64');

describe('agent release format', () => {
  describe('[AGT-080] the signature', () => {
    const { privateKey, publicPem } = keys();
    const signature = signFor(privateKey, '0.2.0', 'win-x64', SHA);

    it('accepts a binary the release key signed', () => {
      expect(
        verifyReleaseSignature(
          '0.2.0',
          'win-x64',
          SHA,
          signature,
          publicPem
        )
      ).toBe(true);
    });

    it('refuses a different binary under the same signature', () => {
      const other = createHash('sha256')
        .update('other')
        .digest('hex');
      expect(
        verifyReleaseSignature(
          '0.2.0',
          'win-x64',
          other,
          signature,
          publicPem
        )
      ).toBe(false);
    });

    it('refuses a signed binary offered as another version', () => {
      expect(
        verifyReleaseSignature(
          '0.1.9',
          'win-x64',
          SHA,
          signature,
          publicPem
        )
      ).toBe(false);
    });

    it('refuses a signed binary offered to the other platform', () => {
      expect(
        verifyReleaseSignature(
          '0.2.0',
          'linux-x64',
          SHA,
          signature,
          publicPem
        )
      ).toBe(false);
    });

    it('refuses a signature from any other key', () => {
      const stranger = keys();
      expect(
        verifyReleaseSignature(
          '0.2.0',
          'win-x64',
          SHA,
          signFor(stranger.privateKey, '0.2.0', 'win-x64', SHA),
          publicPem
        )
      ).toBe(false);
    });

    it('refuses garbage instead of throwing', () => {
      expect(
        verifyReleaseSignature(
          '0.2.0',
          'win-x64',
          SHA,
          'not base64!',
          publicPem
        )
      ).toBe(false);
      expect(
        verifyReleaseSignature(
          '0.2.0',
          'win-x64',
          SHA,
          signature,
          'not a key'
        )
      ).toBe(false);
    });

    it('checks against the shipped release key by default', () => {
      expect(RELEASE_PUBLIC_KEY).toContain('BEGIN PUBLIC KEY');
      expect(
        verifyReleaseSignature('0.2.0', 'win-x64', SHA, signature)
      ).toBe(false);
    });
  });

  describe('[AGT-080] versions', () => {
    it.each([
      ['0.2.0', '0.1.0', true],
      ['0.1.10', '0.1.9', true],
      ['1.0.0', '0.9.9', true],
      ['0.1.0', '0.1.0', false],
      ['0.1.0', '0.2.0', false],
      ['0.2.0-beta', '0.1.0', false],
      ['0.2.0', 'unknown', false]
    ])('%s is newer than %s: %s', (candidate, current, newer) => {
      expect(isNewerVersion(candidate, current)).toBe(newer);
    });

    it('accepts only plain major.minor.patch', () => {
      expect(isReleaseVersion('0.2.0')).toBe(true);
      expect(isReleaseVersion('v0.2.0')).toBe(false);
      expect(isReleaseVersion('0.2')).toBe(false);
    });
  });

  it('[AGT-080] names a release’s files after its version and platform', () => {
    expect(releaseManifestName('0.2.0')).toBe(
      'nms-agent-0.2.0.manifest.json'
    );
    expect(
      AGENT_PLATFORMS.map((p) => releaseFileName('0.2.0', p))
    ).toEqual([
      'nms-agent-0.2.0-win-x64.gz',
      'nms-agent-0.2.0-linux-x64.gz'
    ]);
  });
});
