// Source: src/domain/tickets/aggregates/Technician.ts

import { describe, it, expect } from '@jest/globals';
import {
  Technician,
  ContactPhone,
  TechnicianCreatedEvent,
  TechnicianUpdatedEvent
} from '../../../../src/domain/tickets';
import { UserId } from '../../../../src/domain/shared/ids';

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Andrés Muñoz',
    phone: ContactPhone.reconstitute('+573001112233'),
    email: null,
    userId: null,
    ...overrides
  } as Parameters<typeof Technician.create>[0];
}

function makeTechnician(
  overrides: Record<string, unknown> = {}
): Technician {
  const result = Technician.create(makeProps(overrides));
  if (result.isFailure) {
    throw new Error(`fixture failed: ${result.error}`);
  }
  return result.value;
}

describe('Technician', () => {
  describe('create()', () => {
    it('[TKT-094] should create an active technician by default', () => {
      const technician = makeTechnician();

      expect(technician.isActive).toBe(true);
    });

    it('should emit a TechnicianCreatedEvent', () => {
      const technician = makeTechnician();

      expect(technician.domainEvents[0]).toBeInstanceOf(
        TechnicianCreatedEvent
      );
    });

    it('should trim the full name', () => {
      expect(
        makeTechnician({ fullName: '  Ana Ruiz  ' }).fullName
      ).toBe('Ana Ruiz');
    });

    it('[TKT-090] should reject an empty name', () => {
      const result = Technician.create(makeProps({ fullName: '  ' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Technician name cannot be empty'
      );
    });

    it('[TKT-091] should reject a name longer than 150 characters', () => {
      const result = Technician.create(
        makeProps({ fullName: 'x'.repeat(151) })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('cannot exceed 150 characters');
    });

    it('[TKT-092] should reject a technician with no phone', () => {
      const result = Technician.create(makeProps({ phone: null }));

      expect(result.isFailure).toBe(true);
    });

    it('[TKT-093] should reject a malformed email', () => {
      const result = Technician.create(
        makeProps({ email: 'not-an-email' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('must be a valid email address');
    });

    it('[TKT-093] should accept a well formed email', () => {
      const result = Technician.create(
        makeProps({ email: 'tech@isp.example' })
      );

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('rename()', () => {
    it('should update the name and emit an update event', () => {
      const technician = makeTechnician();
      technician.clearEvents();

      const result = technician.rename('Andrés M. Muñoz');

      expect(result.isSuccess).toBe(true);
      expect(technician.fullName).toBe('Andrés M. Muñoz');
      expect(technician.domainEvents[0]).toBeInstanceOf(
        TechnicianUpdatedEvent
      );
    });

    it('should be a no-op when the name is unchanged', () => {
      const technician = makeTechnician();
      technician.clearEvents();

      technician.rename('Andrés Muñoz');

      expect(technician.domainEvents).toHaveLength(0);
    });

    it('[TKT-090] should reject an empty name', () => {
      const technician = makeTechnician();

      expect(technician.rename('   ').isFailure).toBe(true);
    });
  });

  describe('changePhone()', () => {
    it('should replace the phone number', () => {
      const technician = makeTechnician();
      const newPhone = ContactPhone.reconstitute('+573009998877');

      const result = technician.changePhone(newPhone);

      expect(result.isSuccess).toBe(true);
      expect(technician.phone.value).toBe('+573009998877');
    });

    it('should be a no-op when the phone is unchanged', () => {
      const technician = makeTechnician();
      technician.clearEvents();

      technician.changePhone(
        ContactPhone.reconstitute('+573001112233')
      );

      expect(technician.domainEvents).toHaveLength(0);
    });
  });

  describe('changeEmail()', () => {
    it('should normalize the email to lowercase', () => {
      const technician = makeTechnician();

      technician.changeEmail('Tech@ISP.Example');

      expect(technician.email).toBe('tech@isp.example');
    });

    it('should allow clearing the email', () => {
      const technician = makeTechnician({
        email: 'tech@isp.example'
      });

      technician.changeEmail(null);

      expect(technician.email).toBeNull();
    });

    it('[TKT-093] should reject a malformed email', () => {
      const technician = makeTechnician();

      expect(technician.changeEmail('nope').isFailure).toBe(true);
    });
  });

  describe('linkUser()', () => {
    it('should attach a user account', () => {
      const technician = makeTechnician();
      const userId = UserId.create();

      const result = technician.linkUser(userId);

      expect(result.isSuccess).toBe(true);
      expect(technician.userId!.equals(userId)).toBe(true);
    });

    it('should be a no-op when the same user is linked again', () => {
      const userId = UserId.create();
      const technician = makeTechnician({ userId });
      technician.clearEvents();

      technician.linkUser(userId);

      expect(technician.domainEvents).toHaveLength(0);
    });

    it('should allow unlinking', () => {
      const technician = makeTechnician({ userId: UserId.create() });

      technician.linkUser(null);

      expect(technician.userId).toBeNull();
    });
  });

  describe('activate()/deactivate()', () => {
    it('[TKT-094] should be a no-op when already active', () => {
      const technician = makeTechnician();
      technician.clearEvents();

      technician.activate();

      expect(technician.domainEvents).toHaveLength(0);
    });

    it('should deactivate an active technician', () => {
      const technician = makeTechnician();
      technician.clearEvents();

      technician.deactivate();

      expect(technician.isActive).toBe(false);
      expect(technician.domainEvents).toHaveLength(1);
    });

    it('should reactivate a deactivated technician', () => {
      const technician = makeTechnician();
      technician.deactivate();

      technician.activate();

      expect(technician.isActive).toBe(true);
    });
  });
});
