// Source: src/application/customers/use-cases/UpdateCustomerUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { UpdateCustomerUseCase } from '../../../../src/application/customers/use-cases/UpdateCustomerUseCase';
import { ICustomerRepository } from '../../../../src/domain/customers/repository';
import { Customer, PhoneNumber } from '../../../../src/domain/customers';
import { CustomerId } from '../../../../src/domain/shared/ids';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(),
    setLevel: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeRepo(): jest.Mocked<ICustomerRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByPhone: jest.fn(),
    findByCedula: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByPhone: jest.fn(),
    existsByCedula: jest.fn(),
    existsByEmail: jest.fn(),
    count: jest.fn()
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

describe('UpdateCustomerUseCase', () => {
  let repo: jest.Mocked<ICustomerRepository>;
  let useCase: UpdateCustomerUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new UpdateCustomerUseCase(repo, makeLogger());
    (repo.findById as any).mockResolvedValue(
      Result.ok(makeCustomer())
    );
    (repo.findByPhone as any).mockResolvedValue(Result.ok(null));
    (repo.findByEmail as any).mockResolvedValue(Result.ok(null));
    (repo.findByCedula as any).mockResolvedValue(Result.ok(null));
    (repo.save as any).mockImplementation(async (c: Customer) =>
      Result.ok(c)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fail when the customer does not exist', async () => {
    (repo.findById as any).mockResolvedValue(Result.ok(null));
    const result = await useCase.execute({
      id: VALID_UUID,
      fullName: 'New Name'
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
  });

  it('should rename the customer', async () => {
    const result = await useCase.execute({
      id: VALID_UUID,
      fullName: 'Pedro Gomez'
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.fullName).toBe('Pedro Gomez');
  });

  it('should reject a phone already owned by another customer', async () => {
    const other = Customer.reconstitute(CustomerId.create(), {
      fullName: 'Other',
      phone: PhoneNumber.reconstitute('3009999999'),
      email: null,
      cedula: null,
      createdAt: NOW,
      updatedAt: NOW
    });
    (repo.findByPhone as any).mockResolvedValue(Result.ok(other));

    const result = await useCase.execute({
      id: VALID_UUID,
      phone: '3009999999'
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should allow re-saving the same phone (same owner)', async () => {
    (repo.findByPhone as any).mockResolvedValue(
      Result.ok(makeCustomer())
    );
    const result = await useCase.execute({
      id: VALID_UUID,
      phone: '3001234567'
    });
    expect(result.isSuccess).toBe(true);
  });

  it('should clear email when null is passed', async () => {
    const result = await useCase.execute({
      id: VALID_UUID,
      email: null
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.email).toBeNull();
  });
});
