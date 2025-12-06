import { Result } from '../../domain/shared/kernel/Result';

/**
 * IUseCase Interface
 *
 * Defines the contract for all application use cases.
 * Use cases encapsulate business workflows and orchestrate domain objects
 * to accomplish specific application tasks.
 *
 * All use cases follow the Command/Query pattern:
 * - Commands: Modify state, return Result<void> or Result<T>
 * - Queries: Read state, return Result<T>
 *
 * Use cases accept a request DTO and return a Result containing
 * a response DTO or an error.
 *
 * @template Request - The input DTO type
 * @template Response - The output DTO type
 *
 * @example
 * class CreateDeviceUseCase implements IUseCase<CreateDeviceRequest, CreateDeviceResponse> {
 *   async execute(request: CreateDeviceRequest): Promise<Result<CreateDeviceResponse>> {
 *     // Implementation
 *   }
 * }
 */
export interface IUseCase<Request, Response> {
  /**
   * Executes the use case.
   *
   * @param request - The use case request DTO
   * @returns Result containing the response DTO or error
   */
  execute(request: Request): Promise<Result<Response>>;
}
