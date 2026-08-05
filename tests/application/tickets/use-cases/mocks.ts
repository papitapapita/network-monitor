// Shared jest.Mocked factories for the tickets application unit tests.
// Each factory covers every method on its interface, so a use case that starts
// calling a new one fails loudly rather than hitting `undefined`.

import { jest } from '@jest/globals';
import { Result } from '../../../../src/domain/shared/core';
import {
  ITicketRepository,
  ITechnicianRepository,
  Ticket,
  Technician,
  TicketPriority,
  TicketCategory,
  TicketOrigin
} from '../../../../src/domain/tickets';
import { ContactPhone } from '../../../../src/domain/tickets';
import {
  ICustomerDirectory,
  IDeviceDirectory,
  ITechnicianNotifier
} from '../../../../src/application/tickets/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import {
  CustomerId,
  DeviceId
} from '../../../../src/domain/shared/ids';

export function makeLogger(): jest.Mocked<ILogger> {
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

export function makeTicketRepo(): jest.Mocked<ITicketRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    findAll: jest.fn(),
    countAll: jest.fn(),
    findForTechnicianOnDate: jest.fn(),
    findActiveByOrigin: jest.fn(),
    findActiveAlertTicketForDevice: jest.fn(),
    countByTechnician: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn()
  } as unknown as jest.Mocked<ITicketRepository>;
}

export function makeTechnicianRepo(): jest.Mocked<ITechnicianRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByPhone: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByPhone: jest.fn(),
    existsByEmail: jest.fn(),
    count: jest.fn()
  } as unknown as jest.Mocked<ITechnicianRepository>;
}

export function makeCustomerDirectory(): jest.Mocked<ICustomerDirectory> {
  return {
    findContact: jest.fn(),
    exists: jest.fn(),
    findContactByDevice: jest.fn()
  } as unknown as jest.Mocked<ICustomerDirectory>;
}

export function makeDeviceDirectory(): jest.Mocked<IDeviceDirectory> {
  return {
    findSummary: jest.fn(),
    exists: jest.fn()
  } as unknown as jest.Mocked<IDeviceDirectory>;
}

export function makeTechnicianNotifier(): jest.Mocked<ITechnicianNotifier> {
  return {
    notifyAssignment: jest.fn()
  } as unknown as jest.Mocked<ITechnicianNotifier>;
}

export function makeTicket(
  overrides: Record<string, unknown> = {}
): Ticket {
  const result = Ticket.create({
    title: 'No internet',
    description: 'Link down since 7am',
    priority: TicketPriority.reconstitute(TicketPriority.NORMAL),
    category: TicketCategory.reconstitute(
      TicketCategory.CONNECTIVITY
    ),
    origin: TicketOrigin.reconstitute(TicketOrigin.MANUAL),
    originAlertId: null,
    customerId: CustomerId.create(),
    deviceId: DeviceId.create(),
    address: null,
    scheduledFor: null,
    createdBy: null,
    ...overrides
  } as Parameters<typeof Ticket.create>[0]);
  if (result.isFailure) {
    throw new Error(`fixture failed: ${result.error}`);
  }
  return result.value;
}

export function makeTechnician(
  overrides: Record<string, unknown> = {}
): Technician {
  const result = Technician.create({
    fullName: 'Andrés Muñoz',
    phone: ContactPhone.reconstitute('+573001112233'),
    email: null,
    userId: null,
    ...overrides
  } as Parameters<typeof Technician.create>[0]);
  if (result.isFailure) {
    throw new Error(`fixture failed: ${result.error}`);
  }
  return result.value;
}

export const deviceSummary = {
  id: DeviceId.create().toString(),
  name: 'CPE-Marta',
  ipAddress: '10.0.0.5',
  macAddress: null,
  status: 'ACTIVE',
  category: 'CPE',
  modelName: 'LiteBeam 5AC',
  vendorName: 'Ubiquiti',
  locationName: null
};

export const customerContact = {
  id: CustomerId.create().toString(),
  fullName: 'Marta Ríos',
  phone: '3001234567',
  email: 'marta@example.com'
};

export const ok = <T>(value: T) => Result.ok(value);
export const fail = <T>(message: string) => Result.fail<T>(message);
