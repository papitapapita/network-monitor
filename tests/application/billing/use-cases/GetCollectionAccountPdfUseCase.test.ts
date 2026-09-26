// Source: src/application/billing/use-cases/GetCollectionAccountPdfUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach
} from '@jest/globals';
import { GetCollectionAccountPdfUseCase } from '../../../../src/application/billing/use-cases/GetCollectionAccountPdfUseCase';
import { ICollectionAccountPdfRenderer } from '../../../../src/application/billing/interfaces';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  ACCOUNT_UUID,
  makeCollectionAccount,
  makeCollectionAccountRepo,
  makeLogger
} from './collectionAccountFixtures';

describe('GetCollectionAccountPdfUseCase', () => {
  let repo: ReturnType<typeof makeCollectionAccountRepo>;
  let renderer: jest.Mocked<ICollectionAccountPdfRenderer>;
  let useCase: GetCollectionAccountPdfUseCase;

  beforeEach(() => {
    repo = makeCollectionAccountRepo();
    renderer = { render: jest.fn() };
    renderer.render.mockResolvedValue(
      Result.ok(Buffer.from('%PDF-'))
    );
    useCase = new GetCollectionAccountPdfUseCase(
      repo,
      renderer,
      makeLogger()
    );
  });

  it('[BIL-230] names the file after the formatted number', async () => {
    repo.findById.mockResolvedValue(
      Result.ok(makeCollectionAccount())
    );

    const result = await useCase.execute({ id: ACCOUNT_UUID });

    expect(result.isSuccess).toBe(true);
    expect(result.value.fileName).toBe('cuenta-de-cobro-CC-0007.pdf');
  });

  it('[BIL-230] hands the renderer the snapshot, line items and total', async () => {
    repo.findById.mockResolvedValue(
      Result.ok(makeCollectionAccount())
    );

    await useCase.execute({ id: ACCOUNT_UUID });

    const model = renderer.render.mock.calls[0][0];
    expect(model.number).toBe('CC-0007');
    expect(model.status).toBe('PENDING');
    expect(model.customer).toEqual({
      name: 'María López',
      document: '1098765432',
      phone: '3001234567',
      email: null,
      address: 'Cra 27 # 45-12'
    });
    expect(model.lineItems).toEqual([
      {
        description: 'Cámara IP 4MP',
        quantity: 4,
        unitPrice: 185000,
        lineTotal: 740000
      }
    ]);
    expect(model.total).toBe(740000);
  });

  it('fails when the account does not exist', async () => {
    repo.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({ id: ACCOUNT_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      `Collection account not found: ${ACCOUNT_UUID}`
    );
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('surfaces a renderer failure', async () => {
    repo.findById.mockResolvedValue(
      Result.ok(makeCollectionAccount())
    );
    renderer.render.mockResolvedValue(Result.fail('font missing'));

    const result = await useCase.execute({ id: ACCOUNT_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('font missing');
  });
});
