// Source: src/domain/shared/core/AggregateRoot.ts

import {
  FakeAggregateRoot,
  TestID,
  FakeDomainEvent
} from '../../../../src/domain/shared/utils';
import { Entity, Result } from '../../../../src/domain/shared/core';

// ---------------------------------------------------------------------------
// Well-known UUID v4 constants used across the suite
// ---------------------------------------------------------------------------
const VALID_UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_B = '6f9619ff-8b86-4c07-ac22-a5d5e5d3a715';
const VALID_UUID_C = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const VALID_UUID_D = 'c47a8b2e-1f3d-4a6b-8e0c-9f2d3a5b7c4e';

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

/**
 * Unwraps a Result or throws a clearly labelled error, so that test setup
 * failures surface as an explicit message rather than a cryptic undefined access.
 */
function unwrap<T>(result: Result<T>, context: string): T {
  if (result.isFailure) {
    throw new Error(
      `Test setup failed [${context}]: ${result.error}`
    );
  }
  return result.value;
}

/** Creates a TestID from a well-known UUID string. */
function makeID(uuid: string): TestID {
  return unwrap(TestID.parse(uuid), `makeID(${uuid})`);
}

/**
 * Creates a FakeAggregateRoot with the given ID (or a default one).
 * Throws if creation fails so that the failure is visible at the test level.
 */
function makeAggregate(id?: TestID): FakeAggregateRoot {
  const resolvedId = id ?? makeID(VALID_UUID_A);
  return unwrap(
    FakeAggregateRoot.create({ name: 'TestAggregate' }, resolvedId),
    'makeAggregate'
  );
}

/** Creates a FakeDomainEvent bound to the given UUID. */
function makeEvent(uuid: string): FakeDomainEvent {
  return new FakeDomainEvent(makeID(uuid));
}

// ===========================================================================
describe('AggregateRoot', () => {
  // =========================================================================
  describe('inheritance from Entity', () => {
    it('should be an instance of Entity', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));

      expect(aggregate).toBeInstanceOf(Entity);
    });

    it('should return true from Entity.isEntity() static type guard', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));

      expect(Entity.isEntity(aggregate)).toBe(true);
    });

    it('should expose the id getter and return the TestID instance passed at creation', () => {
      const id = makeID(VALID_UUID_A);
      const aggregate = makeAggregate(id);

      expect(aggregate.id).toBe(id);
    });

    it('should return the correct UUID string via the id getter', () => {
      const id = makeID(VALID_UUID_A);
      const aggregate = makeAggregate(id);

      expect(aggregate.id.toValue()).toBe(VALID_UUID_A);
    });

    it('should return the same id reference on repeated accesses', () => {
      const id = makeID(VALID_UUID_A);
      const aggregate = makeAggregate(id);

      expect(aggregate.id).toBe(aggregate.id);
    });

    it('should return true from equals() when compared with itself', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));

      expect(aggregate.equals(aggregate)).toBe(true);
    });

    it('should return true from equals() for two aggregates that share the same TestID instance', () => {
      const sharedId = makeID(VALID_UUID_A);
      const aggregate1 = makeAggregate(sharedId);
      const aggregate2 = makeAggregate(sharedId);

      expect(aggregate1.equals(aggregate2)).toBe(true);
    });

    it('should return false from equals() for two aggregates with different IDs', () => {
      const aggregate1 = makeAggregate(makeID(VALID_UUID_A));
      const aggregate2 = makeAggregate(makeID(VALID_UUID_B));

      expect(aggregate1.equals(aggregate2)).toBe(false);
    });

    it('should return false from equals() when passed null', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));

      expect(
        aggregate.equals(null as unknown as FakeAggregateRoot)
      ).toBe(false);
    });

    it('should return false from equals() when passed undefined', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));

      expect(aggregate.equals(undefined)).toBe(false);
    });

    it('should return false from equals() when compared with a plain object that is not an Entity', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const plainObject = { id: aggregate.id };

      expect(
        aggregate.equals(plainObject as unknown as FakeAggregateRoot)
      ).toBe(false);
    });
  });

  // =========================================================================
  describe('domainEvents getter — initial state', () => {
    it('should start with an empty domain events array on creation', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));

      expect(aggregate.domainEvents).toHaveLength(0);
    });

    it('should return an array (not null or undefined) even before any events are added', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));

      expect(Array.isArray(aggregate.domainEvents)).toBe(true);
    });
  });

  // =========================================================================
  describe('addDomainEvent() (exposed via publish() on FakeAggregateRoot)', () => {
    it('should add a single domain event to the events list', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const event = makeEvent(VALID_UUID_B);

      aggregate.publish(event);

      expect(aggregate.domainEvents).toHaveLength(1);
    });

    it('should store the exact event instance that was published', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const event = makeEvent(VALID_UUID_B);

      aggregate.publish(event);

      expect(aggregate.domainEvents[0]).toBe(event);
    });

    it('should add multiple domain events and reflect the correct count', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const event1 = makeEvent(VALID_UUID_B);
      const event2 = makeEvent(VALID_UUID_C);
      const event3 = makeEvent(VALID_UUID_D);

      aggregate.publish(event1);
      aggregate.publish(event2);
      aggregate.publish(event3);

      expect(aggregate.domainEvents).toHaveLength(3);
    });

    it('should preserve insertion order when multiple events are published', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const event1 = makeEvent(VALID_UUID_B);
      const event2 = makeEvent(VALID_UUID_C);
      const event3 = makeEvent(VALID_UUID_D);

      aggregate.publish(event1);
      aggregate.publish(event2);
      aggregate.publish(event3);

      const events = aggregate.domainEvents;
      expect(events[0]).toBe(event1);
      expect(events[1]).toBe(event2);
      expect(events[2]).toBe(event3);
    });

    it('should store multiple different event instances independently', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const event1 = makeEvent(VALID_UUID_B);
      const event2 = makeEvent(VALID_UUID_C);

      aggregate.publish(event1);
      aggregate.publish(event2);

      const events = aggregate.domainEvents;
      expect(events[0]).not.toBe(events[1]);
      expect(events[0]).toBe(event1);
      expect(events[1]).toBe(event2);
    });

    it('should allow the same event instance to be published more than once', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const event = makeEvent(VALID_UUID_B);

      aggregate.publish(event);
      aggregate.publish(event);

      expect(aggregate.domainEvents).toHaveLength(2);
      expect(aggregate.domainEvents[0]).toBe(event);
      expect(aggregate.domainEvents[1]).toBe(event);
    });

    it('should correctly store the aggregateId of the event', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const eventId = makeID(VALID_UUID_B);
      const event = new FakeDomainEvent(eventId);

      aggregate.publish(event);

      expect(aggregate.domainEvents[0].aggregateId).toBe(eventId);
    });

    it('should correctly store the dateTimeOccurred of the event', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const event = makeEvent(VALID_UUID_B);
      const eventDate = event.dateTimeOccurred;

      aggregate.publish(event);

      expect(aggregate.domainEvents[0].dateTimeOccurred).toBe(
        eventDate
      );
    });
  });

  // =========================================================================
  describe('clearEvents()', () => {
    it('should remove all events after clearEvents() is called', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      aggregate.publish(makeEvent(VALID_UUID_B));
      aggregate.publish(makeEvent(VALID_UUID_C));

      aggregate.clearEvents();

      expect(aggregate.domainEvents).toHaveLength(0);
    });

    it('should not throw when clearEvents() is called on an aggregate with no events', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));

      expect(() => aggregate.clearEvents()).not.toThrow();
    });

    it('should leave the events list empty after calling clearEvents() on an already-empty aggregate', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));

      aggregate.clearEvents();

      expect(aggregate.domainEvents).toHaveLength(0);
    });

    it('should allow calling clearEvents() multiple times without throwing', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      aggregate.publish(makeEvent(VALID_UUID_B));

      aggregate.clearEvents();
      aggregate.clearEvents();

      expect(aggregate.domainEvents).toHaveLength(0);
    });

    it('should allow new events to be published after clearEvents() has been called', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      aggregate.publish(makeEvent(VALID_UUID_B));

      aggregate.clearEvents();

      const newEvent = makeEvent(VALID_UUID_C);
      aggregate.publish(newEvent);

      expect(aggregate.domainEvents).toHaveLength(1);
      expect(aggregate.domainEvents[0]).toBe(newEvent);
    });

    it('should discard all previously published events and only retain newly published ones after clearing', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const oldEvent = makeEvent(VALID_UUID_B);
      aggregate.publish(oldEvent);

      aggregate.clearEvents();

      const freshEvent = makeEvent(VALID_UUID_C);
      aggregate.publish(freshEvent);

      const events = aggregate.domainEvents;
      expect(events).not.toContain(oldEvent);
      expect(events).toContain(freshEvent);
    });
  });

  // =========================================================================
  describe('domainEvents getter — defensive copy behaviour', () => {
    it('should return a new array reference on each call to domainEvents', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      aggregate.publish(makeEvent(VALID_UUID_B));

      const snapshot1 = aggregate.domainEvents;
      const snapshot2 = aggregate.domainEvents;

      expect(snapshot1).not.toBe(snapshot2);
    });

    it('should not mutate internal state when an item is pushed onto the returned array', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const event = makeEvent(VALID_UUID_B);
      aggregate.publish(event);

      const externalCopy = aggregate.domainEvents;
      externalCopy.push(makeEvent(VALID_UUID_C));

      expect(aggregate.domainEvents).toHaveLength(1);
    });

    it('should not mutate internal state when an item is removed from the returned array', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      aggregate.publish(makeEvent(VALID_UUID_B));
      aggregate.publish(makeEvent(VALID_UUID_C));

      const externalCopy = aggregate.domainEvents;
      externalCopy.splice(0, 1);

      expect(aggregate.domainEvents).toHaveLength(2);
    });

    it('should not reflect events added after a snapshot was taken', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const snapshot = aggregate.domainEvents;

      aggregate.publish(makeEvent(VALID_UUID_B));

      expect(snapshot).toHaveLength(0);
      expect(aggregate.domainEvents).toHaveLength(1);
    });

    it('should not reflect events cleared after a snapshot was taken', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      aggregate.publish(makeEvent(VALID_UUID_B));

      const snapshot = aggregate.domainEvents;

      aggregate.clearEvents();

      expect(snapshot).toHaveLength(1);
      expect(aggregate.domainEvents).toHaveLength(0);
    });

    it('should return the correct elements in the snapshot even after further events are published', () => {
      const aggregate = makeAggregate(makeID(VALID_UUID_A));
      const event1 = makeEvent(VALID_UUID_B);
      aggregate.publish(event1);

      const snapshot = aggregate.domainEvents;

      aggregate.publish(makeEvent(VALID_UUID_C));

      expect(snapshot).toHaveLength(1);
      expect(snapshot[0]).toBe(event1);
    });
  });

  // =========================================================================
  describe('isolation between aggregate instances', () => {
    it('should not share domain events between two independently created aggregates', () => {
      const aggregate1 = makeAggregate(makeID(VALID_UUID_A));
      const aggregate2 = makeAggregate(makeID(VALID_UUID_B));

      aggregate1.publish(makeEvent(VALID_UUID_C));

      expect(aggregate1.domainEvents).toHaveLength(1);
      expect(aggregate2.domainEvents).toHaveLength(0);
    });

    it('should clear only the events of the target aggregate without affecting a sibling', () => {
      const aggregate1 = makeAggregate(makeID(VALID_UUID_A));
      const aggregate2 = makeAggregate(makeID(VALID_UUID_B));

      aggregate1.publish(makeEvent(VALID_UUID_C));
      aggregate2.publish(makeEvent(VALID_UUID_D));

      aggregate1.clearEvents();

      expect(aggregate1.domainEvents).toHaveLength(0);
      expect(aggregate2.domainEvents).toHaveLength(1);
    });

    it('should accumulate events independently on each aggregate instance', () => {
      const aggregate1 = makeAggregate(makeID(VALID_UUID_A));
      const aggregate2 = makeAggregate(makeID(VALID_UUID_B));

      const event1 = makeEvent(VALID_UUID_C);
      const event2 = makeEvent(VALID_UUID_D);

      aggregate1.publish(event1);
      aggregate2.publish(event2);

      expect(aggregate1.domainEvents[0]).toBe(event1);
      expect(aggregate2.domainEvents[0]).toBe(event2);
      expect(aggregate1.domainEvents[0]).not.toBe(
        aggregate2.domainEvents[0]
      );
    });
  });
});

// TODO: Test - verifying that AggregateRoot.equals() is symmetric (a1.equals(a2) === a2.equals(a1)) when IDs are shared
// TODO: Test - verifying that AggregateRoot.equals() is transitive across three aggregates sharing the same ID
// TODO: Test - verifying behaviour when clearEvents() is called concurrently (if the domain ever moves to async contexts)
// TODO: Test - verifying that event order is stable when the same UUID is reused across events with different timestamps
