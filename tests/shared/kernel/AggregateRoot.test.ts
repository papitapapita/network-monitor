import {
  AggregateRoot,
  Entity,
  UniqueEntityID
} from '../../../src/domain/shared/kernel';
import { IDomainEvent } from '../../../src/domain/shared/interfaces';

// ---------------------------
// Domain Event Fake
// ---------------------------
class FakeDomainEvent implements IDomainEvent {
  public dateTimeOccurred: Date = new Date();

  constructor(private readonly id: UniqueEntityID) {}

  getAggregateId(): UniqueEntityID {
    return this.id;
  }
}

// ---------------------------
// Concrete class for testing
// ---------------------------
interface FakeProps {
  name: string;
}

class FakeAggregateRoot extends AggregateRoot<FakeProps> {
  constructor(props: FakeProps, id?: UniqueEntityID) {
    super(props, id);
  }

  // Expose protected method ONLY for unit testing
  public publish(event: IDomainEvent) {
    this.addDomainEvent(event);
  }
}

describe('AggregateRoot (abstract class)', () => {
  it('should extend Entity', () => {
    const aggregate = new FakeAggregateRoot({ name: 'Test' });

    expect(aggregate).toBeInstanceOf(Entity);
  });

  it('should start with an empty list of domain events', () => {
    const aggregate = new FakeAggregateRoot({ name: 'Test' });

    expect(aggregate.domainEvents.length).toBe(0);
  });

  it('should add domain events using addDomainEvent()', () => {
    const aggregate = new FakeAggregateRoot({ name: 'Test' });
    const event = new FakeDomainEvent(new UniqueEntityID());

    aggregate.publish(event);

    expect(aggregate.domainEvents.length).toBe(1);
    expect(aggregate.domainEvents[0]).toBe(event);
  });

  it('should preserve the order of domain events', () => {
    const aggregate = new FakeAggregateRoot({ name: 'Test' });

    const event1 = new FakeDomainEvent(new UniqueEntityID());
    const event2 = new FakeDomainEvent(new UniqueEntityID());

    aggregate.publish(event1);
    aggregate.publish(event2);

    expect(aggregate.domainEvents[0]).toBe(event1);
    expect(aggregate.domainEvents[1]).toBe(event2);
  });

  it('should clear events when clearEvents() is called', () => {
    const aggregate = new FakeAggregateRoot({ name: 'Test' });

    const event = new FakeDomainEvent(new UniqueEntityID());
    aggregate.publish(event);

    expect(aggregate.domainEvents.length).toBe(1);

    aggregate.clearEvents();

    expect(aggregate.domainEvents.length).toBe(0);
  });

  it('should not allow external mutation of the internal events array', () => {
    const aggregate = new FakeAggregateRoot({ name: 'Test' });
    const event = new FakeDomainEvent(new UniqueEntityID());
    aggregate.publish(event);

    const external = aggregate.domainEvents;
    external.push(event); // attempt to mutate externally

    expect(aggregate.domainEvents.length).toBe(1);
  });

  it('should return a copy of the domain events array instead of the original', () => {
    const aggregate = new FakeAggregateRoot({ name: 'Test' });

    const event1 = new FakeDomainEvent(new UniqueEntityID());
    const event2 = new FakeDomainEvent(new UniqueEntityID());

    const external = aggregate.domainEvents;
    aggregate.publish(event1);
    expect(external.length).toBe(0);

    aggregate.publish(event2);
    expect(external.length).toBe(0);
    expect(aggregate.domainEvents.length).toBe(2);
  });
});
