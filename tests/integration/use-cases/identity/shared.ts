import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaUserRepository } from 'infrastructure/identity/repositories/PrismaUserRepository';
import { BcryptPasswordService } from 'infrastructure/identity/services/BcryptPasswordService';
import { JwtTokenService } from 'infrastructure/identity/services/JwtTokenService';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';

export function makeAdapters(prisma: PrismaClient) {
  return {
    users: new PrismaUserRepository(prisma),
    passwords: new BcryptPasswordService(),
    tokens: new JwtTokenService(),
    logger: new WinstonLogger()
  };
}
