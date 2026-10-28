import { PrismaClient } from '../../../src/generated/prisma/client';
import {
  IDiscoveryNotifier,
  NewDevicesNotice
} from '../../../src/application/device-inventory/interfaces';
import { DeviceSightingRecorder } from '../../../src/application/device-inventory/services';
import {
  PrismaDiscoveredDeviceRepository,
  PrismaKnownDeviceLookup
} from '../../../src/infrastructure/persistence';

// Captures the notices instead of filling the inbox.
export class FakeDiscoveryNotifier implements IDiscoveryNotifier {
  notices: NewDevicesNotice[] = [];

  async newDevicesFound(notice: NewDevicesNotice): Promise<void> {
    this.notices.push(notice);
  }

  reset(): void {
    this.notices = [];
  }
}

export function makeSightingRecorder(
  prisma: PrismaClient,
  notifier: IDiscoveryNotifier = new FakeDiscoveryNotifier()
): DeviceSightingRecorder {
  return new DeviceSightingRecorder(
    new PrismaDiscoveredDeviceRepository(prisma),
    new PrismaKnownDeviceLookup(prisma),
    notifier
  );
}

export async function cleanDiscoveredDevices(
  prisma: PrismaClient
): Promise<void> {
  await prisma.discoveredDevice.deleteMany();
}

export async function seedDiscoveredDevice(
  prisma: PrismaClient,
  overrides: {
    macAddress?: string;
    ipAddress?: string | null;
    manufacturer?: string | null;
    lastSeenAt?: Date;
    ignoredAt?: Date | null;
    // A station seen on this AP rather than by a scan.
    accessPointId?: string;
    hostname?: string | null;
    model?: string | null;
  } = {}
): Promise<string> {
  const lastSeenAt = overrides.lastSeenAt ?? new Date();
  const row = await prisma.discoveredDevice.create({
    data: {
      macAddress: overrides.macAddress ?? 'AA:BB:CC:DD:EE:01',
      ipAddress:
        overrides.ipAddress === undefined
          ? '192.168.1.20'
          : overrides.ipAddress,
      manufacturer:
        overrides.manufacturer === undefined
          ? 'Ubiquiti Inc'
          : overrides.manufacturer,
      source: overrides.accessPointId ? 'AP_STATION' : 'SCAN',
      segment: overrides.accessPointId ? null : '192.168.1.0/24',
      accessPointId: overrides.accessPointId ?? null,
      hostname: overrides.hostname ?? null,
      model: overrides.model ?? null,
      firstSeenAt: lastSeenAt,
      lastSeenAt,
      ignoredAt: overrides.ignoredAt ?? null
    }
  });
  return row.id;
}

// A live device owning a MAC and/or IP. Returns its id.
export async function seedOwnedDevice(
  prisma: PrismaClient,
  deviceModelId: string,
  opts: { macAddress?: string; ipAddress?: string; deleted?: boolean }
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: `Owned ${opts.macAddress ?? opts.ipAddress}`,
      status: 'INVENTORY',
      deviceModelId,
      macAddress: opts.macAddress ?? null,
      ipAddress: opts.ipAddress ?? null,
      deletedAt: opts.deleted ? new Date() : null
    }
  });
  return device.id;
}
