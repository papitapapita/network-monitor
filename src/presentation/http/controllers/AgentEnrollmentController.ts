import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  EnrollAgentUseCase,
  INVALID_PAIRING_CODE
} from 'application/probe-agents/use-cases';

export class AgentEnrollmentController {
  constructor(
    private readonly enrollUseCase: EnrollAgentUseCase,
    private readonly logger: ILogger
  ) {}

  public enroll = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.enrollUseCase.execute({
        pairingCode: req.body.pairingCode
      });
      if (result.isFailure) {
        const status =
          result.error === INVALID_PAIRING_CODE
            ? 401
            : result.error.includes('required')
              ? 400
              : 500;
        res
          .status(status)
          .json({ success: false, error: result.error });
        return;
      }
      res.status(201).json({ success: true, data: result.value });
    } catch (error) {
      this.logger.error(
        'Unexpected error in AgentEnrollmentController',
        error as Error
      );
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  };
}
