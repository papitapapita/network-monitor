// Source: src/infrastructure/persistence/PrismaDeviceListQuery.ts
import { PrismaClient } from '../../../src/generated/prisma/client';
import { PrismaDeviceListQuery } from '../../../src/infrastructure/persistence/PrismaDeviceListQuery';
import { DeviceStatus } from '../../../src/domain/device-inventory/value-objects';
import { unmeasuredDevices } from '../../../src/infrastructure/probe-agents/queries';

const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440001';
const MODEL_ID = '550e8400-e29b-41d4-a716-446655440002';

function makeFakePrismaClient() {
  return {
    device: {
      findMany: jest.fn(),
      count: jest.fn()
    }
  };
}

function makeRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: DEVICE_ID,
    deviceModelId: MODEL_ID,
    locationId: null,
    status: 'ACTIVE',
    category: 'CPE',
    owner: 'COMPANY',
    name: 'Router A',
    serialNumber: 'SN-001',
    macAddress: null,
    ipAddress: '10.0.0.1',
    description: null,
    installedDate: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    monitoringEnabled: true,
    deletedAt: null,
    deletedBy: null,
    replacedAt: null,
    replacesDeviceId: null,
    replacedBy: [],
    deviceState: null,
    ...overrides
  };
}

describe('PrismaDeviceListQuery', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let query: PrismaDeviceListQuery;

  beforeEach(() => {
    prisma = makeFakePrismaClient();
    query = new PrismaDeviceListQuery(
      prisma as unknown as PrismaClient
    );
  });

  function lastFindManyArgs(): Record<string, unknown> {
    return prisma.device.findMany.mock.calls[0][0];
  }

  // =========================================================================
  describe('[DEV-148] connectivity on each item', () => {
    it('reports the recorded state of a monitored device', async () => {
      prisma.device.findMany.mockResolvedValue([
        makeRow({
          deviceState: {
            status: 'DOWN',
            downSince: new Date('2026-09-26T10:00:00Z'),
            lastSeen: new Date('2026-09-26T09:59:00Z')
          }
        })
      ]);

      const result = await query.list({});

      expect(result.isSuccess).toBe(true);
      expect(result.value[0].connectivity).toEqual({
        status: 'DOWN',
        downSince: '2026-09-26T10:00:00.000Z',
        lastSeen: '2026-09-26T09:59:00.000Z'
      });
      expect(result.value[0].name).toBe('Router A');
    });

    it.each([
      ['offline', { status: 'ACTIVE', offlineSince: new Date() }],
      ['pending', { status: 'PENDING', offlineSince: null }],
      ['revoked', { status: 'REVOKED', offlineSince: null }]
    ])(
      '[MON-006] reports UNKNOWN behind an agent that is %s',
      async (_label, agent) => {
        prisma.device.findMany.mockResolvedValue([
          makeRow({
            agentId: '550e8400-e29b-41d4-a716-446655440009',
            agent,
            deviceState: {
              status: 'DOWN',
              downSince: new Date('2026-09-26T10:00:00Z'),
              lastSeen: new Date('2026-09-26T09:59:00Z')
            }
          })
        ]);

        const result = await query.list({});

        expect(result.value[0].connectivity).toEqual({
          status: 'UNKNOWN',
          downSince: null,
          lastSeen: '2026-09-26T09:59:00.000Z'
        });
      }
    );

    it('reports UNKNOWN for a monitored device never polled', async () => {
      prisma.device.findMany.mockResolvedValue([makeRow()]);

      const result = await query.list({});

      expect(result.value[0].connectivity).toEqual({
        status: 'UNKNOWN',
        downSince: null,
        lastSeen: null
      });
    });

    it('reports null for an unmonitored device, even with stale state', async () => {
      prisma.device.findMany.mockResolvedValue([
        makeRow({
          monitoringEnabled: false,
          deviceState: {
            status: 'DOWN',
            downSince: new Date('2026-09-01T00:00:00Z'),
            lastSeen: null
          }
        })
      ]);

      const result = await query.list({});

      expect(result.value[0].connectivity).toBeNull();
    });

    it('fails when a row cannot be mapped', async () => {
      prisma.device.findMany.mockResolvedValue([
        makeRow({ id: 'not-a-uuid' })
      ]);

      const result = await query.list({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to map device');
    });
  });

  // =========================================================================
  describe('[MON-006] a server hosted off site', () => {
    const DOWN_STATE = {
      status: 'DOWN',
      downSince: new Date('2026-09-26T10:00:00Z'),
      lastSeen: new Date('2026-09-26T09:59:00Z')
    };

    beforeEach(() => {
      query = new PrismaDeviceListQuery(
        prisma as unknown as PrismaClient,
        false
      );
    });

    it('reports UNKNOWN for a device with no agent, whatever its stored state', async () => {
      prisma.device.findMany.mockResolvedValue([
        makeRow({
          agentId: null,
          agent: null,
          deviceState: DOWN_STATE
        })
      ]);

      const result = await query.list({});

      expect(result.value[0].connectivity).toEqual({
        status: 'UNKNOWN',
        downSince: null,
        lastSeen: '2026-09-26T09:59:00.000Z'
      });
    });

    it('reports the recorded state of a device behind a reporting agent', async () => {
      prisma.device.findMany.mockResolvedValue([
        makeRow({
          agentId: '550e8400-e29b-41d4-a716-446655440009',
          agent: { status: 'ACTIVE', offlineSince: null },
          deviceState: DOWN_STATE
        })
      ]);

      const result = await query.list({});

      expect(result.value[0].connectivity?.status).toBe('DOWN');
    });

    it('counts devices with no agent as UNKNOWN in the connectivity filter', async () => {
      prisma.device.findMany.mockResolvedValue([]);

      await query.list({ connectivity: 'DOWN' });

      expect(lastFindManyArgs().where).toEqual({
        deletedAt: null,
        AND: [
          { monitoringEnabled: true },
          {
            deviceState: { is: { status: 'DOWN' } },
            NOT: unmeasuredDevices(false)
          }
        ]
      });
      expect(unmeasuredDevices(false)).toEqual({
        OR: [{ agentId: null }, unmeasuredDevices(true)]
      });
    });
  });

  // =========================================================================
  describe('[DEV-149] connectivity filter', () => {
    beforeEach(() => {
      prisma.device.findMany.mockResolvedValue([]);
    });

    it('leaves the inventory where untouched when not requested', async () => {
      await query.list({ status: DeviceStatus.createActive() });

      expect(lastFindManyArgs().where).toEqual({
        status: 'ACTIVE',
        deletedAt: null
      });
    });

    it('matches a recorded status on monitored devices only', async () => {
      await query.list({ connectivity: 'DOWN' });

      expect(lastFindManyArgs().where).toEqual({
        deletedAt: null,
        AND: [
          { monitoringEnabled: true },
          {
            deviceState: { is: { status: 'DOWN' } },
            NOT: unmeasuredDevices(true)
          }
        ]
      });
    });

    it('lets UNKNOWN match a monitored device with no state yet', async () => {
      await query.list({ connectivity: 'UNKNOWN' });

      expect(lastFindManyArgs().where).toEqual({
        deletedAt: null,
        AND: [
          { monitoringEnabled: true },
          {
            OR: [
              { deviceState: { is: null } },
              { deviceState: { is: { status: 'UNKNOWN' } } },
              unmeasuredDevices(true)
            ]
          }
        ]
      });
    });

    it('does not let connectivity overwrite monitoringEnabled=false', async () => {
      await query.list({
        monitoringEnabled: false,
        connectivity: 'UP'
      });

      const where = lastFindManyArgs().where as Record<
        string,
        unknown
      >;
      expect(where.monitoringEnabled).toBe(false);
      expect(where.AND).toContainEqual({ monitoringEnabled: true });
    });
  });

  // =========================================================================
  describe('[DEV-149] sort by downSince', () => {
    beforeEach(() => {
      prisma.device.findMany.mockResolvedValue([]);
    });

    it('puts the longest outage first by default, unmonitored last', async () => {
      await query.list({ sortBy: 'downSince' });

      expect(lastFindManyArgs().orderBy).toEqual([
        { monitoringEnabled: 'desc' },
        {
          deviceState: { downSince: { sort: 'asc', nulls: 'last' } }
        },
        { createdAt: 'desc' }
      ]);
    });

    it('puts the newest outage first on DESC', async () => {
      await query.list({ sortBy: 'downSince', sortOrder: 'DESC' });

      expect(lastFindManyArgs().orderBy).toContainEqual({
        deviceState: { downSince: { sort: 'desc', nulls: 'last' } }
      });
    });

    it('keeps the inventory sort for every other column', async () => {
      await query.list({ sortBy: 'ipAddress', sortOrder: 'ASC' });

      expect(lastFindManyArgs().orderBy).toEqual([
        { ipSortKey: 'asc' }
      ]);
    });
  });

  // =========================================================================
  describe('[DEV-145] count()', () => {
    it('counts with the same where clause list builds', async () => {
      prisma.device.findMany.mockResolvedValue([]);
      prisma.device.count.mockResolvedValue(0);
      const criteria = {
        status: DeviceStatus.createActive(),
        search: 'router',
        connectivity: 'DOWN' as const
      };

      await query.list(criteria);
      await query.count(criteria);

      expect(prisma.device.count.mock.calls[0][0].where).toEqual(
        lastFindManyArgs().where
      );
    });

    it('does not pass take or skip to count', async () => {
      prisma.device.count.mockResolvedValue(0);

      await query.count({ limit: 10, offset: 20 });

      const counted = prisma.device.count.mock.calls[0][0];
      expect(counted.take).toBeUndefined();
      expect(counted.skip).toBeUndefined();
    });

    it('returns the count', async () => {
      prisma.device.count.mockResolvedValue(42);

      const result = await query.count({});

      expect(result.value).toBe(42);
    });

    it('fails when count throws', async () => {
      prisma.device.count.mockRejectedValue(new Error('io error'));

      const result = await query.count({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Database error counting devices'
      );
    });
  });

  it('fails when findMany throws', async () => {
    prisma.device.findMany.mockRejectedValue(new Error('io error'));

    const result = await query.list({});

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error listing devices');
  });
});
