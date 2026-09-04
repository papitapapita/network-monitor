// Source: src/infrastructure/persistence/PrismaMutedAlertTypeRepository.ts

import { PrismaMutedAlertTypeRepository } from '../../../src/infrastructure/persistence/PrismaMutedAlertTypeRepository';

const VALID_ID = '550e8400-e29b-41d4-a716-446655440100';

function makeFakePrismaClient() {
  return {
    mutedAlertType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn()
    },
    $transaction: jest.fn()
  };
}

function makeFakeRow(metric = 'cpu_load_percent') {
  return { id: VALID_ID, metric, createdAt: new Date() };
}

describe('PrismaMutedAlertTypeRepository', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let repo: PrismaMutedAlertTypeRepository;

  beforeEach(() => {
    prisma = makeFakePrismaClient();
    repo = new PrismaMutedAlertTypeRepository(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('listAll()', () => {
    it('returns the mapped entities ordered by metric', async () => {
      prisma.mutedAlertType.findMany.mockResolvedValue([
        makeFakeRow('cpu_load_percent'),
        makeFakeRow('distance_m')
      ]);

      const result = await repo.listAll();

      expect(result.isSuccess).toBe(true);
      expect(result.value.map((e) => e.metric)).toEqual([
        'cpu_load_percent',
        'distance_m'
      ]);
      expect(prisma.mutedAlertType.findMany).toHaveBeenCalledWith({
        orderBy: { metric: 'asc' }
      });
    });

    it('returns a failed Result when Prisma throws', async () => {
      prisma.mutedAlertType.findMany.mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await repo.listAll();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Database error listing muted alert types'
      );
    });
  });

  describe('isMuted()', () => {
    it('returns true when a row exists for the metric', async () => {
      prisma.mutedAlertType.findUnique.mockResolvedValue(
        makeFakeRow('distance_m')
      );

      const result = await repo.isMuted('distance_m');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
      expect(prisma.mutedAlertType.findUnique).toHaveBeenCalledWith({
        where: { metric: 'distance_m' }
      });
    });

    it('returns false when no row exists', async () => {
      prisma.mutedAlertType.findUnique.mockResolvedValue(null);

      const result = await repo.isMuted('distance_m');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });

    it('returns a failed Result when Prisma throws', async () => {
      prisma.mutedAlertType.findUnique.mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await repo.isMuted('distance_m');

      expect(result.isFailure).toBe(true);
    });
  });

  describe('replaceAll()', () => {
    it('deletes and recreates inside one transaction', async () => {
      prisma.$transaction.mockResolvedValue([{ count: 1 }, {}]);

      await repo.replaceAll(['cpu_load_percent', 'distance_m']);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.mutedAlertType.deleteMany).toHaveBeenCalledWith(
        {}
      );
      expect(prisma.mutedAlertType.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ metric: 'cpu_load_percent' }),
          expect.objectContaining({ metric: 'distance_m' })
        ])
      });
    });

    it('rejects an invalid metric before touching the transaction', async () => {
      const result = await repo.replaceAll(['Not Valid!']);

      expect(result.isFailure).toBe(true);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('dedupes repeated entries in the input', async () => {
      prisma.$transaction.mockResolvedValue([{ count: 1 }, {}]);

      const result = await repo.replaceAll([
        'cpu_load_percent',
        'cpu_load_percent'
      ]);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
    });

    it('returns an empty list when given an empty array', async () => {
      prisma.$transaction.mockResolvedValue([{ count: 0 }, {}]);

      const result = await repo.replaceAll([]);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('returns a failed Result when the transaction throws', async () => {
      prisma.$transaction.mockRejectedValue(new Error('deadlock'));

      const result = await repo.replaceAll(['cpu_load_percent']);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Database error replacing muted alert types'
      );
    });
  });
});
