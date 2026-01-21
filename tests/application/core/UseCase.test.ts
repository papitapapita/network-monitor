import { UseCase } from '../../../src/application/core/UseCase';
import { Result } from '../../../src/domain';
import { ILogger, LogContext } from '../../../src/application';

// ========================================
// Mock Logger Implementation
// ========================================

class MockLogger implements ILogger {
  public debugCalls: Array<{
    message: string;
    context?: LogContext;
  }> = [];
  public infoCalls: Array<{ message: string; context?: LogContext }> =
    [];
  public warnCalls: Array<{ message: string; context?: LogContext }> =
    [];
  public errorCalls: Array<{
    message: string;
    error?: Error;
    context?: LogContext;
  }> = [];
  public fatalCalls: Array<{
    message: string;
    error?: Error;
    context?: LogContext;
  }> = [];
  public childCalls: Array<LogContext> = [];

  debug(message: string, context?: LogContext): void {
    this.debugCalls.push({ message, context });
  }

  info(message: string, context?: LogContext): void {
    this.infoCalls.push({ message, context });
  }

  warn(message: string, context?: LogContext): void {
    this.warnCalls.push({ message, context });
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.errorCalls.push({ message, error, context });
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.fatalCalls.push({ message, error, context });
  }

  child(context: LogContext): ILogger {
    this.childCalls.push(context);
    return this; // Return same instance for simplicity in tests
  }

  setLevel(): void {
    // No-op for mock
  }

  reset(): void {
    this.debugCalls = [];
    this.infoCalls = [];
    this.warnCalls = [];
    this.errorCalls = [];
    this.fatalCalls = [];
    this.childCalls = [];
  }
}

// ========================================
// Test Request/Response Types
// ========================================

interface TestRequest {
  name: string;
  value: number;
  password?: string; // For testing sanitization
}

interface TestResponse {
  result: string;
  timestamp: Date;
}

// ========================================
// Concrete Test Use Case Implementations
// ========================================

/**
 * Simple successful use case for basic tests
 */
class SuccessfulUseCase extends UseCase<TestRequest, TestResponse> {
  protected async executeImpl(
    request: TestRequest
  ): Promise<Result<TestResponse>> {
    return this.ok({
      result: `Processed ${request.name}`,
      timestamp: new Date('2026-01-10T12:00:00Z')
    });
  }
}

/**
 * Use case that fails in executeImpl
 */
class FailingUseCase extends UseCase<TestRequest, TestResponse> {
  protected async executeImpl(): Promise<Result<TestResponse>> {
    return this.fail('Business rule violation');
  }
}

/**
 * Use case that throws an unexpected error
 */
class ThrowingUseCase extends UseCase<TestRequest, TestResponse> {
  protected async executeImpl(): Promise<Result<TestResponse>> {
    throw new Error('Unexpected database error');
  }
}

/**
 * Use case that throws a non-Error object
 */
class ThrowingNonErrorUseCase extends UseCase<
  TestRequest,
  TestResponse
> {
  protected async executeImpl(): Promise<Result<TestResponse>> {
    throw 'String error'; // eslint-disable-line @typescript-eslint/no-throw-literal
  }
}

/**
 * Use case with beforeExecute hook
 */
class UseCaseWithBeforeHook extends UseCase<
  TestRequest,
  TestResponse
> {
  public beforeExecuteCalled = false;
  public shouldFailBeforeExecute = false;

  protected async beforeExecute(): Promise<Result<void> | null> {
    this.beforeExecuteCalled = true;

    if (this.shouldFailBeforeExecute) {
      return Result.fail('Pre-execution validation failed');
    }

    return null;
  }

  protected async executeImpl(
    request: TestRequest
  ): Promise<Result<TestResponse>> {
    return this.ok({
      result: `Processed ${request.name}`,
      timestamp: new Date('2026-01-10T12:00:00Z')
    });
  }
}

/**
 * Use case with afterExecute hook
 */
class UseCaseWithAfterHook extends UseCase<
  TestRequest,
  TestResponse
> {
  public afterExecuteCalled = false;
  public receivedResponse: TestResponse | null = null;
  public shouldFailAfterExecute = false;

  protected async afterExecute(
    _request: TestRequest,
    response: TestResponse
  ): Promise<Result<void> | null> {
    this.afterExecuteCalled = true;
    this.receivedResponse = response;

    if (this.shouldFailAfterExecute) {
      return Result.fail('Post-execution processing failed');
    }

    return null;
  }

  protected async executeImpl(
    request: TestRequest
  ): Promise<Result<TestResponse>> {
    return this.ok({
      result: `Processed ${request.name}`,
      timestamp: new Date('2026-01-10T12:00:00Z')
    });
  }
}

/**
 * Use case with custom sanitization
 */
class UseCaseWithSanitization extends UseCase<
  TestRequest,
  TestResponse
> {
  protected sanitizeForLogging(data: unknown): unknown {
    if (
      data &&
      typeof data === 'object' &&
      'password' in data &&
      data.password
    ) {
      return {
        ...data,
        password: '***REDACTED***'
      };
    }
    return data;
  }

  protected async executeImpl(): Promise<Result<TestResponse>> {
    return this.ok({
      result: 'Success',
      timestamp: new Date('2026-01-10T12:00:00Z')
    });
  }
}

// ========================================
// Test Suites
// ========================================

describe('UseCase', () => {
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
  });

  // ========================================
  // Constructor Tests
  // ========================================

  describe('constructor', () => {
    it('should create instance with logger and use case name', () => {
      const useCase = new SuccessfulUseCase(
        mockLogger,
        'TestUseCase'
      );

      expect(useCase).toBeInstanceOf(UseCase);
      expect(useCase).toBeInstanceOf(SuccessfulUseCase);
    });

    it('should create child logger with use case name in context', () => {
      new SuccessfulUseCase(mockLogger, 'TestUseCase');

      expect(mockLogger.childCalls).toHaveLength(1);
      expect(mockLogger.childCalls[0]).toEqual({
        useCase: 'TestUseCase'
      });
    });
  });

  // ========================================
  // Successful Execution Tests
  // ========================================

  describe('execute - successful flow', () => {
    it('should execute successfully and return result', async () => {
      const useCase = new SuccessfulUseCase(
        mockLogger,
        'SuccessfulUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        result: 'Processed test',
        timestamp: new Date('2026-01-10T12:00:00Z')
      });
    });

    it('should log start of execution', async () => {
      const useCase = new SuccessfulUseCase(
        mockLogger,
        'SuccessfulUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      expect(mockLogger.infoCalls).toContainEqual(
        expect.objectContaining({
          message: 'Executing SuccessfulUseCase',
          context: expect.objectContaining({
            request: expect.any(Object)
          })
        })
      );
    });

    it('should log successful completion with duration', async () => {
      const useCase = new SuccessfulUseCase(
        mockLogger,
        'SuccessfulUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      const completionLog = mockLogger.infoCalls.find((call) =>
        call.message.includes('completed successfully')
      );

      expect(completionLog).toBeDefined();
      expect(completionLog?.context).toHaveProperty('duration');
      expect(completionLog?.context?.duration).toMatch(/\d+ms/);
      expect(completionLog?.context).toHaveProperty('response');
    });
  });

  // ========================================
  // Failing Execution Tests
  // ========================================

  describe('execute - failing flow', () => {
    it('should return failed result when executeImpl fails', async () => {
      const useCase = new FailingUseCase(
        mockLogger,
        'FailingUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Business rule violation');
    });

    it('should log error when execution fails', async () => {
      const useCase = new FailingUseCase(
        mockLogger,
        'FailingUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      const errorLog = mockLogger.errorCalls.find((call) =>
        call.message.includes('FailingUseCase failed')
      );

      expect(errorLog).toBeDefined();
      expect(errorLog?.context).toHaveProperty('duration');
      expect(errorLog?.context).toHaveProperty('error');
      expect(errorLog?.context?.error).toBe(
        'Business rule violation'
      );
    });
  });

  // ========================================
  // Error Handling Tests
  // ========================================

  describe('execute - error handling', () => {
    it('should catch and handle unexpected Error objects', async () => {
      const useCase = new ThrowingUseCase(
        mockLogger,
        'ThrowingUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'Unexpected error in ThrowingUseCase: Unexpected database error'
      );
    });

    it('should log unexpected errors with error object', async () => {
      const useCase = new ThrowingUseCase(
        mockLogger,
        'ThrowingUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      const errorLog = mockLogger.errorCalls.find((call) =>
        call.message.includes('threw unexpected error')
      );

      expect(errorLog).toBeDefined();
      expect(errorLog?.error).toBeInstanceOf(Error);
      expect(errorLog?.error?.message).toBe(
        'Unexpected database error'
      );
      expect(errorLog?.context).toHaveProperty('duration');
      expect(errorLog?.context).toHaveProperty('request');
    });

    it('should handle non-Error thrown objects', async () => {
      const useCase = new ThrowingNonErrorUseCase(
        mockLogger,
        'ThrowingNonErrorUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'Unexpected error in ThrowingNonErrorUseCase: String error'
      );
    });

    it('should create Error object when non-Error is thrown', async () => {
      const useCase = new ThrowingNonErrorUseCase(
        mockLogger,
        'ThrowingNonErrorUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      const errorLog = mockLogger.errorCalls.find((call) =>
        call.message.includes('threw unexpected error')
      );

      expect(errorLog?.error).toBeInstanceOf(Error);
      expect(errorLog?.error?.message).toBe('String error');
    });
  });

  // ========================================
  // beforeExecute Hook Tests
  // ========================================

  describe('beforeExecute hook', () => {
    it('should call beforeExecute hook before executeImpl', async () => {
      const useCase = new UseCaseWithBeforeHook(
        mockLogger,
        'UseCaseWithBeforeHook'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(useCase.beforeExecuteCalled).toBe(true);
      expect(result.isSuccess).toBe(true);
    });

    it('should stop execution if beforeExecute fails', async () => {
      const useCase = new UseCaseWithBeforeHook(
        mockLogger,
        'UseCaseWithBeforeHook'
      );
      useCase.shouldFailBeforeExecute = true;
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(useCase.beforeExecuteCalled).toBe(true);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Pre-execution validation failed');
    });

    it('should log warning when beforeExecute fails', async () => {
      const useCase = new UseCaseWithBeforeHook(
        mockLogger,
        'UseCaseWithBeforeHook'
      );
      useCase.shouldFailBeforeExecute = true;
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      const warnLog = mockLogger.warnCalls.find((call) =>
        call.message.includes('failed in beforeExecute')
      );

      expect(warnLog).toBeDefined();
      expect(warnLog?.context).toHaveProperty('error');
      expect(warnLog?.context?.error).toBe(
        'Pre-execution validation failed'
      );
    });

    it('should not call afterExecute if beforeExecute fails', async () => {
      const useCase = new UseCaseWithBeforeHook(
        mockLogger,
        'UseCaseWithBeforeHook'
      );
      useCase.shouldFailBeforeExecute = true;
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      // Only start log and beforeExecute warning should be present
      expect(mockLogger.infoCalls).toHaveLength(1); // Only start log
      expect(mockLogger.warnCalls).toHaveLength(1); // Only beforeExecute warning
    });
  });

  // ========================================
  // afterExecute Hook Tests
  // ========================================

  describe('afterExecute hook', () => {
    it('should call afterExecute hook after successful executeImpl', async () => {
      const useCase = new UseCaseWithAfterHook(
        mockLogger,
        'UseCaseWithAfterHook'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(useCase.afterExecuteCalled).toBe(true);
      expect(useCase.receivedResponse).toEqual({
        result: 'Processed test',
        timestamp: new Date('2026-01-10T12:00:00Z')
      });
      expect(result.isSuccess).toBe(true);
    });

    it('should NOT call afterExecute if executeImpl fails', async () => {
      // Create a use case that fails in executeImpl
      class FailingUseCaseWithAfterHook extends UseCaseWithAfterHook {
        protected async executeImpl(): Promise<Result<TestResponse>> {
          return this.fail('Execution failed');
        }
      }

      const useCase = new FailingUseCaseWithAfterHook(
        mockLogger,
        'FailingUseCaseWithAfterHook'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(useCase.afterExecuteCalled).toBe(false);
      expect(result.isFailure).toBe(true);
    });

    it('should return failure if afterExecute fails', async () => {
      const useCase = new UseCaseWithAfterHook(
        mockLogger,
        'UseCaseWithAfterHook'
      );
      useCase.shouldFailAfterExecute = true;
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(useCase.afterExecuteCalled).toBe(true);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Post-execution processing failed');
    });

    it('should log warning when afterExecute fails', async () => {
      const useCase = new UseCaseWithAfterHook(
        mockLogger,
        'UseCaseWithAfterHook'
      );
      useCase.shouldFailAfterExecute = true;
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      const warnLog = mockLogger.warnCalls.find((call) =>
        call.message.includes('failed in afterExecute')
      );

      expect(warnLog).toBeDefined();
      expect(warnLog?.context).toHaveProperty('error');
      expect(warnLog?.context?.error).toBe(
        'Post-execution processing failed'
      );
    });
  });

  // ========================================
  // Sanitization Tests
  // ========================================

  describe('sanitizeForLogging', () => {
    it('should use default sanitization (returns data as-is)', async () => {
      const useCase = new SuccessfulUseCase(
        mockLogger,
        'SuccessfulUseCase'
      );
      const request: TestRequest = {
        name: 'test',
        value: 42,
        password: 'secret123'
      };

      await useCase.execute(request);

      const startLog = mockLogger.infoCalls[0];
      expect(startLog.context?.request).toEqual(request);
      // Password is NOT redacted in default implementation
      expect(
        (startLog.context?.request as TestRequest).password
      ).toBe('secret123');
    });

    it('should use custom sanitization when overridden', async () => {
      const useCase = new UseCaseWithSanitization(
        mockLogger,
        'UseCaseWithSanitization'
      );
      const request: TestRequest = {
        name: 'test',
        value: 42,
        password: 'secret123'
      };

      await useCase.execute(request);

      const startLog = mockLogger.infoCalls[0];
      expect(startLog.context?.request).toEqual({
        name: 'test',
        value: 42,
        password: '***REDACTED***'
      });
    });

    it('should sanitize both request and response in logs', async () => {
      const useCase = new UseCaseWithSanitization(
        mockLogger,
        'UseCaseWithSanitization'
      );
      const request: TestRequest = {
        name: 'test',
        value: 42,
        password: 'secret123'
      };

      await useCase.execute(request);

      // Check start log (request)
      const startLog = mockLogger.infoCalls[0];
      expect(
        (startLog.context?.request as TestRequest).password
      ).toBe('***REDACTED***');

      // Check completion log (response)
      const completionLog = mockLogger.infoCalls[1];
      expect(completionLog.context).toHaveProperty('response');
    });
  });

  // ========================================
  // Helper Methods Tests
  // ========================================

  describe('fail helper method', () => {
    it('should create a failed Result', async () => {
      const useCase = new FailingUseCase(
        mockLogger,
        'FailingUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Business rule violation');
    });

    it('should log debug message when fail is called', async () => {
      const useCase = new FailingUseCase(
        mockLogger,
        'FailingUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      const debugLog = mockLogger.debugCalls.find((call) =>
        call.message.includes(
          'UseCase validation/business rule failed'
        )
      );

      expect(debugLog).toBeDefined();
    });
  });

  describe('ok helper method', () => {
    it('should create a successful Result', async () => {
      const useCase = new SuccessfulUseCase(
        mockLogger,
        'SuccessfulUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      const result = await useCase.execute(request);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
    });
  });

  // ========================================
  // Integration Tests
  // ========================================

  describe('complete execution flow', () => {
    it('should execute all hooks in correct order for successful case', async () => {
      const executionOrder: string[] = [];

      class OrderTrackingUseCase extends UseCase<
        TestRequest,
        TestResponse
      > {
        protected async beforeExecute(): Promise<Result<void> | null> {
          executionOrder.push('beforeExecute');
          return null;
        }

        protected async executeImpl(): Promise<Result<TestResponse>> {
          executionOrder.push('executeImpl');
          return this.ok({
            result: 'Success',
            timestamp: new Date()
          });
        }

        protected async afterExecute(): Promise<Result<void> | null> {
          executionOrder.push('afterExecute');
          return null;
        }
      }

      const useCase = new OrderTrackingUseCase(
        mockLogger,
        'OrderTrackingUseCase'
      );
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      expect(executionOrder).toEqual([
        'beforeExecute',
        'executeImpl',
        'afterExecute'
      ]);
    });

    it('should measure execution duration accurately', async () => {
      class SlowUseCase extends UseCase<TestRequest, TestResponse> {
        protected async executeImpl(): Promise<Result<TestResponse>> {
          // Simulate slow operation
          await new Promise((resolve) => setTimeout(resolve, 100));
          return this.ok({
            result: 'Success',
            timestamp: new Date()
          });
        }
      }

      const useCase = new SlowUseCase(mockLogger, 'SlowUseCase');
      const request: TestRequest = { name: 'test', value: 42 };

      await useCase.execute(request);

      const completionLog = mockLogger.infoCalls.find((call) =>
        call.message.includes('completed successfully')
      );

      expect(completionLog?.context?.duration).toBeDefined();
      const duration = parseInt(
        (completionLog?.context?.duration as string).replace('ms', '')
      );
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });
});
