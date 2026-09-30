import bcrypt from 'bcrypt';
import { PrismaClient } from '../../../../src/generated/prisma/client';
import { EnsureVendorAccountUseCase } from 'application/identity/use-cases/EnsureVendorAccountUseCase';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { PrismaUserRepository } from 'infrastructure/identity/repositories/PrismaUserRepository';
import { BcryptPasswordService } from 'infrastructure/identity/services/BcryptPasswordService';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { seedUser } from '../../helpers/auth';

const EMAIL = 'owner@isp.example';
const PASSWORD = 'vendor-integration-pass';

describe('EnsureVendorAccountUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: EnsureVendorAccountUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new EnsureVendorAccountUseCase(
      new PrismaUserRepository(prisma),
      new BcryptPasswordService(),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  const row = () =>
    prisma.user.findUnique({ where: { email: EMAIL } });

  it('[IDN-011] creates the vendor account with a working password', async () => {
    const result = await useCase.execute({
      email: EMAIL,
      password: PASSWORD
    });

    expect(result.value.outcome).toBe('created');
    const user = await row();
    expect(user!.role).toBe('VENDOR');
    expect(await bcrypt.compare(PASSWORD, user!.passwordHash)).toBe(
      true
    );
  });

  it('[IDN-011] promotes an existing ADMIN and keeps its password', async () => {
    await seedUser(prisma, EMAIL, 'the-owners-own-pass', 'ADMIN');

    const result = await useCase.execute({
      email: EMAIL,
      password: PASSWORD
    });

    expect(result.value.outcome).toBe('promoted');
    const user = await row();
    expect(user!.role).toBe('VENDOR');
    expect(
      await bcrypt.compare('the-owners-own-pass', user!.passwordHash)
    ).toBe(true);
  });

  it('[IDN-011] is a no-op on every later boot', async () => {
    await useCase.execute({ email: EMAIL, password: PASSWORD });
    const before = await row();

    const result = await useCase.execute({ email: EMAIL });

    expect(result.value.outcome).toBe('unchanged');
    expect((await row())!.updatedAt).toEqual(before!.updatedAt);
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(
      1
    );
  });

  it('[IDN-012] creates nothing without a password', async () => {
    const result = await useCase.execute({ email: EMAIL });

    expect(result.isFailure).toBe(true);
    expect(await row()).toBeNull();
  });
});
