import { Request, Response } from 'express';
import { Result } from 'domain/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  CreateAgentUseCase,
  ListAgentsUseCase,
  GetAgentUseCase,
  ReissuePairingKeyUseCase,
  RevokeAgentUseCase,
  ListAgentOutagesUseCase,
  AGENT_PUBLIC_URL_MISSING
} from 'application/probe-agents/use-cases';

export class AgentController {
  constructor(
    private readonly createUseCase: CreateAgentUseCase,
    private readonly listUseCase: ListAgentsUseCase,
    private readonly getUseCase: GetAgentUseCase,
    private readonly reissueUseCase: ReissuePairingKeyUseCase,
    private readonly revokeUseCase: RevokeAgentUseCase,
    private readonly listOutagesUseCase: ListAgentOutagesUseCase,
    private readonly logger: ILogger
  ) {}

  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.respond(res, 201, () =>
      this.createUseCase.execute({ name: req.body.name })
    );
  };

  public list = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    await this.respond(res, 200, () => this.listUseCase.execute());
  };

  public getById = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.respond(res, 200, () =>
      this.getUseCase.execute({ id: req.params.id })
    );
  };

  public listOutages = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const q = req.query as Record<string, string | undefined>;
    await this.respond(res, 200, () =>
      this.listOutagesUseCase.execute({
        id: req.params.id,
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined
      })
    );
  };

  public reissuePairingKey = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.respond(res, 200, () =>
      this.reissueUseCase.execute({ id: req.params.id })
    );
  };

  public revoke = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.respond(res, 200, () =>
      this.revokeUseCase.execute({ id: req.params.id })
    );
  };

  private async respond<T>(
    res: Response,
    successStatus: number,
    run: () => Promise<Result<T>>
  ): Promise<void> {
    try {
      const result = await run();
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error))
          .json({ success: false, error: result.error });
        return;
      }
      res
        .status(successStatus)
        .json({ success: true, data: result.value });
    } catch (error) {
      this.logger.error(
        'Unexpected error in AgentController',
        error as Error
      );
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  }

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage === AGENT_PUBLIC_URL_MISSING) return 503;
    if (errorMessage.includes('not found')) return 404;
    if (
      errorMessage.includes('already exists') ||
      errorMessage.includes('already revoked') ||
      errorMessage.includes('Only a pending agent')
    ) {
      return 409;
    }
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('cannot')
    ) {
      return 400;
    }
    return 500;
  }
}
