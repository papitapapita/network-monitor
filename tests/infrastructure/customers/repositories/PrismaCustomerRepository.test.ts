// Source: src/infrastructure/customers/repositories/PrismaCustomerRepository.ts

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest
} from '@jest/globals';
import { PrismaCustomerRepository } from '../../../../src/infrastructure/customers/repositories/PrismaCustomerRepository';
import {
  Customer,
  PhoneNumber
} from '../../../../src/domain/customers';
import { CustomerId } from '../../../../src/domain/shared/ids';
import { EventDispatcher } from '../../../../src/domain/shared/core';

// Shaped like a real Prisma error: the code lives on `code`, never in the
// message text.
function makePrismaError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}


const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    fullName: 'Juan Perez',
    phone: '3001234567',
    email: null,
    cedula: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function makePrisma() {
  return {
    customer: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  };
}

function makeCustomer(): Customer {
  return Customer.reconstitute(CustomerId.parse(VALID_UUID).value, {
    fullName: 'Juan Perez',
    phone: PhoneNumber.reconstitute('3001234567'),
    email: null,
    cedula: null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

describe('PrismaCustomerRepository', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repository: PrismaCustomerRepository;
  let customer: Customer;
  let dispatchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    prisma = makePrisma();
    repository = new PrismaCustomerRepository(prisma as any);
    customer = makeCustomer();
    dispatchSpy = jest
      .spyOn(EventDispatcher, 'dispatchEventsForAggregate')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    dispatchSpy.mockRestore();
  });

  describe('save()', () => {
    it('should upsert and dispatch events on success', async () => {
      (prisma.customer.upsert as any).mockResolvedValue(makeRaw());

      const result = await repository.save(customer);

      expect(result.isSuccess).toBe(true);
      expect(prisma.customer.upsert).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith(customer.id);
    });

    it('should return an "already exists" failure on P2002', async () => {
      (prisma.customer.upsert as any).mockRejectedValue(
        makePrismaError('P2002', 'Unique constraint failed')
      );

      const result = await repository.save(customer);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already exists');
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should fail on a generic database error', async () => {
      (prisma.customer.upsert as any).mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await repository.save(customer);

      expect(result.isFailure).toBe(true);
    });
  });

  describe('findById()', () => {
    it('should return null when not found', async () => {
      (prisma.customer.findUnique as any).mockResolvedValue(null);

      const result = await repository.findById(
        CustomerId.parse(VALID_UUID).value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should map the found record', async () => {
      (prisma.customer.findUnique as any).mockResolvedValue(makeRaw());

      const result = await repository.findById(
        CustomerId.parse(VALID_UUID).value
      );

      expect(result.value!.fullName).toBe('Juan Perez');
    });
  });

  describe('findByPhone()', () => {
    it('should query by the phone unique key', async () => {
      (prisma.customer.findUnique as any).mockResolvedValue(makeRaw());

      await repository.findByPhone('3001234567');

      expect(prisma.customer.findUnique).toHaveBeenCalledWith({
        where: { phone: '3001234567' }
      });
    });
  });

  describe('existsByEmail()', () => {
    it('should return true when count > 0', async () => {
      (prisma.customer.count as any).mockResolvedValue(1);

      const result = await repository.existsByEmail('a@b.com');

      expect(result.value).toBe(true);
    });
  });

  describe('delete()', () => {
    it('should map P2025 to "not found"', async () => {
      (prisma.customer.delete as any).mockRejectedValue(
        makePrismaError('P2025', 'record not found')
      );

      const result = await repository.delete(
        CustomerId.parse(VALID_UUID).value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
    });

    it('should map P2003 to a foreign-key failure', async () => {
      (prisma.customer.delete as any).mockRejectedValue(
        makePrismaError('P2003', 'foreign key constraint')
      );

      const result = await repository.delete(
        CustomerId.parse(VALID_UUID).value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('contracted services');
    });
  });
});
