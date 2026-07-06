// Source: src/application/customers/mappers/*

import { describe, it, expect } from '@jest/globals';
import {
  CustomerMapper,
  ServicePlanMapper,
  ContractedServiceMapper
} from '../../../../src/application/customers/mappers';
import {
  Customer,
  ServicePlan,
  ContractedService,
  ContractedServiceStatus,
  PhoneNumber,
  Cedula,
  EmailAddress
} from '../../../../src/domain/customers';
import {
  CustomerId,
  ServicePlanId,
  ContractedServiceId,
  DeviceId
} from '../../../../src/domain/shared/ids';

const NOW = new Date('2024-01-01T00:00:00.000Z');
const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('CustomerMapper.toDTO', () => {
  it('should serialize VOs and dates', () => {
    const customer = Customer.reconstitute(
      CustomerId.parse(UUID).value,
      {
        fullName: 'Juan Perez',
        phone: PhoneNumber.reconstitute('3001234567'),
        email: EmailAddress.reconstitute('juan@example.com'),
        cedula: Cedula.reconstitute('1036612'),
        createdAt: NOW,
        updatedAt: NOW
      }
    );
    const dto = CustomerMapper.toDTO(customer);
    expect(dto).toEqual({
      id: UUID,
      fullName: 'Juan Perez',
      phone: '3001234567',
      email: 'juan@example.com',
      cedula: '1036612',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString()
    });
  });

  it('should keep null optional fields null', () => {
    const customer = Customer.reconstitute(
      CustomerId.parse(UUID).value,
      {
        fullName: 'Juan',
        phone: PhoneNumber.reconstitute('3001234567'),
        email: null,
        cedula: null,
        createdAt: NOW,
        updatedAt: NOW
      }
    );
    const dto = CustomerMapper.toDTO(customer);
    expect(dto.email).toBeNull();
    expect(dto.cedula).toBeNull();
  });

  it('toListDTO should compute hasMore', () => {
    const customer = Customer.reconstitute(
      CustomerId.parse(UUID).value,
      {
        fullName: 'Juan',
        phone: PhoneNumber.reconstitute('3001234567'),
        email: null,
        cedula: null,
        createdAt: NOW,
        updatedAt: NOW
      }
    );
    // one item shown, offset 0, total 3 → more remain
    const more = CustomerMapper.toListDTO([customer], 3, 20, 0);
    expect(more.hasMore).toBe(true);
    // total matches the page → nothing more
    const done = CustomerMapper.toListDTO([customer], 1, 20, 0);
    expect(done.hasMore).toBe(false);
  });
});

describe('ServicePlanMapper.toDTO', () => {
  it('should serialize plan fields', () => {
    const plan = ServicePlan.reconstitute(
      ServicePlanId.parse(UUID).value,
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
    const dto = ServicePlanMapper.toDTO(plan);
    expect(dto.name).toBe('Plan 50/10');
    expect(dto.monthlyPrice).toBe(80000);
    expect(dto.isActive).toBe(true);
  });
});

describe('ContractedServiceMapper.toDTO', () => {
  it('should serialize ids, status and dates', () => {
    const service = ContractedService.reconstitute(
      ContractedServiceId.parse(UUID).value,
      {
        customerId: CustomerId.create(),
        servicePlanId: ServicePlanId.create(),
        deviceId: DeviceId.create(),
        status: ContractedServiceStatus.ACTIVE,
        startDate: NOW,
        createdAt: NOW,
        updatedAt: NOW
      }
    );
    const dto = ContractedServiceMapper.toDTO(service);
    expect(dto.status).toBe('ACTIVE');
    expect(dto.deviceId).not.toBeNull();
    expect(dto.startDate).toBe(NOW.toISOString());
  });

  it('should serialize a null deviceId', () => {
    const service = ContractedService.reconstitute(
      ContractedServiceId.parse(UUID).value,
      {
        customerId: CustomerId.create(),
        servicePlanId: ServicePlanId.create(),
        deviceId: null,
        status: ContractedServiceStatus.PENDING,
        startDate: NOW,
        createdAt: NOW,
        updatedAt: NOW
      }
    );
    const dto = ContractedServiceMapper.toDTO(service);
    expect(dto.deviceId).toBeNull();
  });
});
