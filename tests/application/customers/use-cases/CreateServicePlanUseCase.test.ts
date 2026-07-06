// Source: src/application/customers/use-cases/CreateServicePlanUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { CreateServicePlanUseCase } from '../../../../src/application/customers/use-cases/CreateServicePlanUseCase';
import { IServicePlanRepository } from '../../../../src/domain/customers/repository';
import { ServicePlan } from '../../../../src/domain/customers';
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

function makeRepo(): jest.Mocked<IServicePlanRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn()
  };
}

const validRequest = {
  name: 'Plan 50/10',
  downloadMbps: 50,
  uploadMbps: 10,
  monthlyPrice: 80000,
  description: null
};

describe('CreateServicePlanUseCase', () => {
  let repo: jest.Mocked<IServicePlanRepository>;
  let useCase: CreateServicePlanUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CreateServicePlanUseCase(repo, makeLogger());
    (repo.findByName as any).mockResolvedValue(Result.ok(null));
    (repo.save as any).mockImplementation(async (p: ServicePlan) =>
      Result.ok(p)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a plan with default isActive=true', async () => {
    const result = await useCase.execute(validRequest);
    expect(result.isSuccess).toBe(true);
    expect(result.value.isActive).toBe(true);
    expect(result.value.monthlyPrice).toBe(80000);
  });

  it('should reject a duplicate name', async () => {
    (repo.findByName as any).mockResolvedValue(
      Result.ok(ServicePlan.create(validRequest).value)
    );
    const result = await useCase.execute(validRequest);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
  });

  it('should reject a negative price', async () => {
    const result = await useCase.execute({
      ...validRequest,
      monthlyPrice: -1
    });
    expect(result.isFailure).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should reject non-positive bandwidth', async () => {
    const result = await useCase.execute({
      ...validRequest,
      downloadMbps: 0
    });
    expect(result.isFailure).toBe(true);
  });
});
