// Source: src/application/tickets/use-cases/CreateTicketFromAlertUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import {
  CreateTicketFromAlertUseCase,
  OpenTicketFromAlertUseCase
} from '../../../../src/application/tickets/use-cases';
import { IAlertDirectory } from '../../../../src/application/tickets/interfaces';
import { Ticket } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import {
  makeLogger,
  makeTicketRepo,
  makeCustomerDirectory,
  makeDeviceDirectory,
  makeTicket,
  deviceSummary,
  customerContact
} from './mocks';

const ALERT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const USER_ID = '550e8400-e29b-41d4-a716-446655440077';

function makeAlert(overrides: Record<string, string> = {}) {
  return {
    id: ALERT_ID,
    deviceId: deviceSummary.id,
    type: 'wireless:ccq_percent:WARNING',
    severity: 'WARNING',
    description: 'CCQ bajo',
    ...overrides
  };
}

describe('[TKT-115] CreateTicketFromAlertUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let alertDirectory: jest.Mocked<IAlertDirectory>;
  let useCase: CreateTicketFromAlertUseCase;

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    const customerDirectory = makeCustomerDirectory();
    const deviceDirectory = makeDeviceDirectory();
    alertDirectory = { findSummary: jest.fn() } as never;

    useCase = new CreateTicketFromAlertUseCase(
      alertDirectory,
      ticketRepo,
      new OpenTicketFromAlertUseCase(
        ticketRepo,
        customerDirectory,
        deviceDirectory,
        makeLogger()
      ),
      makeLogger()
    );

    (alertDirectory.findSummary as any).mockResolvedValue(
      Result.ok(makeAlert())
    );
    (ticketRepo.findActiveByOrigin as any).mockResolvedValue(
      Result.ok(null)
    );
    (
      ticketRepo.findActiveAlertTicketForDevice as any
    ).mockResolvedValue(Result.ok(null));
    (ticketRepo.save as any).mockImplementation(async (t: Ticket) =>
      Result.ok(t)
    );
    (deviceDirectory.findSummary as any).mockResolvedValue(
      Result.ok(deviceSummary)
    );
    (customerDirectory.findContactByDevice as any).mockResolvedValue(
      Result.ok(customerContact)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('opens a ticket from the alert, authored by the person', async () => {
    const result = await useCase.execute({
      alertId: ALERT_ID,
      createdBy: USER_ID
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.originAlertId).toBe(ALERT_ID);
    expect(result.value.origin).toBe('WIRELESS_ALERT');
    expect(result.value.description).toBe('CCQ bajo');
    expect(result.value.createdBy).toBe(USER_ID);
  });

  it('opens a DEVICE_ALERT ticket for a non-wireless alert', async () => {
    (alertDirectory.findSummary as any).mockResolvedValue(
      Result.ok(
        makeAlert({
          type: 'device_unreachable',
          severity: 'CRITICAL'
        })
      )
    );

    const result = await useCase.execute({ alertId: ALERT_ID });

    expect(result.value.origin).toBe('DEVICE_ALERT');
    expect(result.value.priority).toBe('URGENT');
  });

  it('opens its own ticket even when the device already has one', async () => {
    (
      ticketRepo.findActiveAlertTicketForDevice as any
    ).mockResolvedValue(Result.ok(makeTicket()));

    const result = await useCase.execute({ alertId: ALERT_ID });

    expect(result.isSuccess).toBe(true);
    expect(result.value.originAlertId).toBe(ALERT_ID);
    expect(ticketRepo.save).toHaveBeenCalledTimes(1);
  });

  it('refuses a second live ticket for the same alert', async () => {
    (ticketRepo.findActiveByOrigin as any).mockResolvedValue(
      Result.ok(makeTicket())
    );

    const result = await useCase.execute({ alertId: ALERT_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'A live ticket already exists for this alert'
    );
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('reports an unknown alert as not found', async () => {
    (alertDirectory.findSummary as any).mockResolvedValue(
      Result.ok(null)
    );

    const result = await useCase.execute({ alertId: ALERT_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Alert not found');
  });

  it('refuses a malformed alert id before reading anything', async () => {
    const result = await useCase.execute({ alertId: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid alert ID');
    expect(alertDirectory.findSummary).not.toHaveBeenCalled();
  });

  it('propagates an alert lookup failure', async () => {
    (alertDirectory.findSummary as any).mockResolvedValue(
      Result.fail('Database error finding alert summary: boom')
    );

    const result = await useCase.execute({ alertId: ALERT_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });
});
