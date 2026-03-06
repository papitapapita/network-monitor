import { Request, Response } from 'express';
import { CreateNetworkDeviceUseCase } from '../../../application/legacy/use-cases/CreateNetworkDeviceUseCase';
import { ILogger } from '../../../application/shared/interfaces/ILogger';

/**
 * NetworkDeviceController
 *
 * HTTP controller for NetworkDevice CRUD operations.
 *
 * REQ-002: Enhanced with lifecycle management endpoints:
 * - Activation workflow (DRAFT → ACTIVE)
 * - Soft delete with 7-day grace period
 * - Restore from soft delete
 *
 * Standard CRUD Endpoints:
 * - POST   /api/network-devices             - Create device (DRAFT or ACTIVE)
 * - GET    /api/network-devices             - List devices (with pagination/filters)
 * - GET    /api/network-devices/by-ip       - Get device by IP
 * - GET    /api/network-devices/:id         - Get device by ID
 * - PUT    /api/network-devices/:id         - Update device
 * - DELETE /api/network-devices/:id         - Hard delete device
 *
 * REQ-002 Lifecycle Endpoints:
 * - POST   /api/network-devices/:id/activate   - Activate DRAFT device
 * - DELETE /api/network-devices/:id/soft       - Soft delete device
 * - POST   /api/network-devices/:id/restore    - Restore soft-deleted device
 *
 * Response Codes:
 * - 200 OK             - Successful GET, PUT, POST (activate/restore)
 * - 201 Created        - Successful POST (create)
 * - 204 No Content     - Successful DELETE
 * - 400 Bad Request    - Validation errors, business rule violations
 * - 404 Not Found      - Resource not found
 * - 409 Conflict       - Duplicate IP/MAC, restore conflicts
 * - 410 Gone           - Grace period expired (restore)
 * - 422 Unprocessable  - Invalid state transition
 * - 500 Internal Error - Unexpected errors
 */
export class NetworkDeviceController {
  constructor(
    private readonly createUseCase: CreateNetworkDeviceUseCase,
    /**private readonly getUseCase: GetNetworkDeviceUseCase,
    private readonly getByIpUseCase: GetNetworkDeviceByIpUseCase,
    private readonly updateUseCase: UpdateNetworkDeviceUseCase,
    private readonly deleteUseCase: DeleteNetworkDeviceUseCase,
    private readonly listUseCase: ListNetworkDevicesUseCase,
    private readonly activateUseCase: ActivateNetworkDeviceUseCase,
    private readonly softDeleteUseCase: SoftDeleteNetworkDeviceUseCase,
    private readonly restoreUseCase: RestoreNetworkDeviceUseCase,**/
    private readonly logger: ILogger
  ) {}

  /**
   * POST /api/network-devices
   * Creates a new network device.
   */
  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.createUseCase.execute(req.body);

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

  /**
   * GET /api/network-devices
   * Lists network devices with pagination and optional filters.
   *
   * REQ-002: Supports activationStatus filter (DRAFT/ACTIVE)
   */
  /**public list = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const query = {
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset
          ? Number(req.query.offset)
          : undefined,
        status: req.query.status as string | undefined,
        deviceType: req.query.deviceType as string | undefined,
        activationStatus: req.query.activationStatus as
          | string
          | undefined // REQ-002
      };

      const result = await this.listUseCase.execute(query);

      if (result.isFailure) {
        res.status(400).json({
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

  /**
   * GET /api/network-devices/by-ip?ip=...
   * Gets a network device by IP address.
   */
  /**public getByIp = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getByIpUseCase.execute({
        ipAddress: req.query.ip as string
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

  /**
   * GET /api/network-devices/:id
   * Gets a network device by ID.
   */
  /**public getById = async (
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

  /**
   * PUT /api/network-devices/:id
   * Updates a network device.
   */
  /**public update = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.updateUseCase.execute({
        id: req.params.id,
        ...req.body
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

  /**
   * DELETE /api/network-devices/:id
   * Hard deletes a network device permanently.
   *
   * Note: Use softDelete endpoint for most cases.
   */
  /**public delete = async (
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

      // 204 No Content - successful deletion
      res.status(204).send();
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  // ===================================
  // REQ-002: LIFECYCLE ENDPOINTS
  // ===================================

  /**
   * POST /api/network-devices/:id/activate
   * Activates a DRAFT device to ACTIVE status.
   *
   * REQ-002: DRAFT → ACTIVE transition
   * Requires name and deviceType to be provided.
   */
  /**public activate = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.activateUseCase.execute({
        id: req.params.id,
        requestDTO: req.body
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

  /**
   * DELETE /api/network-devices/:id/soft
   * Soft-deletes a network device with 7-day grace period.
   *
   * REQ-002: Soft delete with optional deletion reason.
   * Device can be restored within 7 days using restore endpoint.
   */
  /**public softDelete = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.softDeleteUseCase.execute({
        id: req.params.id,
        requestDTO: req.body || {}
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

  /**
   * POST /api/network-devices/:id/restore
   * Restores a soft-deleted device within the 7-day grace period.
   *
   * REQ-002: Restore from soft delete.
   * Validates no IP/MAC conflicts with active devices.
   */
  /**public restore = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.restoreUseCase.execute({
        id: req.params.id,
        requestDTO: req.body || {}
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

  // ===================================
  // ERROR HANDLING
  // ===================================

  /**
   * //Todo: use http-errors package?
   * Maps error messages to HTTP status codes.
   *
   * REQ-002: Enhanced with lifecycle-specific error codes:
   * - 410 Gone: Grace period expired
   * - 422 Unprocessable: Invalid state transition
   */
  private getErrorStatusCode(errorMessage: string): number {
    // 404 Not Found
    if (errorMessage.includes('not found')) {
      return 404;
    }

    // 409 Conflict - Duplicate resources, restore conflicts
    if (
      errorMessage.includes('already exists') ||
      errorMessage.includes('duplicate') ||
      errorMessage.includes('is now in use') ||
      errorMessage.includes('Cannot restore')
    ) {
      return 409;
    }

    // REQ-002: 410 Gone - Grace period expired
    if (
      errorMessage.includes('grace period has expired') ||
      errorMessage.includes('days ago')
    ) {
      return 410;
    }

    // REQ-002: 422 Unprocessable Entity - Invalid state transitions
    if (
      errorMessage.includes('is already ACTIVE') ||
      errorMessage.includes('is not soft-deleted') ||
      errorMessage.includes('Cannot update soft-deleted') ||
      errorMessage.includes('Cannot activate soft-deleted') ||
      errorMessage.includes('is already soft-deleted')
    ) {
      return 422;
    }

    // 400 Bad Request - Validation errors
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('validation') ||
      errorMessage.includes('At least one') ||
      errorMessage.includes('is required') ||
      errorMessage.includes('cannot be empty') ||
      errorMessage.includes('must not exceed')
    ) {
      return 400;
    }

    // 500 Internal Server Error - Default fallback
    return 500;
  }

  /**
   * Handles unexpected errors.
   */
  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in NetworkDeviceController',
      error as Error,
      {
        error: errorMessage
      }
    );

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
