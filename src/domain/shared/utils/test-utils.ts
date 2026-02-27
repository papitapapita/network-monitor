import { UniqueEntityID, Result, AggregateRoot } from '../core';
import { IDomainEvent } from '../interfaces';

export class FakeDomainEvent implements IDomainEvent {
  public dateTimeOccurred: Date = new Date();

  constructor(private readonly id: TestID) {}

  get aggregateId(): TestID {
    return this.id;
  }
}

// ---------------------------
// Concrete class for testing
// ---------------------------
export interface FakeProps {
  name: string;
}

export class TestID extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): TestID {
    return new TestID(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<TestID> {
    const result = UniqueEntityID.parseId(id);
    if (result.isFailure) {
      return Result.fail<TestID>(result.error);
    }
    return Result.ok<TestID>(new TestID(result.value.toString()));
  }
}

export class FakeAggregateRoot extends AggregateRoot<
  FakeProps,
  TestID
> {
  private constructor(props: FakeProps, id: TestID) {
    super(props, id);
  }

  public static create(
    props: FakeProps,
    id: TestID
  ): Result<FakeAggregateRoot> {
    const aggregate = new FakeAggregateRoot(props, id);
    if (!aggregate) {
      return Result.fail<FakeAggregateRoot>(
        'Failed to create FakeAggregateRoot'
      );
    }
    return Result.ok<FakeAggregateRoot>(aggregate);
  }

  // Expose protected method ONLY for unit testing
  public publish(event: IDomainEvent) {
    this.addDomainEvent(event);
  }
}
