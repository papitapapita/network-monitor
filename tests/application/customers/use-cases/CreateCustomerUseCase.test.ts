// Source: src/application/customers/use-cases/CreateCustomerUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { CreateCustomerUseCase } from '../../../../src/application/customers/use-cases/CreateCustomerUseCase';
import { ICustomerRepository } from '../../../../src/domain/customers/repository';
import { Customer } from '../../../../src/domain/customers';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

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

describe('CreateCustomerUseCase', () => {
  let repo: jest.Mocked<ICustomerRepository>;
  let useCase: CreateCustomerUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CreateCustomerUseCase(repo, makeLogger());
    (repo.existsByPhone as any).mockResolvedValue(Result.ok(false));
    (repo.existsByEmail as any).mockResolvedValue(Result.ok(false));
    (repo.existsByCedula as any).mockResolvedValue(Result.ok(false));
    (repo.save as any).mockImplementation(async (c: Customer) =>
      Result.ok(c)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fail when fullName is empty', async () => {
    const result = await useCase.execute({
      fullName: '  ',
      phone: '3001234567'
    });
    expect(result.isFailure).toBe(true);
  });

  it('should fail when phone is missing', async () => {
    const result = await useCase.execute({
      fullName: 'Juan',
      phone: ''
    });
    expect(result.isFailure).toBe(true);
  });

  it('should fail when the phone is invalid', async () => {
    const result = await useCase.execute({
      fullName: 'Juan',
      phone: '123'
    });
    expect(result.isFailure).toBe(true);
  });

  it('should fail when phone already exists', async () => {
    (repo.existsByPhone as any).mockResolvedValue(Result.ok(true));
    const result = await useCase.execute({
      fullName: 'Juan',
      phone: '3001234567'
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
  });

  it('should succeed and return a DTO with normalized phone', async () => {
    const result = await useCase.execute({
      fullName: '  Juan Perez ',
      phone: '300 123 4567',
      email: 'JUAN@example.com'
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.fullName).toBe('Juan Perez');
    expect(result.value.phone).toBe('3001234567');
    expect(result.value.email).toBe('juan@example.com');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('should reject an invalid email before saving', async () => {
    const result = await useCase.execute({
      fullName: 'Juan',
      phone: '3001234567',
      email: 'bad'
    });
    expect(result.isFailure).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
