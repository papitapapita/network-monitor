import { PrismaClient } from '../../../src/generated/prisma/client';
import { DeviceId } from '../../../src/domain/shared/ids';
import { PrismaDeviceCredentialsRepository } from '../../../src/infrastructure/persistence/PrismaDeviceCredentialsRepository';
import { seedDeviceModel } from './db';

// A MikroTik GATEWAY in service, with its login saved through the repository
// (the stored password is encrypted, so raw Prisma would not read back).
export async function seedMainRouter(
  prisma: PrismaClient,
  opts: {
    name: string;
    ip: string | null;
    login: {
      username: string;
      password: string;
      apiPort: number;
    } | null;
    category?: 'GATEWAY' | 'ACCESS_POINT';
    status?: 'ACTIVE' | 'COMMISSIONING' | 'INVENTORY';
    agentId?: string | null;
    deviceModelId?: string;
  }
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: opts.name,
      owner: 'COMPANY',
      status: opts.status ?? 'ACTIVE',
      category: opts.category ?? 'GATEWAY',
      ipAddress: opts.ip,
      agentId: opts.agentId ?? null,
      deviceModelId:
        opts.deviceModelId ?? (await seedDeviceModel(prisma))
    }
  });

  if (opts.login) {
    const saved = await new PrismaDeviceCredentialsRepository(
      prisma
    ).save(DeviceId.parse(device.id).value, {
      snmpVersion: 2,
      snmpCommunity: null,
      snmpV3AuthUser: null,
      snmpV3AuthProto: null,
      snmpV3AuthKey: null,
      snmpV3PrivProto: null,
      snmpV3PrivKey: null,
      httpUsername: opts.login.username,
      httpPassword: opts.login.password,
      snmpPort: 161,
      httpPort: 443,
      sshPort: 22,
      apiPort: opts.login.apiPort
    });
    if (saved.isFailure) throw new Error(saved.error);
  }
  return device.id;
}
