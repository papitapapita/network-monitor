import { Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { User } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { ILogger } from 'application/shared/interfaces';
import { SessionResponseDTO } from '../dtos/TwoFactorDTOs';
import {
  ChallengeKind,
  ITokenService
} from '../interfaces/ITokenService';
import { UserMapper } from '../mappers/UserMapper';

export const SIGN_IN_STEP_EXPIRED = 'Sign-in step expired';
export const INVALID_CODE = 'Invalid code';

// The steps between a right password and a session (IDN-166, IDN-167).
export class SignInSteps {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenService: ITokenService
  ) {}

  public challenge(user: User): {
    twoFactor: 'verify' | 'setup';
    challengeToken: string;
  } {
    const kind: ChallengeKind = user.hasTwoFactor
      ? 'two-factor'
      : 'two-factor-setup';
    return {
      twoFactor: user.hasTwoFactor ? 'verify' : 'setup',
      challengeToken: this.tokenService.signChallenge({
        userId: user.id.toString(),
        tokenVersion: user.tokenVersion,
        kind
      })
    };
  }

  // The account must still stand behind the challenge, as a session must
  // behind its token (IDN-065).
  public async open(
    token: string,
    kind: ChallengeKind
  ): Promise<Result<User>> {
    const verified = this.tokenService.verifyChallenge(token, kind);
    if (verified.isFailure) return Result.fail(SIGN_IN_STEP_EXPIRED);

    const id = UserId.parse(verified.value.userId);
    if (id.isFailure) return Result.fail(SIGN_IN_STEP_EXPIRED);

    const found = await this.userRepository.findById(id.value);
    if (found.isFailure) {
      return Result.fail(`Failed to look up user: ${found.error}`);
    }
    const user = found.value;
    if (
      !user ||
      user.isDisabled ||
      user.tokenVersion !== verified.value.tokenVersion ||
      (kind === 'two-factor' && !user.hasTwoFactor)
    ) {
      return Result.fail(SIGN_IN_STEP_EXPIRED);
    }
    return Result.ok(user);
  }

  public session(
    user: User,
    rememberBrowser = false
  ): SessionResponseDTO {
    const session: SessionResponseDTO = {
      token: this.tokenService.sign({
        userId: user.id.toString(),
        email: user.email.toString(),
        role: user.role.toString(),
        tokenVersion: user.tokenVersion
      }),
      user: UserMapper.toDTO(user)
    };
    if (rememberBrowser) {
      session.trustedBrowserToken = this.tokenService.signChallenge({
        userId: user.id.toString(),
        tokenVersion: user.tokenVersion,
        kind: 'trusted-browser'
      });
    }
    return session;
  }

  // Bound to the token version, so whatever ends the account's sessions
  // forgets its browsers too (IDN-171).
  public remembers(user: User, trustedBrowserToken: string): boolean {
    if (!user.hasTwoFactor) return false;
    const verified = this.tokenService.verifyChallenge(
      trustedBrowserToken,
      'trusted-browser'
    );
    return (
      verified.isSuccess &&
      verified.value.userId === user.id.toString() &&
      verified.value.tokenVersion === user.tokenVersion
    );
  }

  // A wrong code counts like a wrong password (IDN-044). A counter that fails
  // to save must not change the answer.
  public async recordFailure(
    user: User,
    sourceIp: string | null,
    logger: ILogger
  ): Promise<void> {
    if (user.recordFailedSignIn(new Date(), sourceIp).isFailure)
      return;
    const saved = await this.userRepository.save(user);
    if (saved.isFailure) {
      logger.error(
        'SignInSteps: sign-in counter not saved',
        undefined,
        {
          userId: user.id.toString(),
          error: saved.error
        }
      );
    }
  }
}

// Kept out of the requests and answers the base UseCase logs.
const SECRET_FIELDS = [
  'password',
  'challengeToken',
  'code',
  'recoveryCode',
  'trustedBrowserToken',
  'token',
  'recoveryCodes',
  'secret',
  'otpauthUri'
];

export function withoutSignInSecrets(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  return Object.fromEntries(
    Object.entries(data).filter(
      ([key]) => !SECRET_FIELDS.includes(key)
    )
  );
}
