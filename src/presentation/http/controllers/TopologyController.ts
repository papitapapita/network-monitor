import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  GetTopologyUseCase,
  GetDeviceDescendantsUseCase,
  ListUpstreamSuggestionsUseCase,
  AcceptUpstreamSuggestionsUseCase,
  GetRouterNeighborsUseCase
} from 'application/device-inventory/use-cases';

export class TopologyController {
  constructor(
    private readonly getTopologyUseCase: GetTopologyUseCase,
    private readonly getDescendantsUseCase: GetDeviceDescendantsUseCase,
    private readonly listSuggestionsUseCase: ListUpstreamSuggestionsUseCase,
    private readonly acceptSuggestionsUseCase: AcceptUpstreamSuggestionsUseCase,
    private readonly getRouterNeighborsUseCase: GetRouterNeighborsUseCase,
    private readonly logger: ILogger
  ) {}

  public getTopology = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getTopologyUseCase.execute({});
      if (result.isFailure) {
        res.status(500).json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public getDescendants = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getDescendantsUseCase.execute({
        deviceId: req.params.deviceId
      });
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public listSuggestions = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const locationId =
        typeof req.query.locationId === 'string'
          ? req.query.locationId
          : undefined;
      const result = await this.listSuggestionsUseCase.execute({
        locationId
      });
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  // 200 even when some links were refused: each one carries its own outcome.
  public acceptSuggestions = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.acceptSuggestionsUseCase.execute({
        links: req.body.links
      });
      if (result.isFailure) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  // 200 with a reason when the router could not be read (DEV-198).
  public getRouterNeighbors = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getRouterNeighborsUseCase.execute({
        deviceId: req.params.deviceId
      });
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('not found')) return 404;
    if (errorMessage.includes('Invalid')) return 400;
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in TopologyController',
      error as Error,
      { error: errorMessage }
    );

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
