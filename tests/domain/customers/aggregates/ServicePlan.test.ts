// Source: src/domain/customers/aggregates/ServicePlan.ts

import { describe, it, expect } from '@jest/globals';
import {
  ServicePlan,
  ServicePlanCreatedEvent,
  ServicePlanUpdatedEvent
} from '../../../../src/domain/customers';

function validProps(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Plan 50/10',
    downloadMbps: 50,
    uploadMbps: 10,
    monthlyPrice: 80000,
    description: null,
    ...overrides
  };
}

describe('ServicePlan', () => {
  describe('create()', () => {
    it('should succeed with valid props and default isActive=true', () => {
      const result = ServicePlan.create(validProps());
      expect(result.isSuccess).toBe(true);
      expect(result.value.isActive).toBe(true);
    });

    it('should emit a ServicePlanCreatedEvent', () => {
      const plan = ServicePlan.create(validProps()).value;
      expect(plan.domainEvents[0]).toBeInstanceOf(
        ServicePlanCreatedEvent
      );
    });

    it('should fail with an empty name', () => {
      const result = ServicePlan.create(validProps({ name: '  ' }));
      expect(result.isFailure).toBe(true);
    });

    it('should fail with non-positive download bandwidth', () => {
      const result = ServicePlan.create(
        validProps({ downloadMbps: 0 })
      );
      expect(result.isFailure).toBe(true);
    });

    it('should fail with a negative price', () => {
      const result = ServicePlan.create(
        validProps({ monthlyPrice: -1 })
      );
      expect(result.isFailure).toBe(true);
    });
  });

  describe('updatePricing()', () => {
    it('should update the price and emit an update event', () => {
      const plan = ServicePlan.create(validProps()).value;
      plan.clearEvents();

      const result = plan.updatePricing(90000);

      expect(result.isSuccess).toBe(true);
      expect(plan.monthlyPrice).toBe(90000);
      expect(plan.domainEvents[0]).toBeInstanceOf(
        ServicePlanUpdatedEvent
      );
    });

    it('should reject a negative price', () => {
      const plan = ServicePlan.create(validProps()).value;
      expect(plan.updatePricing(-5).isFailure).toBe(true);
    });
  });

  describe('updateBandwidth()', () => {
    it('should update both directions', () => {
      const plan = ServicePlan.create(validProps()).value;
      plan.updateBandwidth(100, 20);
      expect(plan.downloadMbps).toBe(100);
      expect(plan.uploadMbps).toBe(20);
    });
  });

  describe('activate()/deactivate()', () => {
    it('should be a no-op when already active', () => {
      const plan = ServicePlan.create(validProps()).value;
      plan.clearEvents();
      plan.activate();
      expect(plan.domainEvents).toHaveLength(0);
    });

    it('should deactivate an active plan', () => {
      const plan = ServicePlan.create(validProps()).value;
      plan.clearEvents();
      plan.deactivate();
      expect(plan.isActive).toBe(false);
      expect(plan.domainEvents).toHaveLength(1);
    });
  });
});
