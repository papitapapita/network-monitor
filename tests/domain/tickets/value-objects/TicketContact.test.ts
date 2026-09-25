// Source: src/domain/tickets/value-objects/TicketContact.ts

import { describe, it, expect } from '@jest/globals';
import { TicketContact } from '../../../../src/domain/tickets';

describe('TicketContact', () => {
  describe('create()', () => {
    it('should succeed with a name and a phone', () => {
      const result = TicketContact.create({
        name: 'Luis Prospecto',
        phone: '(300) 555-1234'
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('Luis Prospecto');
      expect(result.value.phone!.toString()).toBe('3005551234');
    });

    it('[TKT-012] should succeed with a name and no phone', () => {
      const result = TicketContact.create({ name: 'Luis Prospecto' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.phone).toBeNull();
    });

    it('should trim the name', () => {
      const result = TicketContact.create({ name: '  Luis  ' });

      expect(result.value.name).toBe('Luis');
    });

    it('[TKT-012] should refuse a blank name', () => {
      const result = TicketContact.create({
        name: '   ',
        phone: '3005551234'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Contact name cannot be empty');
    });

    it('[TKT-012] should refuse a missing name', () => {
      const result = TicketContact.create({
        name: undefined as unknown as string
      });

      expect(result.isFailure).toBe(true);
    });

    it('should refuse a name over 150 characters', () => {
      const result = TicketContact.create({ name: 'a'.repeat(151) });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('cannot exceed 150');
    });

    it('should refuse an unusable phone', () => {
      const result = TicketContact.create({
        name: 'Luis Prospecto',
        phone: '12'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid contact phone');
    });
  });
});
