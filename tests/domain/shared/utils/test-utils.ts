import {
  IDomainEvent,
  UniqueEntityID,
  Result,
  AggregateRoot
} from '../../../src/domain/device-inventory';

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
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): Result<TestID> {
    try {
      const testId = new TestID(id);
      return Result.ok<TestID>(testId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<TestID>(errorMessage);
    }
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
