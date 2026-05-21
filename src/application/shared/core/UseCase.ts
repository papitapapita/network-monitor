import { Result } from '../../../domain/shared';
import { IUseCase, ILogger } from '../interfaces';

/**
 * UseCase Abstract Base Class
 *
 * Implements the Template Method pattern to provide consistent structure
 * and behavior across all use cases in the application.
 *
 * Benefits:
 * - Consistent error handling and logging
 * - Pre/post execution hooks for cross-cutting concerns
 * - Reduced boilerplate in concrete use cases
 * - Easy to add transaction management, validation, etc.
 *
 * Concrete use cases only need to implement the `executeImpl` method
 * with their specific business logic.
 *
 * @template Request - The input DTO type
 * @template Response - The output DTO type
 *
 * @example
 * class CreateNetworkDeviceUseCase extends UseCase<CreateDeviceRequest, CreateDeviceResponse> {
 *   constructor(
 *     private deviceRepo: INetworkDeviceRepository,
 *     logger: ILogger
 *   ) {
 *     super(logger, 'CreateNetworkDeviceUseCase');
 *   }
 *
 *   protected async executeImpl(request: CreateDeviceRequest): Promise<Result<CreateDeviceResponse>> {
 *     // Business logic here
 *   }
 * }
 */
export abstract class UseCase<Request, Response>
  implements IUseCase<Request, Response>
{
  protected readonly logger: ILogger;
  private readonly useCaseName: string;

  /**
   * Creates a new UseCase instance.
   *
   * @param logger - Logger instance for this use case
   * @param useCaseName - Name of the use case (for logging and debugging)
   */
  constructor(logger: ILogger, useCaseName: string) {
    this.logger = logger.child({ useCase: useCaseName });
    this.useCaseName = useCaseName;
  }

  /**
   * Template method that orchestrates use case execution.
   * This method should NOT be overridden by concrete use cases.
   *
   * Execution flow:
   * 1. Log start
   * 2. Call beforeExecute hook
   * 3. Call executeImpl (concrete implementation)
   * 4. Call afterExecute hook
   * 5. Log completion
   * 6. Return result
   *
   * If any step fails, the error is caught, logged, and returned as a Result.fail()
   *
   * @param request - The use case request DTO
   * @returns Result containing response or error
   */
  public async execute(request: Request): Promise<Result<Response>> {
    const startTime = Date.now();

    try {
      // Log use case start
      this.logger.info(`Executing ${this.useCaseName}`, {
        request: this.sanitizeForLogging(request)
      });

      // Pre-execution hook
      const beforeResult = await this.beforeExecute(request);
      if (beforeResult && beforeResult.isFailure) {
        this.logger.warn(
          `${this.useCaseName} failed in beforeExecute`,
          {
            error: beforeResult.error
          }
        );
        return Result.fail<Response>(beforeResult.error);
      }

      // Execute the actual use case logic
      const result = await this.executeImpl(request);

      // Post-execution hook (only if execution succeeded)
      if (result.isSuccess) {
        const afterResult = await this.afterExecute(
          request,
          result.value
        );
        if (afterResult && afterResult.isFailure) {
          this.logger.warn(
            `${this.useCaseName} failed in afterExecute`,
            {
              error: afterResult.error
            }
          );
          return Result.fail<Response>(afterResult.error);
        }
      }

      // Log completion
      const duration = Date.now() - startTime;
      if (result.isSuccess) {
        this.logger.info(
          `${this.useCaseName} completed successfully`,
          {
            duration: `${duration}ms`,
            response: this.sanitizeForLogging(result.value)
          }
        );
      } else {
        this.logger.error(
          `${this.useCaseName} failed: ${result.error}`,
          undefined,
          { duration: `${duration}ms` }
        );
      }

      return result;
    } catch (error) {
      // Catch any unexpected errors
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `${this.useCaseName} threw unexpected error`,
        error instanceof Error ? error : new Error(errorMessage),
        {
          duration: `${duration}ms`,
          request: this.sanitizeForLogging(request)
        }
      );

      return Result.fail<Response>(
        `Unexpected error in ${this.useCaseName}: ${errorMessage}`
      );
    }
  }

  /**
   * Abstract method that concrete use cases must implement.
   * Contains the actual business logic for the use case.
   *
   * @param request - The use case request DTO
   * @returns Result containing response or error
   */
  protected abstract executeImpl(
    request: Request
  ): Promise<Result<Response>>;

  /**
   * Hook executed before the main use case logic.
   * Override this to add pre-execution validation, authorization, etc.
   *
   * @param _request - The use case request DTO
   * @returns Result indicating success or failure (failure stops execution)
   */
  protected async beforeExecute(
    _request: Request
  ): Promise<Result<void> | null> {
    // Default: no pre-execution logic
    return null;
  }

  /**
   * Hook executed after successful use case execution.
   * Override this to add post-execution logic like event publishing,
   * cache invalidation, etc.
   *
   * @param _request - The use case request DTO
   * @param _response - The use case response DTO
   * @returns Result indicating success or failure
   */
  protected async afterExecute(
    _request: Request,
    _response: Response
  ): Promise<Result<void> | null> {
    // Default: no post-execution logic
    return null;
  }

  /**
   * Sanitizes request/response data for logging.
   * Override this to remove sensitive data (passwords, tokens, etc.)
   * before logging.
   *
   * @param data - The data to sanitize
   * @returns Sanitized data safe for logging
   */
  protected sanitizeForLogging(data: unknown): unknown {
    if (!data) return data;

    // Default: return data as-is
    // Concrete use cases should override this to remove sensitive fields
    return data;
  }

  /**
   * Helper method to create a failed Result with consistent error logging.
   *
   * @param message - Error message
   * @param context - Optional context for logging
   * @returns Failed Result
   */
  protected fail<T>(message: string, context?: any): Result<T> {
    this.logger.debug(
      `UseCase validation/business rule failed: ${message}`,
      context
    );
    return Result.fail<T>(message);
  }

  /**
   * Helper method to create a successful Result.
   *
   * @param value - The success value
   * @returns Successful Result
   */
  protected ok<T>(value: T): Result<T> {
    return Result.ok<T>(value);
  }
}
