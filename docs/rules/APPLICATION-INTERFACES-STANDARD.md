# APPLICATION INTERFACES STANDARD

## Table of Contents
1. [Purpose of Application Interfaces](#1-purpose-of-application-interfaces)
2. [Responsibilities of Application Interfaces](#2-responsibilities-of-application-interfaces)
3. [Boundaries of Application Interfaces](#3-boundaries-of-application-interfaces)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Types of Application Interfaces](#5-types-of-application-interfaces)
6. [Interface Structure Templates](#6-interface-structure-templates)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Testing Strategy](#9-testing-strategy)
10. [Examples](#10-examples)

---

## 1. Purpose of Application Interfaces

**Application Interfaces define contracts for application services, allowing for dependency inversion, testability, and flexibility.**

### Core Characteristics:

- **Contracts**: Define what services do, not how they do it
- **Abstraction**: Hide implementation details
- **Testability**: Easy to mock for testing
- **Flexibility**: Swap implementations without changing consumers
- **Dependency Inversion**: High-level modules don't depend on low-level modules

### Why Application Interfaces?

1. **Dependency Inversion**: Use Cases depend on abstractions, not concretions
2. **Testability**: Mock interfaces for unit testing
3. **Flexibility**: Multiple implementations (real, mock, fake)
4. **Clear Contracts**: Explicit service boundaries
5. **Decoupling**: Reduce coupling between components

### Application Interfaces vs Domain Repository Interfaces:

| Aspect | Application Interface | Repository Interface |
|--------|----------------------|---------------------|
| **Layer** | Application Layer | Domain Layer |
| **Purpose** | Application services | Data persistence |
| **Examples** | IEmailService, IPaymentGateway | IOrderRepository |
| **Used By** | Use Cases | Use Cases |
| **Implemented In** | Infrastructure | Infrastructure |

---

## 2. Responsibilities of Application Interfaces

### MUST DO:

1. **Define Service Contract**
   - Clear method signatures
   - Input/output types specified
   - Error handling approach defined

2. **Use Appropriate Types**
   - DTOs for input/output
   - Domain types where appropriate
   - Result<T> for operations that can fail

3. **Express Business Intent**
   - Method names reflect business operations
   - Clear purpose and use case
   - Domain language when applicable

4. **Be Technology-Agnostic**
   - No technology-specific details
   - Abstract implementation concerns
   - Focus on "what", not "how"

---

## 3. Boundaries of Application Interfaces

### MUST NOT DO:

1. **❌ Contain Implementation**
   - Interfaces are contracts only
   - No method bodies
   - No business logic

2. **❌ Expose Infrastructure Details**
   - No HTTP status codes
   - No database connection details
   - No framework-specific types

3. **❌ Have Too Many Methods**
   - Keep interfaces focused (ISP - Interface Segregation Principle)
   - Split large interfaces into smaller ones
   - One responsibility per interface

4. **❌ Depend on Concrete Types**
   - Use DTOs or domain types
   - No implementation classes as parameters
   - Abstract dependencies

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                 PRESENTATION LAYER                           │
│  - Calls use cases through controllers                       │
│  - Never calls application services directly                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                APPLICATION LAYER                             │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Use Cases                                         │      │
│  │  - Depend on application interfaces                │      │
│  │  - Inject services through constructor             │      │
│  │  - Orchestrate business workflows                  │      │
│  └───────────────────────────────────────────────────┘      │
│         │                                                     │
│         │ depends on (interfaces)                            │
│         ▼                                                     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  APPLICATION INTERFACES (You are here)             │     │
│  │  - IEmailService                                    │     │
│  │  - IPaymentGateway                                  │     │
│  │  - INotificationService                             │     │
│  │  - IFileStorageService                              │     │
│  │  - IAuthenticationService                           │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │ implements
┌─────────────────────────────────────────────────────────────┐
│              INFRASTRUCTURE LAYER                            │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Service Implementations                           │      │
│  │  - SendGridEmailService implements IEmailService   │      │
│  │  - StripePaymentGateway implements IPaymentGateway │      │
│  │  - TwilioNotificationService implements INotif...  │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Types of Application Interfaces

### 1. Communication Services

Services for external communication:

```typescript
// Email
interface IEmailService {
  send(email: EmailMessage): Promise<Result<void>>;
  sendBulk(emails: EmailMessage[]): Promise<Result<void>>;
}

// SMS
interface ISMSService {
  sendSMS(phoneNumber: string, message: string): Promise<Result<void>>;
}

// Notifications
interface INotificationService {
  notify(userId: string, notification: Notification): Promise<Result<void>>;
}
```

### 2. Payment Services

Services for payment processing:

```typescript
interface IPaymentGateway {
  processPayment(payment: PaymentRequest): Promise<Result<PaymentResult>>;
  refund(transactionId: string, amount: number): Promise<Result<void>>;
  getPaymentStatus(transactionId: string): Promise<Result<PaymentStatus>>;
}
```

### 3. File Storage Services

Services for file operations:

```typescript
interface IFileStorageService {
  upload(file: File, path: string): Promise<Result<string>>;
  download(path: string): Promise<Result<File>>;
  delete(path: string): Promise<Result<void>>;
  exists(path: string): Promise<Result<boolean>>;
}
```

### 4. Authentication/Authorization Services

Services for security:

```typescript
interface IAuthenticationService {
  authenticate(credentials: Credentials): Promise<Result<AuthToken>>;
  validateToken(token: string): Promise<Result<TokenPayload>>;
  refreshToken(token: string): Promise<Result<AuthToken>>;
}

interface IAuthorizationService {
  hasPermission(userId: string, permission: string): Promise<Result<boolean>>;
  getRoles(userId: string): Promise<Result<string[]>>;
}
```

### 5. External API Services

Services for third-party APIs:

```typescript
interface IWeatherService {
  getCurrentWeather(location: string): Promise<Result<WeatherData>>;
}

interface IGeolocationService {
  geocode(address: string): Promise<Result<Coordinates>>;
  reverseGeocode(coordinates: Coordinates): Promise<Result<Address>>;
}
```

### 6. Time/Date Services

Services for date/time operations:

```typescript
interface IDateTimeService {
  now(): Date;
  addDays(date: Date, days: number): Date;
  differenceInDays(date1: Date, date2: Date): number;
}
```

### 7. Logging Services

Services for logging:

```typescript
interface ILogger {
  info(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  error(message: string, error: Error, context?: object): void;
  debug(message: string, context?: object): void;
}
```

---

## 6. Interface Structure Templates

### Basic Service Interface:

```typescript
import { Result } from '@/shared/core/Result';

/**
 * Interface for [Service Name].
 *
 * Responsibilities:
 * - [Responsibility 1]
 * - [Responsibility 2]
 *
 * Implementations:
 * - [Implementation 1]: [Description]
 * - [Implementation 2]: [Description]
 *
 * Used By:
 * - [Use Case 1]
 * - [Use Case 2]
 */
export interface IServiceName {
  /**
   * [Operation description].
   *
   * @param param1 - Description
   * @param param2 - Description
   * @returns Promise<Result<T>> - Success with result or failure with error
   *
   * @example
   * ```typescript
   * const result = await service.operationName(param1, param2);
   * if (result.isSuccess) {
   *   const value = result.value;
   * }
   * ```
   */
  operationName(
    param1: Type1,
    param2: Type2
  ): Promise<Result<ReturnType>>;
}
```

### Email Service Interface:

```typescript
import { Result } from '@/shared/core/Result';

/**
 * Email message DTO.
 */
export interface EmailMessage {
  to: string | string[];
  subject: string;
  body: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

/**
 * Interface for email service.
 *
 * Responsibilities:
 * - Send transactional emails
 * - Send bulk emails
 * - Handle email delivery failures
 *
 * Implementations:
 * - SendGridEmailService: Production implementation using SendGrid
 * - MockEmailService: Testing implementation
 *
 * Used By:
 * - Order confirmation emails
 * - Password reset emails
 * - Notification emails
 */
export interface IEmailService {
  /**
   * Sends a single email.
   *
   * @param email - Email message to send
   * @returns Promise<Result<void>> - Success or failure with error
   */
  send(email: EmailMessage): Promise<Result<void>>;

  /**
   * Sends multiple emails in bulk.
   * More efficient than multiple send() calls.
   *
   * @param emails - Array of email messages
   * @returns Promise<Result<void>> - Success or failure with error
   */
  sendBulk(emails: EmailMessage[]): Promise<Result<void>>;

  /**
   * Verifies email address is valid and deliverable.
   *
   * @param emailAddress - Email address to verify
   * @returns Promise<Result<boolean>> - True if valid
   */
  verify(emailAddress: string): Promise<Result<boolean>>;
}
```

### Payment Gateway Interface:

```typescript
import { Result } from '@/shared/core/Result';
import { Money } from '@/domain/value-objects/Money';

/**
 * Payment request DTO.
 */
export interface PaymentRequest {
  amount: Money;
  currency: string;
  paymentMethodId: string;
  customerId: string;
  description?: string;
  metadata?: Record<string, string>;
}

/**
 * Payment result DTO.
 */
export interface PaymentResult {
  transactionId: string;
  status: PaymentStatus;
  amount: Money;
  processedAt: Date;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

/**
 * Interface for payment gateway.
 *
 * Responsibilities:
 * - Process payments
 * - Handle refunds
 * - Query payment status
 *
 * Implementations:
 * - StripePaymentGateway: Stripe integration
 * - PayPalPaymentGateway: PayPal integration
 * - MockPaymentGateway: Testing implementation
 *
 * Used By:
 * - ProcessPaymentUseCase
 * - RefundPaymentUseCase
 */
export interface IPaymentGateway {
  /**
   * Processes a payment.
   *
   * @param payment - Payment request
   * @returns Promise<Result<PaymentResult>> - Payment result or error
   */
  processPayment(payment: PaymentRequest): Promise<Result<PaymentResult>>;

  /**
   * Refunds a payment.
   *
   * @param transactionId - Original transaction ID
   * @param amount - Amount to refund (must not exceed original)
   * @returns Promise<Result<void>> - Success or error
   */
  refund(transactionId: string, amount: Money): Promise<Result<void>>;

  /**
   * Gets current status of a payment.
   *
   * @param transactionId - Transaction ID
   * @returns Promise<Result<PaymentStatus>> - Status or error
   */
  getPaymentStatus(
    transactionId: string
  ): Promise<Result<PaymentStatus>>;

  /**
   * Creates a customer in the payment gateway.
   *
   * @param customerId - Internal customer ID
   * @param email - Customer email
   * @returns Promise<Result<string>> - Gateway customer ID or error
   */
  createCustomer(
    customerId: string,
    email: string
  ): Promise<Result<string>>;
}
```

### File Storage Interface:

```typescript
import { Result } from '@/shared/core/Result';

/**
 * File metadata DTO.
 */
export interface FileMetadata {
  path: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  url?: string;
}

/**
 * Interface for file storage service.
 *
 * Responsibilities:
 * - Upload files to storage
 * - Download files from storage
 * - Delete files from storage
 * - Manage file metadata
 *
 * Implementations:
 * - S3FileStorageService: AWS S3 storage
 * - LocalFileStorageService: Local filesystem
 * - MockFileStorageService: Testing implementation
 *
 * Used By:
 * - UploadDocumentUseCase
 * - DownloadReportUseCase
 */
export interface IFileStorageService {
  /**
   * Uploads a file to storage.
   *
   * @param file - File buffer
   * @param path - Storage path (key)
   * @param contentType - MIME type
   * @returns Promise<Result<string>> - File URL or error
   */
  upload(
    file: Buffer,
    path: string,
    contentType: string
  ): Promise<Result<string>>;

  /**
   * Downloads a file from storage.
   *
   * @param path - Storage path (key)
   * @returns Promise<Result<Buffer>> - File content or error
   */
  download(path: string): Promise<Result<Buffer>>;

  /**
   * Deletes a file from storage.
   *
   * @param path - Storage path (key)
   * @returns Promise<Result<void>> - Success or error
   */
  delete(path: string): Promise<Result<void>>;

  /**
   * Checks if a file exists.
   *
   * @param path - Storage path (key)
   * @returns Promise<Result<boolean>> - True if exists
   */
  exists(path: string): Promise<Result<boolean>>;

  /**
   * Gets file metadata.
   *
   * @param path - Storage path (key)
   * @returns Promise<Result<FileMetadata>> - Metadata or error
   */
  getMetadata(path: string): Promise<Result<FileMetadata>>;

  /**
   * Generates a signed URL for temporary access.
   *
   * @param path - Storage path (key)
   * @param expiresIn - Expiration in seconds
   * @returns Promise<Result<string>> - Signed URL or error
   */
  getSignedUrl(path: string, expiresIn: number): Promise<Result<string>>;
}
```

---

## 7. Orthogonality Principles

### 1. Interface Segregation

Keep interfaces focused - don't create god interfaces:

```typescript
// ✅ GOOD - Segregated interfaces
interface IEmailSender {
  send(email: EmailMessage): Promise<Result<void>>;
}

interface IEmailValidator {
  verify(email: string): Promise<Result<boolean>>;
}

interface IEmailTemplateEngine {
  renderTemplate(templateId: string, data: object): string;
}

// ❌ BAD - God interface
interface IEmailService {
  send(email: EmailMessage): Promise<Result<void>>;
  verify(email: string): Promise<Result<boolean>>;
  renderTemplate(templateId: string, data: object): string;
  getEmailMetrics(): Promise<Result<EmailMetrics>>;
  manageSubscriptions(userId: string, list: string): Promise<Result<void>>;
  // Too many responsibilities!
}
```

### 2. Single Responsibility

Each interface should have one clear purpose:

```typescript
// ✅ GOOD - Single responsibility
interface IPaymentProcessor {
  processPayment(payment: PaymentRequest): Promise<Result<PaymentResult>>;
  refund(transactionId: string, amount: Money): Promise<Result<void>>;
}

interface IPaymentReporter {
  getTransactionHistory(customerId: string): Promise<Result<Transaction[]>>;
  generateReport(dateRange: DateRange): Promise<Result<Report>>;
}

// ❌ BAD - Mixed responsibilities
interface IPaymentService {
  processPayment(payment: PaymentRequest): Promise<Result<PaymentResult>>;
  generateInvoice(orderId: string): Promise<Result<Invoice>>;  // Different concern
  sendReceiptEmail(email: string): Promise<Result<void>>;      // Different concern
}
```

### 3. Technology Independence

Interfaces should be technology-agnostic:

```typescript
// ✅ GOOD - Technology-agnostic
interface INotificationService {
  notify(userId: string, message: Notification): Promise<Result<void>>;
}

// ❌ BAD - Technology-specific
interface ISNSNotificationService {  // AWS SNS in name!
  publishToTopic(topicArn: string, message: string): Promise<void>;  // AWS-specific
}
```

---

## 8. Naming Conventions

### Interface Names:

- Prefix with `I`
- Use descriptive service names
- Avoid technology names

```typescript
// ✅ GOOD
interface IEmailService { }
interface IPaymentGateway { }
interface IFileStorageService { }
interface ILogger { }

// ❌ BAD
interface EmailService { }             // Missing I prefix
interface SendGridService { }          // Technology name
interface IService { }                 // Too generic
interface IEmailSenderAndValidator { } // Too long, multiple concerns
```

### Method Names:

- Use verbs for actions
- Be specific about what the method does
- Use domain language

```typescript
interface IEmailService {
  // ✅ GOOD - Clear, specific verbs
  send(email: EmailMessage): Promise<Result<void>>;
  verify(emailAddress: string): Promise<Result<boolean>>;

  // ❌ BAD - Vague or technical
  doEmail(data: any): Promise<void>;           // Vague
  executeEmailOperation(params: object): Promise<any>;  // Vague
}
```

### Parameter Names:

```typescript
// ✅ GOOD - Descriptive parameters
interface IPaymentGateway {
  processPayment(
    payment: PaymentRequest
  ): Promise<Result<PaymentResult>>;

  refund(
    transactionId: string,
    amount: Money
  ): Promise<Result<void>>;
}

// ❌ BAD - Unclear parameters
interface IPaymentGateway {
  process(data: any): Promise<any>;     // Unclear
  refund(id: string, amt: number): Promise<void>;  // Abbreviated
}
```

---

## 9. Testing Strategy

### Mocking Application Services:

```typescript
// Mock implementation for testing
export class MockEmailService implements IEmailService {
  public sentEmails: EmailMessage[] = [];
  public sendCalled = false;
  public shouldFail = false;

  async send(email: EmailMessage): Promise<Result<void>> {
    this.sendCalled = true;

    if (this.shouldFail) {
      return Result.fail('Email service unavailable');
    }

    this.sentEmails.push(email);
    return Result.ok();
  }

  async sendBulk(emails: EmailMessage[]): Promise<Result<void>> {
    if (this.shouldFail) {
      return Result.fail('Email service unavailable');
    }

    this.sentEmails.push(...emails);
    return Result.ok();
  }

  async verify(emailAddress: string): Promise<Result<boolean>> {
    const isValid = emailAddress.includes('@');
    return Result.ok(isValid);
  }

  // Test helper
  reset(): void {
    this.sentEmails = [];
    this.sendCalled = false;
    this.shouldFail = false;
  }
}

// Using mock in use case test
describe('ConfirmOrderUseCase', () => {
  let useCase: ConfirmOrderUseCase;
  let mockEmailService: MockEmailService;
  let mockOrderRepo: MockOrderRepository;

  beforeEach(() => {
    mockEmailService = new MockEmailService();
    mockOrderRepo = new MockOrderRepository();
    useCase = new ConfirmOrderUseCase(mockOrderRepo, mockEmailService);
  });

  it('should send confirmation email when order confirmed', async () => {
    const order = Order.create({ ... }).value;
    await mockOrderRepo.save(order);

    await useCase.execute({ orderId: order.id });

    expect(mockEmailService.sendCalled).toBe(true);
    expect(mockEmailService.sentEmails).toHaveLength(1);
    expect(mockEmailService.sentEmails[0].subject).toContain('confirmed');
  });

  it('should handle email service failure gracefully', async () => {
    mockEmailService.shouldFail = true;

    const order = Order.create({ ... }).value;
    await mockOrderRepo.save(order);

    const result = await useCase.execute({ orderId: order.id });

    // Order should still be confirmed even if email fails
    expect(result.isSuccess).toBe(true);
    // But error should be logged
  });
});
```

### Testing Service Implementations:

```typescript
describe('SendGridEmailService (Integration)', () => {
  let service: IEmailService;

  beforeAll(() => {
    service = new SendGridEmailService(process.env.SENDGRID_API_KEY!);
  });

  it('should send email successfully', async () => {
    const email: EmailMessage = {
      to: 'test@example.com',
      subject: 'Test Email',
      body: 'This is a test email'
    };

    const result = await service.send(email);

    expect(result.isSuccess).toBe(true);
  });

  it('should fail with invalid recipient', async () => {
    const email: EmailMessage = {
      to: 'invalid-email',
      subject: 'Test',
      body: 'Test'
    };

    const result = await service.send(email);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('invalid');
  });
});
```

---

## 10. Examples

### Example 1: INotificationService

```typescript
import { Result } from '@/shared/core/Result';

/**
 * Notification DTO.
 */
export interface Notification {
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, any>;
}

export enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

/**
 * Interface for notification service.
 *
 * Responsibilities:
 * - Send push notifications to users
 * - Send in-app notifications
 * - Track notification delivery
 *
 * Implementations:
 * - FirebaseNotificationService: Firebase Cloud Messaging
 * - InAppNotificationService: Database-backed in-app notifications
 * - MockNotificationService: Testing implementation
 *
 * Used By:
 * - Device alert use cases
 * - Order status update use cases
 * - System alert use cases
 */
export interface INotificationService {
  /**
   * Sends a notification to a specific user.
   *
   * @param userId - User ID to notify
   * @param notification - Notification to send
   * @returns Promise<Result<void>> - Success or error
   */
  notify(userId: string, notification: Notification): Promise<Result<void>>;

  /**
   * Sends a notification to multiple users.
   *
   * @param userIds - User IDs to notify
   * @param notification - Notification to send
   * @returns Promise<Result<void>> - Success or error
   */
  notifyMultiple(
    userIds: string[],
    notification: Notification
  ): Promise<Result<void>>;

  /**
   * Sends a notification to all users in a role.
   *
   * @param role - User role
   * @param notification - Notification to send
   * @returns Promise<Result<void>> - Success or error
   */
  notifyByRole(
    role: string,
    notification: Notification
  ): Promise<Result<void>>;
}
```

### Example 2: IDevicePollingService

```typescript
import { Result } from '@/shared/core/Result';
import { NetworkDeviceId } from '@/domain/aggregates/NetworkDevice';
import { IPAddress } from '@/domain/value-objects/IPAddress';

/**
 * Polling result DTO.
 */
export interface PollingResultDTO {
  success: boolean;
  responseTimes: number[];
  packetLoss: number;
  averageResponseTime: number;
  errorMessage?: string;
}

/**
 * Interface for device polling service.
 *
 * Responsibilities:
 * - Poll network devices via ICMP/SNMP
 * - Collect device metrics
 * - Report polling results
 *
 * Implementations:
 * - IcmpDevicePollingService: ICMP (ping) based polling
 * - SnmpDevicePollingService: SNMP based monitoring
 * - MockDevicePollingService: Testing implementation
 *
 * Used By:
 * - ExecuteDevicePollingUseCase
 * - ScheduledPollingService
 */
export interface IDevicePollingService {
  /**
   * Polls a device using ICMP ping.
   *
   * @param ipAddress - Device IP address
   * @param count - Number of pings to send
   * @returns Promise<Result<PollingResultDTO>> - Polling result or error
   */
  pollDevice(
    ipAddress: IPAddress,
    count: number
  ): Promise<Result<PollingResultDTO>>;

  /**
   * Performs a quick health check (single ping).
   *
   * @param ipAddress - Device IP address
   * @returns Promise<Result<boolean>> - True if device is reachable
   */
  quickCheck(ipAddress: IPAddress): Promise<Result<boolean>>;

  /**
   * Polls multiple devices concurrently.
   *
   * @param ipAddresses - Array of IP addresses
   * @param count - Number of pings per device
   * @returns Promise<Result<Map<string, PollingResultDTO>>> - Results by IP
   */
  pollMultiple(
    ipAddresses: IPAddress[],
    count: number
  ): Promise<Result<Map<string, PollingResultDTO>>>;
}
```

---

## Summary Checklist

When creating an Application Interface, ensure:

- ✅ Interface name: I + ServiceName
- ✅ Located in application layer (src/application/interfaces/)
- ✅ Clear, focused responsibility
- ✅ Technology-agnostic methods
- ✅ Returns Result<T> for fallible operations
- ✅ Uses DTOs for input/output (not domain entities directly when crossing boundaries)
- ✅ Well-documented with JSDoc
- ✅ Method names are clear and descriptive
- ✅ No implementation details in interface
- ✅ Easy to mock for testing
- ✅ Follows Interface Segregation Principle
- ✅ Used by use cases through dependency injection

---

**Remember**: Application Interfaces define contracts for application services. They enable dependency inversion, testability, and flexibility by abstracting implementation details!
