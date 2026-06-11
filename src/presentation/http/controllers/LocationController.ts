import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  CreateLocationInput,
  UpdateLocationInput
} from '../validation';
import {
  CreateLocationUseCase,
  GetLocationUseCase,
  ListLocationsUseCase,
  UpdateLocationUseCase,
  GetMapLocationsUseCase,
  DeleteLocationUseCase
} from 'application/device-inventory/use-cases';

export class LocationController {
  constructor(
    private readonly createUseCase: CreateLocationUseCase,
    private readonly getUseCase: GetLocationUseCase,
    private readonly listUseCase: ListLocationsUseCase,
    private readonly updateUseCase: UpdateLocationUseCase,
    private readonly getMapUseCase: GetMapLocationsUseCase,
    private readonly deleteUseCase: DeleteLocationUseCase,
    private readonly logger: ILogger
  ) {}

  public getMap = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getMapUseCase.execute({});

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const body = req.body as CreateLocationInput;

      const result = await this.createUseCase.execute({
        name: body.name,
        type: body.type,
        municipality: body.municipality ?? null,
        neighborhood: body.neighborhood ?? null,
        address: body.address ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        altitude: body.altitude
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public list = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // Zod validates format but does not mutate req.query, so numeric
      // query params arrive as strings and must be converted explicitly.
      const result = await this.listUseCase.execute({
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset
          ? Number(req.query.offset)
          : undefined,
        type: req.query.type as string | undefined
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
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
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public update = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const body = req.body as UpdateLocationInput;

      const result = await this.updateUseCase.execute({
        id: req.params.id,
        ...body
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
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
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('not found')) {
      return 404;
    }

    if (errorMessage.includes('Cannot delete')) {
      return 409;
    }

    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('cannot be empty') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('must not exceed') ||
      errorMessage.includes('At least one')
    ) {
      return 400;
    }

    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in LocationController',
      error as Error,
      { error: errorMessage }
    );

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
