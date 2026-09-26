// Source: src/application/billing/use-cases/CreateCollectionAccountUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach
} from '@jest/globals';
import { CreateCollectionAccountUseCase } from '../../../../src/application/billing/use-cases/CreateCollectionAccountUseCase';
import { CreateCollectionAccountRequestDTO } from '../../../../src/application/billing/dtos';
import { CollectionAccount } from '../../../../src/domain/billing';
import { ICustomerRepository } from '../../../../src/domain/customers/repository';
import { Customer } from '../../../../src/domain/customers/aggregates';
import {
  Cedula,
  EmailAddress,
  PhoneNumber
} from '../../../../src/domain/customers/value-objects';
import { CustomerId } from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  makeCollectionAccountRepo,
  makeLogger,
  NOW
} from './collectionAccountFixtures';

const CUSTOMER_UUID = '660e8400-e29b-41d4-a716-446655440001';
const USER_UUID = '770e8400-e29b-41d4-a716-446655440002';

function makeCustomer(
  cedula: string | null = '1098765432'
): Customer {
  return Customer.reconstitute(
    CustomerId.parse(CUSTOMER_UUID).value,
    {
      fullName: 'Juan Pérez',
      phone: PhoneNumber.reconstitute('3001234567'),
      email: EmailAddress.reconstitute('juan@example.com'),
      cedula: cedula !== null ? Cedula.reconstitute(cedula) : null,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

function makeCustomerRepo(): jest.Mocked<ICustomerRepository> {
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

function makeRequest(
  overrides: Partial<CreateCollectionAccountRequestDTO> = {}
): CreateCollectionAccountRequestDTO {
  return {
    customerName: 'María López',
    lineItems: [
      {
        description: 'Cámara IP 4MP',
        unitPrice: 185000,
        quantity: 4
      },
      { description: 'Instalación', unitPrice: 350000, quantity: 1 }
    ],
    ...overrides
  };
}

describe('CreateCollectionAccountUseCase', () => {
  let repo: ReturnType<typeof makeCollectionAccountRepo>;
  let customerRepo: jest.Mocked<ICustomerRepository>;
  let useCase: CreateCollectionAccountUseCase;

  beforeEach(() => {
    repo = makeCollectionAccountRepo();
    customerRepo = makeCustomerRepo();
    repo.save.mockImplementation(async (account: CollectionAccount) =>
      Result.ok(account)
    );
    useCase = new CreateCollectionAccountUseCase(
      repo,
      customerRepo,
      makeLogger()
    );
  });

  it('[BIL-202] fails when neither customerId nor customerName is given', async () => {
    const result = await useCase.execute(
      makeRequest({ customerName: '  ' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'Either customerId or customerName is required'
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[BIL-210] fails when no line items are given', async () => {
    const result = await useCase.execute(
      makeRequest({ lineItems: [] })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('At least one line item is required');
  });

  it('[BIL-201] creates a walk-in account from free-text details', async () => {
    const result = await useCase.execute(
      makeRequest({
        customerDocument: ' 900123456-7 ',
        customerPhone: '3109998877',
        customerAddress: ''
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.customerId).toBeNull();
    expect(result.value.customerName).toBe('María López');
    expect(result.value.customerDocument).toBe('900123456-7');
    expect(result.value.customerPhone).toBe('3109998877');
    expect(result.value.customerAddress).toBeNull();
    expect(result.value.status).toBe('PENDING');
    expect(result.value.total).toBe(1090000);
    expect(customerRepo.findById).not.toHaveBeenCalled();
  });

  it('[BIL-201] snapshots name, phone, email and cédula from a linked customer', async () => {
    customerRepo.findById.mockResolvedValue(
      Result.ok(makeCustomer())
    );

    const result = await useCase.execute(
      makeRequest({
        customerId: CUSTOMER_UUID,
        customerName: 'Ignored',
        customerDocument: '000',
        customerAddress: 'Calle 10 # 5-20'
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.customerId).toBe(CUSTOMER_UUID);
    expect(result.value.customerName).toBe('Juan Pérez');
    expect(result.value.customerPhone).toBe('3001234567');
    expect(result.value.customerEmail).toBe('juan@example.com');
    expect(result.value.customerDocument).toBe('1098765432');
    expect(result.value.customerAddress).toBe('Calle 10 # 5-20');
  });

  it('[BIL-201] falls back to the supplied document when the customer has no cédula', async () => {
    customerRepo.findById.mockResolvedValue(
      Result.ok(makeCustomer(null))
    );

    const result = await useCase.execute(
      makeRequest({
        customerId: CUSTOMER_UUID,
        customerDocument: '900'
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.customerDocument).toBe('900');
  });

  it('[BIL-201] fails when the linked customer does not exist', async () => {
    customerRepo.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute(
      makeRequest({ customerId: CUSTOMER_UUID })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(`Customer not found: ${CUSTOMER_UUID}`);
  });

  it('[BIL-201] fails on a malformed customerId', async () => {
    const result = await useCase.execute(
      makeRequest({ customerId: 'not-a-uuid' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^Invalid customerId/);
  });

  it('[BIL-204] defaults the issue date to now and leaves the due date empty', async () => {
    const before = Date.now();

    const result = await useCase.execute(makeRequest());

    expect(result.isSuccess).toBe(true);
    expect(
      new Date(result.value.issueDate).getTime()
    ).toBeGreaterThanOrEqual(before);
    expect(result.value.dueDate).toBeNull();
  });

  it('[BIL-204] uses the supplied issue and due dates', async () => {
    const result = await useCase.execute(
      makeRequest({
        issueDate: '2026-09-01T12:00:00.000Z',
        dueDate: '2026-09-15T12:00:00.000Z'
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.issueDate).toBe('2026-09-01T12:00:00.000Z');
    expect(result.value.dueDate).toBe('2026-09-15T12:00:00.000Z');
  });

  it('[BIL-204] rejects an unparseable date', async () => {
    const result = await useCase.execute(
      makeRequest({ dueDate: 'tomorrow' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('dueDate is not a valid date');
  });

  it('[BIL-205] rejects a due date before the issue date', async () => {
    const result = await useCase.execute(
      makeRequest({
        issueDate: '2026-09-15T12:00:00.000Z',
        dueDate: '2026-09-01T12:00:00.000Z'
      })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('dueDate cannot be before issueDate');
  });

  it('[BIL-211] rejects a line item with an empty description', async () => {
    const result = await useCase.execute(
      makeRequest({
        lineItems: [{ description: '', unitPrice: 10, quantity: 1 }]
      })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('description cannot be empty');
  });

  it('[BIL-211] rejects a negative unit price', async () => {
    const result = await useCase.execute(
      makeRequest({
        lineItems: [{ description: 'x', unitPrice: -1, quantity: 1 }]
      })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^Invalid unitPrice/);
  });

  it('records the author from createdBy', async () => {
    const result = await useCase.execute(
      makeRequest({ createdBy: USER_UUID })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.createdBy).toBe(USER_UUID);
  });

  it('surfaces a persistence failure', async () => {
    repo.save.mockResolvedValue(Result.fail('connection lost'));

    const result = await useCase.execute(makeRequest());

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'Failed to persist collection account: connection lost'
    );
  });
});
