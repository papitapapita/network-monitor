import {
  FakeAggregateRoot,
  TestID,
  FakeDomainEvent
} from '../../../src/domain/shared/__tests__/test-utils';
import { Entity } from '../../../src/domain';

describe('AggregateRoot (abstract class)', () => {
  it('should extend Entity', () => {
    const idResult = TestID.create();
    if (idResult.isFailure) {
      throw new Error(`Test setup failed: ${idResult.error}`);
    }

    const id = idResult.value; // or .value depending on your Result API

    // 2. Create the aggregate
    const aggregate = FakeAggregateRoot.create({ name: 'Test' }, id);

    // 3. Perform the check
    // Note: if aggregate is also returned as a Result, you'll need to unwrap it too!
    expect(aggregate.value).toBeInstanceOf(Entity);
  });

  it('should start with an empty list of domain events', () => {
    const aggregate = FakeAggregateRoot.create(
      { name: 'Test' },
      TestID.create().value
    );

    expect(aggregate.value.domainEvents.length).toBe(0);
  });

  it('should add domain events using addDomainEvent()', () => {
    const result = FakeAggregateRoot.create(
      { name: 'Test' },
      TestID.create().value
    );
    const aggregate = result.value;
    const event = new FakeDomainEvent(TestID.create().value);

    aggregate.publish(event);

    expect(aggregate.domainEvents.length).toBe(1);
    expect(aggregate.domainEvents[0]).toBe(event);
  });

  it('should preserve the order of domain events', () => {
    const result = FakeAggregateRoot.create(
      { name: 'Test' },
      TestID.create().value
    );

    const aggregate = result.value;

    const event1 = new FakeDomainEvent(TestID.create().value);
    const event2 = new FakeDomainEvent(TestID.create().value);

    aggregate.publish(event1);
    aggregate.publish(event2);

    expect(aggregate.domainEvents[0]).toBe(event1);
    expect(aggregate.domainEvents[1]).toBe(event2);
  });

  it('should clear events when clearEvents() is called', () => {
    const result = FakeAggregateRoot.create(
      { name: 'Test' },
      TestID.create().value
    );

    const aggregate = result.value;

    const event = new FakeDomainEvent(TestID.create().value);
    aggregate.publish(event);

    expect(aggregate.domainEvents.length).toBe(1);

    aggregate.clearEvents();

    expect(aggregate.domainEvents.length).toBe(0);
  });

  it('should not allow external mutation of the internal events array', () => {
    const result = FakeAggregateRoot.create(
      { name: 'Test' },
      TestID.create().value
    );
    const aggregate = result.value;

    const event = new FakeDomainEvent(TestID.create().value);
    aggregate.publish(event);

    const external = aggregate.domainEvents;
    external.push(event); // attempt to mutate externally

    expect(aggregate.domainEvents.length).toBe(1);
  });

  it('should return a copy of the domain events array instead of the original', () => {
    const result = FakeAggregateRoot.create(
      { name: 'Test' },
      TestID.create().value
    );

    const aggregate = result.value;

    const event1 = new FakeDomainEvent(TestID.create().value);
    const event2 = new FakeDomainEvent(TestID.create().value);

    const external = aggregate.domainEvents;
    aggregate.publish(event1);
    expect(external.length).toBe(0);

    aggregate.publish(event2);
    expect(external.length).toBe(0);
    expect(aggregate.domainEvents.length).toBe(2);
  });
});
