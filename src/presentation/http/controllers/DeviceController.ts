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

/**
 * DeviceController
 *
 * HTTP controller for Device CRUD operations within the device-inventory
 * Bounded Context.
 *
 * Responsibilities:
 * - Translate validated HTTP requests into application-layer DTO calls.
 * - Map use case Results to HTTP status codes and response bodies.
 * - Contain NO business logic — all invariants live in use cases and the domain.
 *
 * Endpoints handled:
 * - POST   /api/devices      - Register a new device
 * - GET    /api/devices      - List devices (paginated, optional filters)
 * - GET    /api/devices/:id  - Get a single device by ID
 * - PATCH  /api/devices/:id  - Partially update a device
 * - DELETE /api/devices/:id  - Permanently remove a device
 *
 * Response Codes:
 * - 200 OK          - Successful GET
 * - 201 Created     - Successful POST
 * - 204 No Content  - Successful DELETE
 * - 400 Bad Request - Validation errors, invalid input
 * - 404 Not Found   - Device does not exist
 * - 500 Internal    - Unexpected errors
 */
export class DeviceController {
  constructor(
    private readonly createUseCase: CreateDeviceUseCase,
    private readonly getUseCase: GetDeviceUseCase,
    private readonly listUseCase: ListDevicesUseCase,
    private readonly updateUseCase: UpdateDeviceUseCase,
    private readonly deleteUseCase: DeleteDeviceUseCase,
    private readonly logger: ILogger
  ) {}

  // =====================================
  // ENDPOINT HANDLERS
  // =====================================

  /**
   * POST /api/devices
   *
   * Registers a new device in the device-inventory context.
   * Delegates to CreateDeviceUseCase.
   *
   * Body: CreateDeviceInput (validated by Zod before reaching here)
   * Response: 201 Created with DeviceResponseDTO
   * Errors:
   *   400 - Validation failure or business rule violation (duplicate MAC/IP)
   *   500 - Unexpected infrastructure error
   */
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

  /**
   * GET /api/devices
   *
   * Returns a paginated, optionally filtered list of devices.
   * Delegates to ListDevicesUseCase.
   *
   * Query params: limit, offset, status, category, owner, locationId,
   *               deviceModelId, monitoringEnabled, search, sortBy, sortOrder
   * Response: 200 OK with DeviceListResponseDTO
   * Errors:
   *   400 - Invalid filter or pagination values
   *   500 - Unexpected infrastructure error
   */
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

  /**
   * GET /api/devices/:id
   *
   * Returns a single device by its UUID.
   * Delegates to GetDeviceUseCase.
   *
   * Params: id (UUID v4, validated by Zod)
   * Response: 200 OK with DeviceResponseDTO
   * Errors:
   *   400 - Invalid UUID format
   *   404 - Device does not exist
   *   500 - Unexpected infrastructure error
   */
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

  /**
   * PATCH /api/devices/:id
   *
   * Partially updates an existing device. Only supplied fields are changed;
   * omitted fields are left as-is (PATCH semantics).
   * Delegates to UpdateDeviceUseCase.
   *
   * Params: id (UUID v4, validated by Zod)
   * Body: UpdateDeviceInput (all fields optional, validated by Zod)
   * Response: 200 OK with DeviceResponseDTO
   * Errors:
   *   400 - Validation failure, invalid enum, duplicate MAC/IP
   *   404 - Device does not exist
   *   500 - Unexpected infrastructure error
   */
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

  /**
   * DELETE /api/devices/:id
   *
   * Permanently removes a device from the device-inventory context.
   * Delegates to DeleteDeviceUseCase.
   *
   * Params: id (UUID v4, validated by Zod)
   * Response: 204 No Content
   * Errors:
   *   400 - Invalid UUID format
   *   404 - Device does not exist
   *   500 - Unexpected infrastructure error
   */
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

  // =====================================
  // PRIVATE HELPERS
  // =====================================

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
