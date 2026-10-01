import { NextFunction, Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  AGENT_RELEASE_FILE_NOT_FOUND,
  AuthenticateAgentUseCase,
  OpenAgentReleaseFileUseCase
} from 'application/probe-agents/use-cases';

// AGT-083: release binaries, for agents only. The agent's own token is the
// credential, as on its WebSocket (R4); a user's JWT opens nothing here.
export class AgentUpdateController {
  constructor(
    private readonly authenticate: AuthenticateAgentUseCase,
    private readonly openRelease: OpenAgentReleaseFileUseCase,
    private readonly logger: ILogger
  ) {}

  // Before validation, as on /api: a caller without a valid token learns
  // nothing about what is served here.
  public requireAgent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token =
        req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ??
        '';
      const auth = await this.authenticate.execute({ token });
      if (auth.isFailure) {
        res
          .status(401)
          .json({ success: false, error: 'Unauthorized' });
        return;
      }
      res.locals.agentId = auth.value.agentId;
      next();
    } catch (error) {
      this.logger.error(
        'Unexpected error in AgentUpdateController',
        error as Error
      );
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  };

  public download = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const fileName = req.params.fileName;
      const opened = await this.openRelease.execute({ fileName });
      if (opened.isFailure) {
        const notFound =
          opened.error === AGENT_RELEASE_FILE_NOT_FOUND;
        res
          .status(notFound ? 404 : 500)
          .json({ success: false, error: opened.error });
        return;
      }

      const { bytes, stream } = opened.value;
      stream.on('error', (error: Error) => {
        this.logger.error('Agent release download failed', error, {
          fileName
        });
        if (res.headersSent) res.destroy(error);
        else
          res
            .status(500)
            .json({ success: false, error: 'Internal server error' });
      });
      this.logger.info('Agent downloading a release', {
        agentId: res.locals.agentId,
        fileName
      });
      res.status(200);
      res.type('application/gzip');
      res.setHeader('Content-Length', String(bytes));
      res.setHeader('Cache-Control', 'no-store');
      stream.pipe(res);
    } catch (error) {
      this.logger.error(
        'Unexpected error in AgentUpdateController',
        error as Error
      );
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  };
}
