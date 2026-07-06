import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  CreateServicePlanUseCase,
  GetServicePlanUseCase,
  ListServicePlansUseCase,
  UpdateServicePlanUseCase,
  DeleteServicePlanUseCase
} from 'application/customers/use-cases';

export class ServicePlanController {
  constructor(
    private readonly createUseCase: CreateServicePlanUseCase,
    private readonly getUseCase: GetServicePlanUseCase,
    private readonly listUseCase: ListServicePlansUseCase,
    private readonly updateUseCase: UpdateServicePlanUseCase,
    private readonly deleteUseCase: DeleteServicePlanUseCase,
    private readonly logger: ILogger
  ) {}

  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.createUseCase.execute(req.body);
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(201).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.listUseCase.execute({
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset
          ? Number(req.query.offset)
          : undefined
      });
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public getById = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getUseCase.execute({
        id: req.params.id
      });
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public update = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.updateUseCase.execute({
        id: req.params.id,
        ...req.body
      });
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public delete = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.deleteUseCase.execute({
        id: req.params.id
      });
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(204).send();
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(errorMessage: string): number {
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('Not found')
    ) {
      return 404;
    }
    if (
      errorMessage.includes('already exists') ||
      errorMessage.includes('Cannot delete') ||
      errorMessage.includes('referenced by')
    ) {
      return 409;
    }
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('cannot be') ||
      errorMessage.includes('cannot exceed')
    ) {
      return 400;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    this.logger.error(
      'Unexpected error in ServicePlanController',
      error as Error,
      { error: errorMessage }
    );
    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
