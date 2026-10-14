// Source: src/application/customers/use-cases/GetContractedServiceUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach
} from '@jest/globals';
import { GetContractedServiceUseCase } from '../../../../src/application/customers/use-cases/GetContractedServiceUseCase';
import { IContractedServiceDetailQuery } from '../../../../src/application/customers/interfaces';
import { ContractedServiceDetailDTO } from '../../../../src/application/customers/dtos';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const CS_UUID = '550e8400-e29b-41d4-a716-446655440000';

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

describe('GetContractedServiceUseCase', () => {
  let query: jest.Mocked<IContractedServiceDetailQuery>;
  let useCase: GetContractedServiceUseCase;

  beforeEach(() => {
    query = {
      findById: jest.fn(),
      list: jest.fn(),
      count: jest.fn()
    };
    useCase = new GetContractedServiceUseCase(query, makeLogger());
  });

  it('[CUS-124] returns the detail DTO from the query', async () => {
    const detail = { id: CS_UUID } as ContractedServiceDetailDTO;
    query.findById.mockResolvedValue(Result.ok(detail));

    const result = await useCase.execute({ id: CS_UUID });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(detail);
    expect(query.findById.mock.calls[0][0].toString()).toBe(CS_UUID);
  });

  it('fails with not found when the query returns null', async () => {
    query.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({ id: CS_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
  });

  it('fails on a malformed id without querying', async () => {
    const result = await useCase.execute({ id: 'not-a-uuid' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid contracted service ID');
    expect(query.findById).not.toHaveBeenCalled();
  });

  it('fails when the id is blank', async () => {
    const result = await useCase.execute({ id: '  ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('required');
  });
});
