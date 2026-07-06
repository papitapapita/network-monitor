// Source: src/application/customers/use-cases/UpdateServicePlanUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { UpdateServicePlanUseCase } from '../../../../src/application/customers/use-cases/UpdateServicePlanUseCase';
import { IServicePlanRepository } from '../../../../src/domain/customers/repository';
import { ServicePlan } from '../../../../src/domain/customers';
import { ServicePlanId } from '../../../../src/domain/shared/ids';
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

function makePlan(): ServicePlan {
  return ServicePlan.reconstitute(
    ServicePlanId.parse(VALID_UUID).value,
    {
      name: 'Plan 50/10',
      downloadMbps: 50,
      uploadMbps: 10,
      monthlyPrice: 80000,
      description: null,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

describe('UpdateServicePlanUseCase', () => {
  let repo: jest.Mocked<IServicePlanRepository>;
  let useCase: UpdateServicePlanUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new UpdateServicePlanUseCase(repo, makeLogger());
    (repo.findById as any).mockResolvedValue(Result.ok(makePlan()));
    (repo.findByName as any).mockResolvedValue(Result.ok(null));
    (repo.save as any).mockImplementation(async (p: ServicePlan) =>
      Result.ok(p)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should update only the download bandwidth, keeping upload', async () => {
    const result = await useCase.execute({
      id: VALID_UUID,
      downloadMbps: 100
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.downloadMbps).toBe(100);
    expect(result.value.uploadMbps).toBe(10);
  });

  it('should deactivate the plan when isActive=false', async () => {
    const result = await useCase.execute({
      id: VALID_UUID,
      isActive: false
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.isActive).toBe(false);
  });

  it('should reject a duplicate name owned by another plan', async () => {
    const other = ServicePlan.create({
      name: 'Other',
      downloadMbps: 20,
      uploadMbps: 5,
      monthlyPrice: 1000,
      description: null
    }).value;
    (repo.findByName as any).mockResolvedValue(Result.ok(other));

    const result = await useCase.execute({
      id: VALID_UUID,
      name: 'Other'
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
  });

  it('should fail for an unknown plan', async () => {
    (repo.findById as any).mockResolvedValue(Result.ok(null));
    const result = await useCase.execute({
      id: VALID_UUID,
      monthlyPrice: 1
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
  });
});
