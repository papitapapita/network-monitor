import { Result } from 'domain/shared/core';

export interface IUseCase<Request, Response> {
  execute(request: Request): Promise<Result<Response>>;
}
