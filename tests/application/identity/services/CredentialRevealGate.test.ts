// Source: src/application/identity/services/CredentialRevealGate.ts

import {
  CREDENTIAL_REVEAL_LOCKED,
  CredentialRevealGate
} from '../../../../src/application/identity/services/CredentialRevealGate';
import {
  ChallengePayload,
  ITokenService
} from '../../../../src/application/identity/interfaces/ITokenService';
import { Result } from '../../../../src/domain/shared/core/Result';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { makeUser, makeUserRepo } from '../use-cases/userFixtures';

describe('[IDN-086] CredentialRevealGate', () => {
  const build = (
    users: User[],
    verified: Result<ChallengePayload>
  ) => {
    const tokens: jest.Mocked<ITokenService> = {
      sign: jest.fn(),
      verify: jest.fn(),
      signChallenge: jest.fn(),
      verifyChallenge: jest.fn().mockReturnValue(verified)
    };
    return {
      gate: new CredentialRevealGate(makeUserRepo(users), tokens),
      tokens
    };
  };

  const unlockOf = (
    user: User,
    tokenVersion = user.tokenVersion
  ): Result<ChallengePayload> =>
    Result.ok({
      userId: user.id.toString(),
      tokenVersion,
      kind: 'credential-reveal'
    });

  it('opens for the account that unlocked it', async () => {
    const user = makeUser();
    const { gate, tokens } = build([user], unlockOf(user));

    const result = await gate.check(
      'reveal.token',
      user.id.toString()
    );

    expect(result.isSuccess).toBe(true);
    expect(tokens.verifyChallenge).toHaveBeenCalledWith(
      'reveal.token',
      'credential-reveal'
    );
  });

  it('stays locked without a token', async () => {
    const user = makeUser();
    const { gate } = build([user], unlockOf(user));

    expect((await gate.check(null, user.id.toString())).error).toBe(
      CREDENTIAL_REVEAL_LOCKED
    );
  });

  it('stays locked on an expired or forged token', async () => {
    const user = makeUser();
    const { gate } = build(
      [user],
      Result.fail('Invalid or expired token')
    );

    expect(
      (await gate.check('reveal.token', user.id.toString())).error
    ).toBe(CREDENTIAL_REVEAL_LOCKED);
  });

  it("stays locked on another user's unlock", async () => {
    const owner = makeUser('OPERATOR', 'owner@isp.example');
    const other = makeUser('OPERATOR', 'other@isp.example');
    const { gate } = build([owner, other], unlockOf(owner));

    expect(
      (await gate.check('reveal.token', other.id.toString())).error
    ).toBe(CREDENTIAL_REVEAL_LOCKED);
  });

  it('[IDN-065] stays locked once the account ended its sessions', async () => {
    const user = makeUser();
    const { gate } = build([user], unlockOf(user, 0));
    user.changePassword('$2b$10$new');

    expect(
      (await gate.check('reveal.token', user.id.toString())).error
    ).toBe(CREDENTIAL_REVEAL_LOCKED);
  });

  it('[IDN-013] stays locked for a disabled account', async () => {
    const user = makeUser();
    const { gate } = build([user], unlockOf(user));
    user.disable();

    expect(
      (await gate.check('reveal.token', user.id.toString())).error
    ).toBe(CREDENTIAL_REVEAL_LOCKED);
  });
});
