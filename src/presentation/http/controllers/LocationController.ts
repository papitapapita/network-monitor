import { Request, Response } from 'express';
import { ILogger } from '../../../application/shared/interfaces';
import { CreateLocationInput, UpdateLocationInput } from '../validation';
import {
  CreateLocationUseCase,
  GetLocationUseCase,
  ListLocationsUseCase,
  UpdateLocationUseCase
} from '../../../application/device-inventory/use-cases';

/**
 * LocationController
 *
 * HTTP controller for Location CRUD operations within the device-inventory
 * Bounded Context.
 *
 * Responsibilities:
 * - Translate validated HTTP requests into application-layer DTO calls.
 * - Map use case Results to HTTP status codes and response bodies.
 * - Contain NO business logic — all invariants live in use cases and the domain.
 *
 * Endpoints handled:
 * - POST   /api/locations      - Register a new location
 * - GET    /api/locations      - List locations (paginated, optional type filter)
 * - GET    /api/locations/:id  - Get a single location by ID
 * - PATCH  /api/locations/:id  - Partially update a location
 *
 * Response Codes:
 * - 200 OK          - Successful GET
 * - 201 Created     - Successful POST
 * - 400 Bad Request - Validation errors, invalid input
 * - 404 Not Found   - Location does not exist
 * - 500 Internal    - Unexpected errors
 */
export class LocationController {
  constructor(
    private readonly createUseCase: CreateLocationUseCase,
    private readonly getUseCase: GetLocationUseCase,
    private readonly listUseCase: ListLocationsUseCase,
    private readonly updateUseCase: UpdateLocationUseCase,
    private readonly logger: ILogger
  ) {}

  // =====================================
  // ENDPOINT HANDLERS
  // =====================================

  /**
   * POST /api/locations
   *
   * Registers a new location in the device-inventory context.
   * Delegates to CreateLocationUseCase.
   *
   * Body: CreateLocationInput (validated by Zod before reaching here)
   * Response: 201 Created with LocationResponseDTO
   * Errors:
   *   400 - Validation failure (name empty, invalid type, coordinate mismatch)
   *   500 - Unexpected infrastructure error
   */
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

  /**
   * GET /api/locations
   *
   * Returns a paginated list of locations, optionally filtered by type.
   * Delegates to ListLocationsUseCase.
   *
   * Query params: limit, offset, type (all optional, validated by Zod)
   * Response: 200 OK with LocationListResponseDTO
   * Errors:
   *   400 - Invalid type filter value
   *   500 - Unexpected infrastructure error
   */
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

  /**
   * GET /api/locations/:id
   *
   * Returns a single location by its UUID.
   * Delegates to GetLocationUseCase.
   *
   * Params: id (UUID v4, validated by Zod)
   * Response: 200 OK with LocationResponseDTO
   * Errors:
   *   400 - Invalid UUID format (caught by Zod before this point)
   *   404 - Location does not exist
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
   * PATCH /api/locations/:id
   *
   * Partially updates an existing location. Only supplied fields are changed;
   * omitted fields are left as-is (PATCH semantics).
   * Delegates to UpdateLocationUseCase.
   *
   * Params: id (UUID v4, validated by Zod)
   * Body: UpdateLocationInput (all fields optional, validated by Zod)
   * Response: 200 OK with LocationResponseDTO
   * Errors:
   *   400 - Validation failure, invalid type, coordinate mismatch
   *   404 - Location does not exist
   *   500 - Unexpected infrastructure error
   */
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

  // =====================================
  // PRIVATE HELPERS
  // =====================================

  /**
   * Maps use case error messages to HTTP status codes.
   *
   * Error keywords are matched in priority order (most specific first).
   */
  private getErrorStatusCode(errorMessage: string): number {
    // 404 Not Found
    if (errorMessage.includes('not found')) {
      return 404;
    }

    // 400 Bad Request — validation and format errors
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

    // 500 Internal Server Error — default fallback
    return 500;
  }

  /**
   * Handles unexpected (uncaught) errors by logging and returning HTTP 500.
   *
   * Unexpected errors are those that bypass the Result pattern — typically
   * network timeouts, programmer errors, or infrastructure panics.
   */
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
