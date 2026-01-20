# DOMAIN SERVICES STANDARD

## Table of Contents

1. [Purpose of Domain Services in DDD](#1-purpose-of-domain-services-in-ddd)
2. [Responsibilities of a Domain Service](#2-responsibilities-of-a-domain-service)
3. [Boundaries of a Domain Service](#3-boundaries-of-a-domain-service)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Domain Service Lifetime & Execution Flow](#5-domain-service-lifetime--execution-flow)
6. [Domain Service Structure Template](#6-domain-service-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Testing Strategy](#10-testing-strategy)
11. [Examples](#11-examples)

---

## 1. Purpose of Domain Services in DDD

**Domain Services encapsulate domain logic that doesn't naturally fit within a single Entity or Value Object.**

### Core Characteristics:

- **Stateless**: Domain Services hold no state (unlike Entities)
- **Operations**: Represent operations/actions in the domain
- **Multi-Object Logic**: Work with multiple domain objects
- **Pure Domain**: Contain only business logic, no infrastructure
- **Verbs, Not Nouns**: Named after domain operations

### When to Use Domain Services:

Use Domain Services when domain logic:

1. **Spans Multiple Aggregates**: Operation involves multiple aggregate roots
2. **Doesn't Belong to One Entity**: Logic doesn't conceptually belong to any single entity
3. **Performs Calculations**: Complex calculations using multiple entities/VOs
4. **Coordinates Domain Objects**: Orchestrates multiple domain objects
5. **Represents Domain Process**: Models a domain process or transformation

### Domain Service vs Entity Method:

```typescript
// ❌ BAD - Business logic in wrong place
class Account {
  public transferMoneyTo(
    toAccount: Account,
    amount: Money
  ): Result<void> {
    // This involves TWO aggregates - doesn't belong in one entity!
    this.withdraw(amount);
    toAccount.deposit(amount);
  }
}

// ✅ GOOD - Domain Service for multi-aggregate logic
class MoneyTransferService {
  public transfer(
    fromAccount: Account,
    toAccount: Account,
    amount: Money
  ): Result<void> {
    // Domain service coordinates multiple aggregates
    const withdrawResult = fromAccount.withdraw(amount);
    if (withdrawResult.isFailure) {
      return withdrawResult;
    }

    const depositResult = toAccount.deposit(amount);
    if (depositResult.isFailure) {
      // Rollback logic or compensation
      fromAccount.deposit(amount);
      return depositResult;
    }

    return Result.ok();
  }
}
```

### Domain Service vs Use Case:

| Aspect             | Domain Service            | Use Case                     |
| ------------------ | ------------------------- | ---------------------------- |
| **Layer**          | Domain Layer              | Application Layer            |
| **Purpose**        | Domain logic              | Orchestration                |
| **Dependencies**   | Domain objects only       | Repositories, services, etc. |
| **State**          | Stateless                 | Stateless                    |
| **Transactions**   | No transaction management | Manages transactions         |
| **Infrastructure** | None                      | Can use infrastructure       |

---

## 2. Responsibilities of a Domain Service

### MUST DO:

1. **Encapsulate Domain Logic**

   - Business rules that span multiple objects
   - Domain calculations and transformations
   - Domain validations across aggregates

2. **Work with Domain Objects**

   - Accepts Entities, Value Objects, Aggregates as parameters
   - Returns domain objects or Results
   - No DTOs or infrastructure types

3. **Be Stateless**

   - No instance variables (except injected dependencies)
   - Same inputs always produce same outputs
   - No side effects beyond domain logic

4. **Express Domain Concepts**

   - Named after domain operations/processes
   - Methods reflect ubiquitous language
   - Clear domain intent

5. **Return Results**
   - Use Result<T> for operations that can fail
   - Provide clear error messages
   - No throwing exceptions for business rule violations

---

## 3. Boundaries of a Domain Service

### MUST NOT DO:

1. **❌ Access Infrastructure**

   - No database access (use repositories via Use Cases)
   - No HTTP calls
   - No file system access
   - No external API calls

2. **❌ Manage Transactions**

   - Transaction management belongs in Use Cases
   - Domain Service just performs domain logic
   - Use Cases coordinate transaction scope

3. **❌ Know About DTOs**

   - Works with domain objects only
   - No knowledge of presentation layer
   - No knowledge of API contracts

4. **❌ Coordinate Application Workflows**

   - Application orchestration belongs in Use Cases
   - Domain Service focuses on domain logic only
   - No repository calls

5. **❌ Persist Data**

   - Domain Services don't save to database
   - Return modified domain objects
   - Use Case handles persistence

6. **❌ Contain Application Logic**
   - No authorization checks
   - No logging (except domain events)
   - No caching
   - No email sending
   - No notification dispatching

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                         │
│  - Never calls Domain Services directly                     │
│  - Calls Use Cases instead                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER                           │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Use Cases                                        │      │
│  │  - Load aggregates from repositories              │      │
│  │  - Call Domain Services with domain objects       │      │
│  │  - Save results via repositories                  │      │
│  │  - Manage transactions                            │      │
│  └───────────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ calls
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   DOMAIN LAYER                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │      DOMAIN SERVICES (You are here)                │     │
│  │  - Pure domain logic                               │     │
│  │  - Works with Entities, Aggregates, VOs            │     │
│  │  - Stateless operations                            │     │
│  │  - No infrastructure dependencies                  │     │
│  └────────────────────────────────────────────────────┘     │
│         │                           │                       │
│         │ uses                      │ uses                  │
│         ▼                           ▼                       │
│  ┌─────────────┐           ┌──────────────┐                 │
│  │  Aggregates │           │ Value Objects│                 │
│  │  & Entities │           │              │                 │
│  └─────────────┘           └──────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rules:

✅ **Domain Services CAN depend on:**

- Entities and Aggregates (as parameters)
- Value Objects (as parameters)
- Other Domain Services (injected)
- Domain Events
- Result<T> type

❌ **Domain Services CANNOT depend on:**

- Repositories (repositories are injected into Use Cases, not Domain Services)
- Use Cases
- Application Services
- Infrastructure
- Presentation/DTOs

### Note on Repositories in Domain Services:

**Generally AVOID** injecting repositories into Domain Services. Instead:

```typescript
// ❌ AVOID - Domain Service with repository
class OrderPricingService {
  constructor(private discountRepo: IDiscountRepository) {}

  async calculatePrice(order: Order): Promise<Money> {
    const discount = await this.discountRepo.findByCustomer(
      order.customerId
    );
    // ...
  }
}

// ✅ PREFER - Use Case loads data, Domain Service works with domain objects
class CalculateOrderPriceUseCase {
  async execute(orderId: OrderId): Promise<Result<Money>> {
    const order = await this.orderRepo.findById(orderId);
    const discount = await this.discountRepo.findByCustomer(
      order.customerId
    );

    // Domain Service works with loaded domain objects
    const price = this.pricingService.calculatePrice(order, discount);

    return Result.ok(price);
  }
}
```

**Exception**: If the domain service truly needs to query domain data and that's part of the domain logic itself, repositories can be injected. But this should be rare.

---

## 5. Domain Service Lifetime & Execution Flow

### Lifecycle:

Domain Services are typically **stateless singletons** or **transient instances**:

```typescript
// Registered as singleton in DI container
container.registerSingleton<IOrderPricingService>(
  'OrderPricingService',
  OrderPricingService
);

// Or registered as transient
container.registerTransient<IOrderPricingService>(
  'OrderPricingService',
  OrderPricingService
);
```

### Execution Flow:

```typescript
// 1. Use Case receives request
class ConfirmOrderUseCase {
  constructor(
    private orderRepo: IOrderRepository,
    private pricingService: OrderPricingService, // Domain Service injected
    private taxService: TaxCalculationService // Domain Service injected
  ) {}

  async execute(
    request: ConfirmOrderRequest
  ): Promise<Result<OrderDTO>> {
    // 2. Load domain objects
    const order = await this.orderRepo.findById(request.orderId);
    const customer = await this.customerRepo.findById(
      order.customerId
    );

    // 3. Call Domain Service with domain objects
    const price = this.pricingService.calculatePrice(order, customer);
    const tax = this.taxService.calculateTax(price, customer.address);

    // 4. Use results in domain operations
    order.setPrice(price);
    order.setTax(tax);

    const confirmResult = order.confirm();
    if (confirmResult.isFailure) {
      return Result.fail(confirmResult.error);
    }

    // 5. Persist
    await this.orderRepo.save(order);

    return Result.ok(OrderMapper.toDTO(order));
  }
}
```

---

## 6. Domain Service Structure Template

### Domain Service Interface:

```typescript
import { Result } from '@/shared/core/Result';

/**
 * Interface for [DomainService].
 * Defines contract for [domain operation].
 */
export interface IDomainServiceName {
  /**
   * [Operation description].
   *
   * @param param1 - Description
   * @param param2 - Description
   * @returns Result<T> - Success with result or failure with error
   */
  operationName(
    param1: DomainObject1,
    param2: DomainObject2
  ): Result<ReturnType>;
}
```

### Domain Service Implementation:

````typescript
import { Result } from '@/shared/core/Result';
import { IDomainServiceName } from './IDomainServiceName';

/**
 * [DomainService Name] - Brief description of domain operation.
 *
 * Purpose:
 * - [What domain logic this service encapsulates]
 * - [Why it's not in an entity/aggregate]
 *
 * Business Rules:
 * - [Rule 1]
 * - [Rule 2]
 *
 * Dependencies:
 * - [Other Domain Service 1]: For [purpose]
 * - [Other Domain Service 2]: For [purpose]
 *
 * @example
 * ```typescript
 * const result = domainService.operationName(entity1, entity2);
 * if (result.isSuccess) {
 *   const value = result.value;
 * }
 * ```
 */
export class DomainServiceName implements IDomainServiceName {
  /**
   * Constructor for injecting dependencies.
   * Only inject other Domain Services or Value Objects (for config).
   */
  constructor(
    private readonly otherDomainService?: OtherDomainService
  ) {}

  /**
   * [Operation name] - Brief description.
   *
   * Business Logic:
   * - [Step 1]
   * - [Step 2]
   *
   * @param param1 - Description
   * @param param2 - Description
   * @returns Result<T> - Success with result or failure with error message
   */
  public operationName(
    param1: DomainObject1,
    param2: DomainObject2
  ): Result<ReturnType> {
    // 1. Validate inputs
    if (!param1) {
      return Result.fail<ReturnType>('Param1 is required');
    }

    if (!param2) {
      return Result.fail<ReturnType>('Param2 is required');
    }

    // 2. Validate business rules
    const validationResult = this.validateBusinessRules(
      param1,
      param2
    );
    if (validationResult.isFailure) {
      return Result.fail<ReturnType>(validationResult.error);
    }

    // 3. Perform domain logic
    const result = this.performDomainOperation(param1, param2);

    // 4. Return result
    return Result.ok<ReturnType>(result);
  }

  /**
   * Validates business rules for the operation.
   */
  private validateBusinessRules(
    param1: DomainObject1,
    param2: DomainObject2
  ): Result<void> {
    // Implement business rule validation
    return Result.ok<void>();
  }

  /**
   * Performs the core domain operation.
   */
  private performDomainOperation(
    param1: DomainObject1,
    param2: DomainObject2
  ): ReturnType {
    // Implement domain logic
    return result;
  }
}
````

### Async Domain Service (rare):

```typescript
/**
 * Async domain service - use only if domain logic itself is asynchronous.
 * Most domain logic should be synchronous.
 */
export class AsyncDomainService implements IAsyncDomainService {
  /**
   * Async operation - only if truly needed for domain logic.
   */
  public async complexCalculation(
    entity: SomeEntity
  ): Promise<Result<CalculationResult>> {
    // Domain logic that requires async operations
    // (This is rare - most domain logic is sync)

    return Result.ok(result);
  }
}
```

---

## 7. Orthogonality Principles

### 1. Single Responsibility

Each Domain Service handles ONE domain concept/operation:

```typescript
// ✅ GOOD - Single responsibility
class OrderPricingService {
  public calculatePrice(order: Order, discount: Discount): Money {
    // Only pricing logic
  }
}

class TaxCalculationService {
  public calculateTax(amount: Money, address: Address): Money {
    // Only tax logic
  }
}

// ❌ BAD - Multiple responsibilities
class OrderService {
  public calculatePrice(order: Order): Money {}
  public calculateTax(order: Order): Money {}
  public validateOrder(order: Order): boolean {}
  public sendOrderConfirmation(order: Order): void {}
  // Too many unrelated concerns!
}
```

### 2. Stateless Design

Domain Services must be stateless:

```typescript
// ✅ GOOD - Stateless
class DistanceCalculationService {
  public calculateDistance(
    point1: GeoCoordinate,
    point2: GeoCoordinate
  ): number {
    // Pure calculation, no state
    const R = 6371; // Earth's radius in km
    // Haversine formula...
    return distance;
  }
}

// ❌ BAD - Stateful
class DistanceCalculationService {
  private lastCalculation: number; // State!

  public calculateDistance(
    point1: GeoCoordinate,
    point2: GeoCoordinate
  ): number {
    const distance = /* calculation */;
    this.lastCalculation = distance; // Mutating state!
    return distance;
  }
}
```

### 3. Domain Purity

Domain Services contain ONLY domain logic:

```typescript
// ✅ GOOD - Pure domain logic
class InventoryAllocationService {
  public allocateInventory(
    order: Order,
    warehouse: Warehouse
  ): Result<AllocationResult> {
    // Pure domain logic for inventory allocation
    return Result.ok(allocation);
  }
}

// ❌ BAD - Mixed with infrastructure
class InventoryAllocationService {
  public async allocateInventory(
    order: Order
  ): Promise<Result<AllocationResult>> {
    // Loading from database - WRONG! This is infrastructure
    const warehouse = await this.warehouseRepo.findClosest(
      order.shippingAddress
    );

    // Sending email - WRONG! This is application concern
    await this.emailService.send(
      order.customer.email,
      'Allocation complete'
    );

    return Result.ok(allocation);
  }
}
```

---

## 8. Naming Conventions

### Service Class Names:

- Use **domain verbs** or **domain processes**
- End with `Service` suffix
- Be specific about domain operation

```typescript
// ✅ GOOD - Clear domain operation
class OrderPricingService {}
class TaxCalculationService {}
class InventoryAllocationService {}
class ShippingCostCalculationService {}
class InterestCalculationService {}

// ❌ BAD - Vague or too generic
class OrderService {} // Too generic
class Calculator {} // Not domain-specific
class Helper {} // Meaningless
class Utils {} // Not a domain concept
```

### Method Names:

- Use **domain verbs**
- Be specific about what operation does
- Return types indicate success/failure

```typescript
class OrderPricingService {
  // ✅ GOOD - Clear domain operations
  public calculatePrice(order: Order, customer: Customer): Money;
  public applyDiscount(price: Money, discount: Discount): Money;
  public calculateShipping(order: Order, address: Address): Money;

  // ❌ BAD - Vague or infrastructure-focused
  public process(order: Order): Money; // Too vague
  public getPrice(orderId: string): Promise<Money>; // Implies database access
  public doCalculation(data: any): any; // Not domain-specific
}
```

### Interface Names:

```typescript
// ✅ GOOD - Interface with I prefix
interface IOrderPricingService {
  calculatePrice(order: Order, customer: Customer): Money;
}

// Implementation without I
class OrderPricingService implements IOrderPricingService {
  // ...
}
```

---

## 9. Error Handling Patterns

### Pattern 1: Result<T> for All Operations

All public methods should return Result<T>:

```typescript
class TaxCalculationService {
  /**
   * Calculates tax for a given amount and location.
   */
  public calculateTax(
    amount: Money,
    address: Address
  ): Result<Money> {
    // Validate inputs
    if (!amount || amount.isNegative()) {
      return Result.fail<Money>('Amount must be positive');
    }

    if (!address) {
      return Result.fail<Money>(
        'Address is required for tax calculation'
      );
    }

    // Determine tax rate
    const taxRate = this.getTaxRate(address);
    if (taxRate === null) {
      return Result.fail<Money>(
        `Unable to determine tax rate for ${address.state}`
      );
    }

    // Calculate tax
    const tax = amount.multiply(taxRate);

    return Result.ok<Money>(tax);
  }

  private getTaxRate(address: Address): number | null {
    // Tax rate lookup logic
    return 0.08; // Example
  }
}
```

### Pattern 2: Specific Error Messages

Provide clear, actionable error messages:

```typescript
// ✅ GOOD - Specific and actionable
public validateShipment(order: Order, warehouse: Warehouse): Result<void> {
  if (!warehouse.hasInventory(order.items)) {
    return Result.fail(
      `Warehouse ${warehouse.name} does not have sufficient inventory for order ${order.id}`
    );
  }

  if (warehouse.distance(order.shippingAddress) > 500) {
    return Result.fail(
      `Shipping distance (${warehouse.distance(order.shippingAddress)} km) exceeds maximum (500 km)`
    );
  }

  return Result.ok();
}

// ❌ BAD - Vague
public validateShipment(order: Order, warehouse: Warehouse): Result<void> {
  if (!warehouse.hasInventory(order.items)) {
    return Result.fail('Invalid shipment'); // Not helpful!
  }

  return Result.ok();
}
```

### Pattern 3: Validate Early

Validate inputs at the start of methods:

```typescript
public calculateShippingCost(
  order: Order,
  destination: Address,
  weight: Weight
): Result<Money> {
  // Validate all inputs first
  if (!order) {
    return Result.fail<Money>('Order is required');
  }

  if (!destination) {
    return Result.fail<Money>('Destination address is required');
  }

  if (!weight || weight.isZero()) {
    return Result.fail<Money>('Weight must be greater than zero');
  }

  // All inputs valid - proceed with domain logic
  const baseRate = this.getBaseRate(destination);
  const weightRate = this.calculateWeightRate(weight);
  const total = baseRate.add(weightRate);

  return Result.ok<Money>(total.value);
}
```

---

## 10. Testing Strategy

### Test Structure:

```typescript
import { OrderPricingService } from '@/domain/services/OrderPricingService';
import { Order } from '@/domain/aggregates/Order';
import { Customer } from '@/domain/aggregates/Customer';
import { Money } from '@/domain/value-objects/Money';
import { Discount } from '@/domain/value-objects/Discount';

describe('OrderPricingService', () => {
  let pricingService: OrderPricingService;

  beforeEach(() => {
    pricingService = new OrderPricingService();
  });

  describe('calculatePrice', () => {
    describe('when valid inputs', () => {
      it('should calculate base price correctly', () => {
        const order = createMockOrder(/* items totaling $100 */);
        const customer = createMockCustomer();

        const result = pricingService.calculatePrice(order, customer);

        expect(result.isSuccess).toBe(true);
        expect(result.value.amount).toBe(100);
      });

      it('should apply customer discount', () => {
        const order = createMockOrder(/* $100 */);
        const customer = createMockCustomer(/* 10% discount */);

        const result = pricingService.calculatePrice(order, customer);

        expect(result.isSuccess).toBe(true);
        expect(result.value.amount).toBe(90); // 10% off
      });

      it('should apply volume discount for large orders', () => {
        const order = createMockOrder(/* 100 items, $1000 */);
        const customer = createMockCustomer();

        const result = pricingService.calculatePrice(order, customer);

        expect(result.isSuccess).toBe(true);
        expect(result.value.amount).toBeLessThan(1000);
      });
    });

    describe('when invalid inputs', () => {
      it('should fail if order is null', () => {
        const result = pricingService.calculatePrice(
          null as any,
          createMockCustomer()
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Order is required');
      });

      it('should fail if customer is null', () => {
        const order = createMockOrder();
        const result = pricingService.calculatePrice(
          order,
          null as any
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Customer is required');
      });

      it('should fail for empty order', () => {
        const order = createMockOrder(/* no items */);
        const customer = createMockCustomer();

        const result = pricingService.calculatePrice(order, customer);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });
    });

    describe('business rules', () => {
      it('should cap maximum discount at 50%', () => {
        const order = createMockOrder(/* $100 */);
        const customer = createMockCustomer(/* 75% discount! */);

        const result = pricingService.calculatePrice(order, customer);

        expect(result.value.amount).toBeGreaterThanOrEqual(50); // Max 50% off
      });

      it('should not apply discounts to non-discountable items', () => {
        const order =
          createMockOrder(/* mix of discountable and non-discountable */);
        const customer = createMockCustomer(/* 20% discount */);

        const result = pricingService.calculatePrice(order, customer);

        // Verify non-discountable items are full price
        expect(result.value.amount).toBeGreaterThan(
          order.calculateTotal().multiply(0.8).amount
        );
      });
    });
  });

  describe('service composition', () => {
    it('should work with other domain services', () => {
      const taxService = new TaxCalculationService();

      const order = createMockOrder();
      const customer = createMockCustomer();

      const price = pricingService.calculatePrice(
        order,
        customer
      ).value;
      const tax = taxService.calculateTax(
        price,
        customer.address
      ).value;

      const total = price.add(tax);

      expect(total.isSuccess).toBe(true);
    });
  });
});
```

### Test Coverage Requirements:

1. **Valid Inputs**: All happy path scenarios
2. **Invalid Inputs**: Null/undefined/invalid parameters
3. **Business Rules**: All domain rules enforced
4. **Edge Cases**: Boundary conditions
5. **Service Composition**: Integration with other domain services

---

## 11. Examples

### Example 1: OrderPricingService

```typescript
import { Result } from '@/shared/core/Result';
import { Order } from '@/domain/aggregates/Order';
import { Customer } from '@/domain/aggregates/Customer';
import { Money } from '@/domain/value-objects/Money';
import { Discount } from '@/domain/value-objects/Discount';

/**
 * OrderPricingService - Calculates order prices with discounts.
 *
 * Purpose:
 * - Price calculation spans Order (items) and Customer (discounts)
 * - Logic doesn't belong in Order or Customer alone
 * - Complex pricing rules need dedicated service
 *
 * Business Rules:
 * - Volume discount: 5% off for orders > $1000
 * - Customer loyalty discount: Based on customer tier
 * - Maximum total discount: 50%
 * - Non-discountable items always full price
 */
export class OrderPricingService {
  /**
   * Calculates final price for an order including all discounts.
   */
  public calculatePrice(
    order: Order,
    customer: Customer
  ): Result<Money> {
    // Validate inputs
    if (!order) {
      return Result.fail<Money>('Order is required');
    }

    if (!customer) {
      return Result.fail<Money>('Customer is required');
    }

    if (order.items.length === 0) {
      return Result.fail<Money>('Cannot price empty order');
    }

    // Calculate base price
    const basePrice = order.calculateTotal();

    // Apply discounts
    const volumeDiscount = this.calculateVolumeDiscount(basePrice);
    const customerDiscount = this.calculateCustomerDiscount(customer);

    // Combine discounts (capped at 50%)
    const totalDiscount = this.combineDiscounts(
      volumeDiscount,
      customerDiscount
    );

    // Apply discount to discountable items only
    const discountAmount = this.applyDiscountToEligibleItems(
      order,
      totalDiscount
    );

    // Calculate final price
    const finalPrice = basePrice.subtract(discountAmount);

    if (finalPrice.isFailure) {
      return Result.fail<Money>('Error calculating final price');
    }

    return Result.ok<Money>(finalPrice.value);
  }

  /**
   * Calculates volume discount based on order total.
   * 5% off for orders over $1000.
   */
  private calculateVolumeDiscount(orderTotal: Money): Discount {
    if (orderTotal.amount >= 1000) {
      return Discount.create({ percentage: 5 }).value;
    }
    return Discount.zero();
  }

  /**
   * Determines customer discount based on loyalty tier.
   */
  private calculateCustomerDiscount(customer: Customer): Discount {
    switch (customer.loyaltyTier) {
      case LoyaltyTier.GOLD:
        return Discount.create({ percentage: 15 }).value;
      case LoyaltyTier.SILVER:
        return Discount.create({ percentage: 10 }).value;
      case LoyaltyTier.BRONZE:
        return Discount.create({ percentage: 5 }).value;
      default:
        return Discount.zero();
    }
  }

  /**
   * Combines multiple discounts with maximum cap of 50%.
   */
  private combineDiscounts(
    discount1: Discount,
    discount2: Discount
  ): Discount {
    const total = discount1.percentage + discount2.percentage;
    const capped = Math.min(total, 50); // Cap at 50%

    return Discount.create({ percentage: capped }).value;
  }

  /**
   * Applies discount only to eligible (discountable) items.
   */
  private applyDiscountToEligibleItems(
    order: Order,
    discount: Discount
  ): Money {
    const discountableTotal = order.items
      .filter((item) => item.isDiscountable)
      .reduce(
        (sum, item) => sum.add(item.calculateSubtotal()).value,
        Money.zero('USD').value
      );

    return discountableTotal.multiply(discount.percentage / 100);
  }
}
```

### Example 2: PollingSchedulerService

```typescript
import { Result } from '@/shared/core/Result';
import { NetworkDevice } from '@/domain/aggregates/NetworkDevice';
import { PollingInterval } from '@/domain/value-objects/PollingInterval';

/**
 * PollingSchedulerService - Calculates next polling time for devices.
 *
 * Purpose:
 * - Scheduling logic involves multiple factors (interval, priority, load)
 * - Doesn't belong in NetworkDevice (not about device state)
 * - Doesn't belong in PollingConfiguration (not about configuration)
 * - Represents domain process of "scheduling"
 *
 * Business Rules:
 * - High priority devices polled more frequently
 * - Failed devices get exponential backoff
 * - Maximum concurrent polls: 100
 * - Minimum interval: 10 seconds
 */
export class PollingSchedulerService {
  private static readonly MIN_INTERVAL_SECONDS = 10;
  private static readonly MAX_CONCURRENT_POLLS = 100;

  /**
   * Calculates next poll time for a device.
   */
  public calculateNextPollTime(
    device: NetworkDevice,
    currentTime: Date,
    activePollCount: number
  ): Result<Date> {
    // Validate inputs
    if (!device) {
      return Result.fail<Date>('Device is required');
    }

    if (!device.pollingConfiguration.enabled) {
      return Result.fail<Date>(
        'Polling is not enabled for this device'
      );
    }

    // Check system capacity
    if (
      activePollCount >= PollingSchedulerService.MAX_CONCURRENT_POLLS
    ) {
      // Defer to avoid overload
      return this.calculateDeferredPollTime(device, currentTime);
    }

    // Calculate base interval
    let intervalSeconds =
      device.pollingConfiguration.interval.seconds;

    // Adjust for priority
    intervalSeconds = this.adjustForPriority(
      intervalSeconds,
      device.priority
    );

    // Adjust for failure history (exponential backoff)
    if (device.hasRecentFailures()) {
      intervalSeconds = this.applyExponentialBackoff(
        intervalSeconds,
        device.consecutiveFailureCount
      );
    }

    // Enforce minimum
    intervalSeconds = Math.max(
      intervalSeconds,
      PollingSchedulerService.MIN_INTERVAL_SECONDS
    );

    // Calculate next time
    const nextPollTime = new Date(
      currentTime.getTime() + intervalSeconds * 1000
    );

    return Result.ok<Date>(nextPollTime);
  }

  /**
   * Adjusts interval based on device priority.
   * High priority = shorter interval.
   */
  private adjustForPriority(
    baseInterval: number,
    priority: DevicePriority
  ): number {
    switch (priority) {
      case DevicePriority.CRITICAL:
        return baseInterval * 0.5; // Poll twice as often
      case DevicePriority.HIGH:
        return baseInterval * 0.75;
      case DevicePriority.NORMAL:
        return baseInterval;
      case DevicePriority.LOW:
        return baseInterval * 1.5;
      default:
        return baseInterval;
    }
  }

  /**
   * Applies exponential backoff for failing devices.
   */
  private applyExponentialBackoff(
    baseInterval: number,
    failureCount: number
  ): number {
    const backoffMultiplier = Math.pow(2, Math.min(failureCount, 5));
    return baseInterval * backoffMultiplier;
  }

  /**
   * Calculates deferred poll time when system is at capacity.
   */
  private calculateDeferredPollTime(
    device: NetworkDevice,
    currentTime: Date
  ): Result<Date> {
    // Defer by 1 minute
    const deferredTime = new Date(currentTime.getTime() + 60000);
    return Result.ok<Date>(deferredTime);
  }
}
```

### Example 3: TransferMoneyService (Saga Coordinator)

```typescript
import { Result } from '@/shared/core/Result';
import { Account } from '@/domain/aggregates/Account';
import { Money } from '@/domain/value-objects/Money';
import { TransactionId } from '@/domain/value-objects/TransactionId';

/**
 * TransferMoneyService - Coordinates money transfers between accounts.
 *
 * Purpose:
 * - Transfer involves TWO aggregates (Account A and Account B)
 * - Logic doesn't belong in either account
 * - Represents domain process of "money transfer"
 * - Handles compensation if transfer fails partway
 *
 * Business Rules:
 * - Both accounts must have same currency
 * - Source account must have sufficient funds
 * - Transfer must be atomic (both succeed or both fail)
 * - Transaction IDs must be unique
 */
export class TransferMoneyService {
  /**
   * Transfers money from one account to another.
   * Returns transaction ID if successful.
   */
  public transfer(
    fromAccount: Account,
    toAccount: Account,
    amount: Money,
    transactionId: TransactionId
  ): Result<TransactionId> {
    // Validate inputs
    if (!fromAccount || !toAccount) {
      return Result.fail<TransactionId>('Both accounts are required');
    }

    if (!amount || amount.isZero()) {
      return Result.fail<TransactionId>(
        'Amount must be greater than zero'
      );
    }

    // Validate business rules
    if (!fromAccount.currency.equals(toAccount.currency)) {
      return Result.fail<TransactionId>(
        'Cannot transfer between different currencies'
      );
    }

    if (!fromAccount.currency.equals(amount.currency)) {
      return Result.fail<TransactionId>(
        'Transfer amount currency must match account currency'
      );
    }

    // Attempt withdrawal
    const withdrawResult = fromAccount.withdraw(amount);
    if (withdrawResult.isFailure) {
      return Result.fail<TransactionId>(
        `Withdrawal failed: ${withdrawResult.error}`
      );
    }

    // Attempt deposit
    const depositResult = toAccount.deposit(amount);
    if (depositResult.isFailure) {
      // Compensate - return money to source account
      fromAccount.deposit(amount);

      return Result.fail<TransactionId>(
        `Deposit failed: ${depositResult.error}. Transfer reversed.`
      );
    }

    // Success - record transaction on both accounts
    fromAccount.recordTransfer(
      transactionId,
      toAccount.id,
      amount,
      'DEBIT'
    );
    toAccount.recordTransfer(
      transactionId,
      fromAccount.id,
      amount,
      'CREDIT'
    );

    return Result.ok<TransactionId>(transactionId);
  }
}
```

---

## Summary Checklist

When creating a Domain Service, ensure:

- ✅ Represents domain logic that doesn't fit in entity/VO
- ✅ Works with multiple domain objects
- ✅ Is stateless (no instance variables except dependencies)
- ✅ Contains only domain logic (no infrastructure)
- ✅ Named after domain operation/process
- ✅ Returns Result<T> for fallible operations
- ✅ Accepts domain objects as parameters (not DTOs)
- ✅ Has interface for dependency injection
- ✅ No repository calls (repositories injected into Use Cases)
- ✅ No transaction management (handled by Use Cases)
- ✅ No DTOs or presentation concerns
- ✅ Comprehensive unit tests
- ✅ Clear, specific error messages

---

**Remember**: Domain Services are for domain logic that spans multiple objects. Keep them stateless, pure, and focused on domain operations!
