// Source: src/application/billing/use-cases/GetBillPdfUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { GetBillPdfUseCase } from '../../../../src/application/billing/use-cases/GetBillPdfUseCase';
import { IBillPdfRenderer } from '../../../../src/application/billing/interfaces';
import { IBillRepository } from '../../../../src/domain/billing/repository';
import {
  Bill,
  BillStatus,
  BillingPeriod,
  BillLineItem
} from '../../../../src/domain/billing';
import { ICustomerRepository } from '../../../../src/domain/customers/repository';
import { Customer } from '../../../../src/domain/customers/aggregates';
import { PhoneNumber } from '../../../../src/domain/customers/value-objects';
import {
  BillId,
  CustomerId,
  ContractedServiceId,
  ServicePlanId
} from '../../../../src/domain/shared/ids';
import { Money } from '../../../../src/domain/shared/value-objects';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const BILL_UUID = '550e8400-e29b-41d4-a716-446655440000';
const CUSTOMER_UUID = '660e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-03-01T00:00:00.000Z');
const DUE_DATE = new Date('2024-03-16T00:00:00.000Z');

function makeBill(): Bill {
  return Bill.reconstitute(BillId.parse(BILL_UUID).value, {
    customerId: CustomerId.parse(CUSTOMER_UUID).value,
    period: BillingPeriod.create(2024, 3).value,
    status: BillStatus.PENDING,
    lineItems: [
      BillLineItem.create({
        contractedServiceId: ContractedServiceId.create(),
        servicePlanId: ServicePlanId.create(),
        planName: 'Fiber 50/10',
        monthlyPrice: Money.create(19.99).value
      }).value
    ],
    issueDate: NOW,
    dueDate: DUE_DATE,
    paidAt: null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

function makeCustomer(): Customer {
  return Customer.reconstitute(
    CustomerId.parse(CUSTOMER_UUID).value,
    {
      fullName: 'Juan Perez',
      phone: PhoneNumber.reconstitute('3001234567'),
      email: null,
      cedula: null,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

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

function makeBillRepo(): jest.Mocked<IBillRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    existsForCustomerAndPeriod: jest.fn(),
    exists: jest.fn()
  };
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

function makeRenderer(): jest.Mocked<IBillPdfRenderer> {
  return {
    render: jest.fn()
  };
}

describe('GetBillPdfUseCase', () => {
  let billRepo: jest.Mocked<IBillRepository>;
  let customerRepo: jest.Mocked<ICustomerRepository>;
  let renderer: jest.Mocked<IBillPdfRenderer>;
  let useCase: GetBillPdfUseCase;

  beforeEach(() => {
    billRepo = makeBillRepo();
    customerRepo = makeCustomerRepo();
    renderer = makeRenderer();
    useCase = new GetBillPdfUseCase(
      billRepo,
      customerRepo,
      renderer,
      makeLogger()
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fail when the id is empty', async () => {
    const result = await useCase.execute({ id: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Bill ID is required');
    expect(billRepo.findById).not.toHaveBeenCalled();
  });

  it('should fail for a malformed (non-UUID) id', async () => {
    const result = await useCase.execute({ id: 'not-a-uuid' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid bill ID');
  });

  it('should fail when the bill does not exist', async () => {
    (billRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({ id: BILL_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Bill not found');
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('should fail when the bill customer does not exist', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill())
    );
    (customerRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({ id: BILL_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Customer not found for bill');
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('should propagate a renderer failure', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill())
    );
    (customerRepo.findById as any).mockResolvedValue(
      Result.ok(makeCustomer())
    );
    (renderer.render as any).mockResolvedValue(
      Result.fail('Failed to render bill PDF: boom')
    );

    const result = await useCase.execute({ id: BILL_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to render bill PDF');
  });

  it('should pass a complete render model snapshot to the renderer', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill())
    );
    (customerRepo.findById as any).mockResolvedValue(
      Result.ok(makeCustomer())
    );
    (renderer.render as any).mockResolvedValue(
      Result.ok(Buffer.from('%PDF-fake'))
    );

    await useCase.execute({ id: BILL_UUID });

    expect(renderer.render).toHaveBeenCalledTimes(1);
    const model = renderer.render.mock.calls[0][0];
    expect(model.billId).toBe(BILL_UUID);
    expect(model.period).toBe('2024-03');
    expect(model.status).toBe('PENDING');
    expect(model.total).toBe(19.99);
    expect(model.lineItems).toEqual([
      { planName: 'Fiber 50/10', monthlyPrice: 19.99 }
    ]);
    expect(model.customer.fullName).toBe('Juan Perez');
    expect(model.customer.email).toBeNull();
  });

  it('should return the PDF buffer with a period-and-id file name', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill())
    );
    (customerRepo.findById as any).mockResolvedValue(
      Result.ok(makeCustomer())
    );
    const pdf = Buffer.from('%PDF-fake');
    (renderer.render as any).mockResolvedValue(Result.ok(pdf));

    const result = await useCase.execute({ id: BILL_UUID });

    expect(result.isSuccess).toBe(true);
    expect(result.value.content).toBe(pdf);
    expect(result.value.fileName).toBe(
      `bill-2024-03-${BILL_UUID}.pdf`
    );
  });
});
