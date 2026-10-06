import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaUserRepository } from 'infrastructure/identity/repositories/PrismaUserRepository';
import { BcryptPasswordService } from 'infrastructure/identity/services/BcryptPasswordService';
import { JwtTokenService } from 'infrastructure/identity/services/JwtTokenService';
import { TotpTwoFactorCodes } from 'infrastructure/identity/services/TotpTwoFactorCodes';
import { HashedRecoveryCodes } from 'infrastructure/identity/services/HashedRecoveryCodes';
import { AesSecretCipher } from 'infrastructure/identity/services/AesSecretCipher';
import { SignInSteps } from 'application/identity/services/SignInSteps';
import { NewSignInWarning } from '../../../../src/application/identity/services/NewSignInWarning';
import { FakeEmailSender } from '../../helpers/FakeEmailSender';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';

export function makeAdapters(prisma: PrismaClient) {
  const users = new PrismaUserRepository(prisma);
  const tokens = new JwtTokenService();
  const emails = new FakeEmailSender();
  const logger = new WinstonLogger();
  return {
    users,
    passwords: new BcryptPasswordService(),
    tokens,
    signInSteps: new SignInSteps(users, tokens),
    twoFactorCodes: new TotpTwoFactorCodes(),
    recoveryCodes: new HashedRecoveryCodes(),
    cipher: new AesSecretCipher(),
    emails,
    newSignInWarning: new NewSignInWarning(emails, logger),
    logger
  };
}
