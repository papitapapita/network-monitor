// Source: src/domain/customers/aggregates/ContractedService.ts

import { describe, it, expect } from '@jest/globals';
import {
  ContractedService,
  ContractedServiceStatus,
  ContractedServiceCreatedEvent,
  DeviceAssignedToServiceEvent,
  ContractedServiceStatusChangedEvent,
  ContractedServiceCancelledEvent,
  PaymentDay
} from '../../../../src/domain/customers';
import {
  CustomerId,
  ServicePlanId,
  DeviceId
} from '../../../../src/domain/shared/ids';

function validProps(overrides: Record<string, unknown> = {}) {
  return {
    customerId: CustomerId.create(),
    servicePlanId: ServicePlanId.create(),
    deviceId: null,
    startDate: new Date('2024-01-01T00:00:00Z'),
    paymentDay: PaymentDay.default(),
    ...overrides
  };
}

describe('ContractedService', () => {
  describe('create()', () => {
    it('should default to PENDING status', () => {
      const service = ContractedService.create(validProps()).value;
      expect(service.status).toBe(ContractedServiceStatus.PENDING);
    });

    it('should emit a ContractedServiceCreatedEvent', () => {
      const service = ContractedService.create(validProps()).value;
      expect(service.domainEvents[0]).toBeInstanceOf(
        ContractedServiceCreatedEvent
      );
    });

    it('should fail when created ACTIVE without a device', () => {
      const result = ContractedService.create(
        validProps({ status: ContractedServiceStatus.ACTIVE })
      );
      expect(result.isFailure).toBe(true);
    });

    it('should succeed when created ACTIVE with a device', () => {
      const result = ContractedService.create(
        validProps({
          status: ContractedServiceStatus.ACTIVE,
          deviceId: DeviceId.create()
        })
      );
      expect(result.isSuccess).toBe(true);
    });

    it('should fail with an invalid startDate', () => {
      const result = ContractedService.create(
        validProps({ startDate: 'nope' })
      );
      expect(result.isFailure).toBe(true);
    });

    it('[CUS-024] should carry its own payment day', () => {
      const service = ContractedService.create(
        validProps({ paymentDay: PaymentDay.create(15).value })
      ).value;
      expect(service.paymentDay.value).toBe(15);
    });

    it('should fail when payment day is missing', () => {
      const result = ContractedService.create(
        validProps({ paymentDay: null })
      );
      expect(result.isFailure).toBe(true);
    });
  });

  describe('assignDevice()', () => {
    it('should assign the device and emit DeviceAssignedToServiceEvent', () => {
      const service = ContractedService.create(validProps()).value;
      service.clearEvents();
      const deviceId = DeviceId.create();

      const result = service.assignDevice(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(service.deviceId?.equals(deviceId)).toBe(true);
      expect(service.domainEvents[0]).toBeInstanceOf(
        DeviceAssignedToServiceEvent
      );
    });

    it('should be a no-op when assigning the same device', () => {
      const deviceId = DeviceId.create();
      const service = ContractedService.create(
        validProps({ deviceId })
      ).value;
      service.clearEvents();

      service.assignDevice(deviceId);

      expect(service.domainEvents).toHaveLength(0);
    });
  });

  describe('activate()', () => {
    it('should fail without a device assigned', () => {
      const service = ContractedService.create(validProps()).value;
      expect(service.activate().isFailure).toBe(true);
    });

    it('should transition PENDING -> ACTIVE with a device', () => {
      const service = ContractedService.create(
        validProps({ deviceId: DeviceId.create() })
      ).value;
      service.clearEvents();

      const result = service.activate();

      expect(result.isSuccess).toBe(true);
      expect(service.status).toBe(ContractedServiceStatus.ACTIVE);
      expect(service.domainEvents[0]).toBeInstanceOf(
        ContractedServiceStatusChangedEvent
      );
    });
  });

  describe('releaseDevice()', () => {
    it('should fail while the service is ACTIVE', () => {
      const service = ContractedService.create(
        validProps({ deviceId: DeviceId.create() })
      ).value;
      service.activate();

      expect(service.releaseDevice().isFailure).toBe(true);
    });

    it('should release the device when not active', () => {
      const service = ContractedService.create(
        validProps({ deviceId: DeviceId.create() })
      ).value;
      service.clearEvents();

      const result = service.releaseDevice();

      expect(result.isSuccess).toBe(true);
      expect(service.deviceId).toBeNull();
    });
  });

  describe('cancel()', () => {
    it('should transition to CANCELLED', () => {
      const service = ContractedService.create(validProps()).value;
      service.cancel();
      expect(service.status).toBe(ContractedServiceStatus.CANCELLED);
    });

    it('should make further mutations fail (terminal state)', () => {
      const service = ContractedService.create(validProps()).value;
      service.cancel();

      expect(service.assignDevice(DeviceId.create()).isFailure).toBe(
        true
      );
      expect(service.suspend().isFailure).toBe(true);
      expect(
        service.changePlan(ServicePlanId.create()).isFailure
      ).toBe(true);
    });

    describe('[CUS-106] releases the device', () => {
      it('unbonds the device, even from an ACTIVE service', () => {
        const deviceId = DeviceId.create();
        const service = ContractedService.create(
          validProps({
            status: ContractedServiceStatus.ACTIVE,
            deviceId
          })
        ).value;
        service.clearEvents();

        const result = service.cancel();

        expect(result.isSuccess).toBe(true);
        expect(service.status).toBe(
          ContractedServiceStatus.CANCELLED
        );
        expect(service.deviceId).toBeNull();
        const assigned = service.domainEvents.find(
          (e) => e instanceof DeviceAssignedToServiceEvent
        ) as DeviceAssignedToServiceEvent;
        expect(assigned.previousDeviceId!.equals(deviceId)).toBe(
          true
        );
        expect(assigned.newDeviceId).toBeNull();
      });

      it('announces the cancellation with the released device', () => {
        const deviceId = DeviceId.create();
        const service = ContractedService.create(
          validProps({ deviceId })
        ).value;
        service.clearEvents();

        service.cancel();

        const cancelled = service.domainEvents.find(
          (e) => e instanceof ContractedServiceCancelledEvent
        ) as ContractedServiceCancelledEvent;
        expect(cancelled.releasedDeviceId!.equals(deviceId)).toBe(
          true
        );
        expect(
          service.domainEvents.some(
            (e) => e instanceof ContractedServiceStatusChangedEvent
          )
        ).toBe(true);
      });

      it('announces a null device when the service had none', () => {
        const service = ContractedService.create(validProps()).value;
        service.clearEvents();

        service.cancel();

        expect(
          service.domainEvents.some(
            (e) => e instanceof DeviceAssignedToServiceEvent
          )
        ).toBe(false);
        const cancelled = service.domainEvents.find(
          (e) => e instanceof ContractedServiceCancelledEvent
        ) as ContractedServiceCancelledEvent;
        expect(cancelled.releasedDeviceId).toBeNull();
      });
    });
  });

  describe('changePlan()', () => {
    it('should update the service plan reference', () => {
      const service = ContractedService.create(validProps()).value;
      const newPlanId = ServicePlanId.create();

      const result = service.changePlan(newPlanId);

      expect(result.isSuccess).toBe(true);
      expect(service.servicePlanId.equals(newPlanId)).toBe(true);
    });
  });

  describe('changePaymentDay()', () => {
    it('[CUS-024] should move the service to the other group', () => {
      const service = ContractedService.create(validProps()).value;
      const before = service.updatedAt;

      const result = service.changePaymentDay(
        PaymentDay.create(15).value
      );

      expect(result.isSuccess).toBe(true);
      expect(service.paymentDay.value).toBe(15);
      expect(service.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
    });

    it('should leave the service untouched for the same day', () => {
      const service = ContractedService.create(validProps()).value;
      const before = service.updatedAt;

      service.changePaymentDay(PaymentDay.create(30).value);

      expect(service.updatedAt).toBe(before);
    });

    it('should fail when the day is missing', () => {
      const service = ContractedService.create(validProps()).value;

      const result = service.changePaymentDay(
        null as unknown as PaymentDay
      );

      expect(result.isFailure).toBe(true);
      expect(service.paymentDay.value).toBe(30);
    });

    it('should refuse a cancelled service', () => {
      const service = ContractedService.create(validProps()).value;
      service.cancel();

      const result = service.changePaymentDay(
        PaymentDay.create(15).value
      );

      expect(result.error).toBe(
        'Cannot modify a cancelled contracted service'
      );
      expect(service.paymentDay.value).toBe(30);
    });
  });
});
