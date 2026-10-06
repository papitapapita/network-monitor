import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaUserRepository } from 'infrastructure/identity/repositories/PrismaUserRepository';
import { BcryptPasswordService } from 'infrastructure/identity/services/BcryptPasswordService';
import { JwtTokenService } from 'infrastructure/identity/services/JwtTokenService';
import { TotpTwoFactorCodes } from 'infrastructure/identity/services/TotpTwoFactorCodes';
import { HashedRecoveryCodes } from 'infrastructure/identity/services/HashedRecoveryCodes';
import { AesSecretCipher } from 'infrastructure/identity/services/AesSecretCipher';
import { SignInSteps } from 'application/identity/services/SignInSteps';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';

export function makeAdapters(prisma: PrismaClient) {
  const users = new PrismaUserRepository(prisma);
  const tokens = new JwtTokenService();
  return {
    users,
    passwords: new BcryptPasswordService(),
    tokens,
    signInSteps: new SignInSteps(users, tokens),
    twoFactorCodes: new TotpTwoFactorCodes(),
    recoveryCodes: new HashedRecoveryCodes(),
    cipher: new AesSecretCipher(),
    logger: new WinstonLogger()
  };
}
