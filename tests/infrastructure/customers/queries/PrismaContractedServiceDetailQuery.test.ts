// Source: src/infrastructure/customers/queries/PrismaContractedServiceDetailQuery.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaContractedServiceDetailQuery } from '../../../../src/infrastructure/customers/queries/PrismaContractedServiceDetailQuery';
import {
  ContractedServiceId,
  CustomerId,
  DeviceId
} from '../../../../src/domain/shared/ids';

const CS_ID = '550e8400-e29b-41d4-a716-446655440000';
const CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440001';
const PLAN_ID = '550e8400-e29b-41d4-a716-446655440002';
const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440003';

function makeFakePrismaClient() {
  return {
    contractedService: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    }
  };
}

function makeRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: CS_ID,
    customerId: CUSTOMER_ID,
    servicePlanId: PLAN_ID,
    deviceId: DEVICE_ID,
    status: 'ACTIVE',
    startDate: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    customer: {
      id: CUSTOMER_ID,
      fullName: 'Ana Gómez',
      phone: '3001234567',
      email: 'ana@example.com',
      cedula: null
    },
    servicePlan: {
      id: PLAN_ID,
      name: 'Plan 50/10',
      downloadMbps: 50,
      uploadMbps: 10,
      monthlyPrice: {
        toString: () => '80000.00',
        valueOf: () => 80000
      },
      isActive: true
    },
    device: {
      id: DEVICE_ID,
      name: 'CPE Ana',
      ipAddress: '10.0.0.5',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      status: 'ACTIVE',
      category: 'WIRELESS_CPE',
      deletedAt: null
    },
    ...overrides
  };
}

describe('PrismaContractedServiceDetailQuery', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let query: PrismaContractedServiceDetailQuery;

  beforeEach(() => {
    prisma = makeFakePrismaClient();
    query = new PrismaContractedServiceDetailQuery(
      prisma as unknown as PrismaClient
    );
  });

  describe('[CUS-124] embedded summaries', () => {
    it('maps customer, plan and device next to the id fields', async () => {
      prisma.contractedService.findUnique.mockResolvedValue(
        makeRow()
      );

      const result = await query.findById(
        ContractedServiceId.parse(CS_ID).value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        id: CS_ID,
        customerId: CUSTOMER_ID,
        servicePlanId: PLAN_ID,
        deviceId: DEVICE_ID,
        status: 'ACTIVE',
        startDate: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        customer: {
          id: CUSTOMER_ID,
          fullName: 'Ana Gómez',
          phone: '3001234567',
          email: 'ana@example.com',
          cedula: null
        },
        servicePlan: {
          id: PLAN_ID,
          name: 'Plan 50/10',
          downloadMbps: 50,
          uploadMbps: 10,
          monthlyPrice: 80000,
          isActive: true
        },
        device: {
          id: DEVICE_ID,
          name: 'CPE Ana',
          ipAddress: '10.0.0.5',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          status: 'ACTIVE',
          category: 'WIRELESS_CPE',
          deletedAt: null
        }
      });
    });

    it('returns device null when the service has no device', async () => {
      prisma.contractedService.findUnique.mockResolvedValue(
        makeRow({ deviceId: null, device: null })
      );

      const result = await query.findById(
        ContractedServiceId.parse(CS_ID).value
      );

      expect(result.value!.deviceId).toBeNull();
      expect(result.value!.device).toBeNull();
    });

    it('serialises a soft-deleted device with its deletedAt', async () => {
      prisma.contractedService.findUnique.mockResolvedValue(
        makeRow({
          status: 'CANCELLED',
          device: {
            ...(makeRow().device as Record<string, unknown>),
            deletedAt: new Date('2026-03-01T12:00:00Z')
          }
        })
      );

      const result = await query.findById(
        ContractedServiceId.parse(CS_ID).value
      );

      expect(result.value!.device!.deletedAt).toBe(
        '2026-03-01T12:00:00.000Z'
      );
    });

    it('returns null for an unknown id', async () => {
      prisma.contractedService.findUnique.mockResolvedValue(null);

      const result = await query.findById(
        ContractedServiceId.parse(CS_ID).value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('list', () => {
    it('[CUS-123] filters by device and customer, newest start first', async () => {
      prisma.contractedService.findMany.mockResolvedValue([]);

      await query.list({
        customerId: CustomerId.parse(CUSTOMER_ID).value,
        deviceId: DeviceId.parse(DEVICE_ID).value
      });

      expect(prisma.contractedService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: CUSTOMER_ID, deviceId: DEVICE_ID },
          orderBy: { startDate: 'desc' }
        })
      );
    });

    it('pages the unfiltered list newest created first', async () => {
      prisma.contractedService.findMany.mockResolvedValue([
        makeRow()
      ]);

      const result = await query.list({ limit: 20, offset: 40 });

      expect(result.value).toHaveLength(1);
      expect(prisma.contractedService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { createdAt: 'desc' },
          take: 20,
          skip: 40
        })
      );
    });

    it('fails with a database error message when Prisma throws', async () => {
      prisma.contractedService.findMany.mockRejectedValue(
        new Error('connection lost')
      );

      const result = await query.list({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('connection lost');
    });
  });

  it('counts with the same filter as the list', async () => {
    prisma.contractedService.count.mockResolvedValue(3);

    const result = await query.count({
      deviceId: DeviceId.parse(DEVICE_ID).value
    });

    expect(result.value).toBe(3);
    expect(prisma.contractedService.count).toHaveBeenCalledWith({
      where: { deviceId: DEVICE_ID }
    });
  });
});
