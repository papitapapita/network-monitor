// Source: src/application/tickets/use-cases/OpenTicketFromAlertUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { OpenTicketFromAlertUseCase } from '../../../../src/application/tickets/use-cases';
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

describe('OpenTicketFromAlertUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let customerDirectory: ReturnType<typeof makeCustomerDirectory>;
  let deviceDirectory: ReturnType<typeof makeDeviceDirectory>;
  let useCase: OpenTicketFromAlertUseCase;

  const request = (overrides: Record<string, string> = {}) => ({
    origin: 'WIRELESS_ALERT',
    alertId: ALERT_ID,
    deviceId: deviceSummary.id,
    severity: 'CRITICAL',
    message: 'SNR below threshold',
    ...overrides
  });

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    customerDirectory = makeCustomerDirectory();
    deviceDirectory = makeDeviceDirectory();
    useCase = new OpenTicketFromAlertUseCase(
      ticketRepo,
      customerDirectory,
      deviceDirectory,
      makeLogger()
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

  it('opens a ticket referencing the alert', async () => {
    const result = await useCase.execute(request());

    expect(result.isSuccess).toBe(true);
    expect(result.value.originAlertId).toBe(ALERT_ID);
    expect(result.value.origin).toBe('WIRELESS_ALERT');
    expect(ticketRepo.save).toHaveBeenCalledTimes(1);
  });

  it('[TKT-114] maps CRITICAL to URGENT', async () => {
    const result = await useCase.execute(
      request({ severity: 'CRITICAL' })
    );

    expect(result.value.priority).toBe('URGENT');
  });

  it.each(['WARNING', 'warning', '', 'ANYTHING_ELSE'])(
    '[TKT-114] maps %s to HIGH',
    async (severity) => {
      const result = await useCase.execute(request({ severity }));

      expect(result.value.priority).toBe('HIGH');
    }
  );

  it('[TKT-114] is case-insensitive about CRITICAL', async () => {
    const result = await useCase.execute(
      request({ severity: ' critical ' })
    );

    expect(result.value.priority).toBe('URGENT');
  });

  it('titles the ticket with the device name and the alert message', async () => {
    const result = await useCase.execute(request());

    expect(result.value.title).toBe('CPE-Marta: SNR below threshold');
  });

  it('[TKT-002] truncates a title that would exceed 150 characters', async () => {
    const result = await useCase.execute(
      request({ message: 'x'.repeat(200) })
    );

    expect(result.value.title.length).toBe(150);
    expect(result.value.title.endsWith('…')).toBe(true);
  });

  it('[TKT-113] returns the existing ticket when the same alert re-fires', async () => {
    const existing = makeTicket();
    (ticketRepo.findActiveByOrigin as any).mockResolvedValue(
      Result.ok(existing)
    );

    const result = await useCase.execute(request());

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe(existing.id.toString());
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('[TKT-113] returns the existing ticket when the device already has one', async () => {
    const existing = makeTicket();
    (
      ticketRepo.findActiveAlertTicketForDevice as any
    ).mockResolvedValue(Result.ok(existing));

    const result = await useCase.execute(request());

    expect(result.value.id).toBe(existing.id.toString());
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('opens the ticket with no customer when the device serves nobody', async () => {
    (customerDirectory.findContactByDevice as any).mockResolvedValue(
      Result.ok(null)
    );

    const result = await useCase.execute(request());

    expect(result.isSuccess).toBe(true);
    expect(result.value.customerId).toBeNull();
  });

  it('[TKT-112] refuses a MANUAL origin', async () => {
    const result = await useCase.execute(
      request({ origin: 'MANUAL' })
    );

    expect(result.isFailure).toBe(true);
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('refuses an unknown origin', async () => {
    const result = await useCase.execute(
      request({ origin: 'CARRIER_PIGEON' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid ticket origin');
  });

  it('[TKT-110] refuses a malformed alert id', async () => {
    const result = await useCase.execute(
      request({ alertId: 'nope' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('must be a valid UUID');
  });

  it('fails when the device is unknown', async () => {
    (deviceDirectory.findSummary as any).mockResolvedValue(
      Result.ok(null)
    );

    const result = await useCase.execute(request());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Device not found');
  });

  it('propagates a repository failure from the dedupe lookup', async () => {
    (ticketRepo.findActiveByOrigin as any).mockResolvedValue(
      Result.fail('Database error finding ticket by origin: boom')
    );

    const result = await useCase.execute(request());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('propagates a persistence failure', async () => {
    (ticketRepo.save as any).mockResolvedValue(
      Result.fail('Database error saving ticket: boom')
    );

    const result = await useCase.execute(request());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to persist ticket');
  });

  it('requires an alert id', async () => {
    const result = await useCase.execute(request({ alertId: '  ' }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Alert ID is required');
  });

  it('requires a device id', async () => {
    const result = await useCase.execute(request({ deviceId: '' }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Device ID is required');
  });
});
