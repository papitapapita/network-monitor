import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { CreateDeviceInput, UpdateDeviceInput } from '../validation';
import {
  CreateDeviceUseCase,
  GetDeviceUseCase,
  ListDevicesUseCase,
  UpdateDeviceUseCase,
  DeleteDeviceUseCase
} from 'application/device-inventory/use-cases';

export class DeviceController {
  constructor(
    private readonly createUseCase: CreateDeviceUseCase,
    private readonly getUseCase: GetDeviceUseCase,
    private readonly listUseCase: ListDevicesUseCase,
    private readonly updateUseCase: UpdateDeviceUseCase,
    private readonly deleteUseCase: DeleteDeviceUseCase,
    private readonly logger: ILogger
  ) {}

  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const body = req.body as CreateDeviceInput;

      const result = await this.createUseCase.execute({
        deviceModelId: body.deviceModelId,
        name: body.name,
        ownerType: body.ownerType,
        status: body.status,
        category: body.category ?? null,
        locationId: body.locationId ?? null,
        serialNumber: body.serialNumber ?? null,
        macAddress: body.macAddress ?? null,
        ipAddress: body.ipAddress ?? null,
        description: body.description ?? null,
        installedDate: body.installedDate ?? null,
        monitoringEnabled: body.monitoringEnabled
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
          .json({ success: false, error: result.error });
        return;
      }

      res.status(201).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public list = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const q = req.query as Record<string, string | undefined>;

      const result = await this.listUseCase.execute({
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
        status: q.status,
        category: q.category,
        owner: q.owner,
        locationId: q.locationId,
        deviceModelId: q.deviceModelId,
        monitoringEnabled:
          q.monitoringEnabled != null
            ? q.monitoringEnabled === 'true'
            : undefined,
        search: q.search,
        sortBy: q.sortBy as
          | 'createdAt'
          | 'updatedAt'
          | 'name'
          | 'status'
          | undefined,
        sortOrder: q.sortOrder as 'ASC' | 'DESC' | undefined
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
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
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
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
      const body = req.body as UpdateDeviceInput;

      const result = await this.updateUseCase.execute({
        id: req.params.id,
        ...body
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
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
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
          .json({ success: false, error: result.error });
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

    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('cannot be empty') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('must have') ||
      errorMessage.includes('must not exceed') ||
      errorMessage.includes('already assigned') ||
      errorMessage.includes('Cannot ') ||
      errorMessage.includes('Failed to persist')
    ) {
      return 400;
    }

    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in DeviceController',
      error as Error,
      {
        error: errorMessage
      }
    );

    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
