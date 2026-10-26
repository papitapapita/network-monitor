// Source: src/domain/customers/aggregates/Customer.ts

import { describe, it, expect } from '@jest/globals';
import {
  Customer,
  CustomerProps,
  PhoneNumber,
  Cedula,
  EmailAddress,
  CustomerCreatedEvent,
  CustomerUpdatedEvent
} from '../../../../src/domain/customers';

function makePhone(value = '3001234567'): PhoneNumber {
  return PhoneNumber.create(value).value;
}

function validProps(
  overrides: Partial<
    Omit<CustomerProps, 'createdAt' | 'updatedAt'>
  > = {}
): Omit<CustomerProps, 'createdAt' | 'updatedAt'> {
  return {
    fullName: 'Juan Perez',
    phone: makePhone(),
    email: null,
    cedula: null,
    ...overrides
  };
}

describe('Customer', () => {
  describe('create()', () => {
    it('should succeed with required fields only', () => {
      const result = Customer.create(validProps());
      expect(result.isSuccess).toBe(true);
    });

    it('should trim the full name', () => {
      const customer = Customer.create(
        validProps({ fullName: '  Juan Perez  ' })
      ).value;
      expect(customer.fullName).toBe('Juan Perez');
    });

    it('should default email and cedula to null', () => {
      const customer = Customer.create(validProps()).value;
      expect(customer.email).toBeNull();
      expect(customer.cedula).toBeNull();
    });

    it('should emit a CustomerCreatedEvent', () => {
      const customer = Customer.create(validProps()).value;
      expect(customer.domainEvents).toHaveLength(1);
      expect(customer.domainEvents[0]).toBeInstanceOf(
        CustomerCreatedEvent
      );
    });

    it('should fail with an empty name', () => {
      const result = Customer.create(validProps({ fullName: '   ' }));
      expect(result.isFailure).toBe(true);
    });

    it('should fail when phone is missing', () => {
      const result = Customer.create(
        validProps({ phone: null as unknown as PhoneNumber })
      );
      expect(result.isFailure).toBe(true);
    });
  });

  describe('rename()', () => {
    it('should update the name and emit CustomerUpdatedEvent', () => {
      const customer = Customer.create(validProps()).value;
      customer.clearEvents();

      const result = customer.rename('Pedro Gomez');

      expect(result.isSuccess).toBe(true);
      expect(customer.fullName).toBe('Pedro Gomez');
      expect(customer.domainEvents[0]).toBeInstanceOf(
        CustomerUpdatedEvent
      );
    });

    it('should be a no-op when the name is unchanged', () => {
      const customer = Customer.create(validProps()).value;
      customer.clearEvents();

      customer.rename('Juan Perez');

      expect(customer.domainEvents).toHaveLength(0);
    });

    it('should fail for an empty name', () => {
      const customer = Customer.create(validProps()).value;
      expect(customer.rename('  ').isFailure).toBe(true);
    });
  });

  describe('changeEmail()', () => {
    it('should set a new email', () => {
      const customer = Customer.create(validProps()).value;
      customer.clearEvents();

      customer.changeEmail(EmailAddress.create('a@b.com').value);

      expect(customer.email?.value).toBe('a@b.com');
      expect(customer.domainEvents).toHaveLength(1);
    });

    it('should be a no-op when both old and new are null', () => {
      const customer = Customer.create(validProps()).value;
      customer.clearEvents();

      customer.changeEmail(null);

      expect(customer.domainEvents).toHaveLength(0);
    });
  });

  describe('changeCedula()', () => {
    it('should set a new cedula', () => {
      const customer = Customer.create(validProps()).value;
      customer.clearEvents();

      customer.changeCedula(Cedula.create('1036612').value);

      expect(customer.cedula?.value).toBe('1036612');
      expect(customer.domainEvents).toHaveLength(1);
    });
  });

  describe('changePhone()', () => {
    it('should be a no-op for the same phone', () => {
      const customer = Customer.create(validProps()).value;
      customer.clearEvents();

      customer.changePhone(makePhone('300 123 4567'));

      expect(customer.domainEvents).toHaveLength(0);
    });
  });
});
