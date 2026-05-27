import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { ScanNetworkSegmentInput } from '../validation/scan.schemas';
import { ScanNetworkSegmentUseCase } from 'application/device-inventory/use-cases';

/**
 * ScanController
 *
 * HTTP controller for network segment scan operations within the
 * device-inventory Bounded Context.
 *
 * Responsibilities:
 * - Translate validated HTTP requests into application-layer DTO calls.
 * - Map use case Results to HTTP status codes and response bodies.
 * - Contain NO business logic — all invariants live in the use case and domain.
 *
 * Endpoints handled:
 * - POST /api/network/scan  - Probe a CIDR segment and auto-register new hosts
 *
 * Response Codes:
 * - 200 OK          - Scan completed (operation result, not a new resource)
 * - 400 Bad Request - Validation errors, invalid segment, unknown model ID
 * - 404 Not Found   - Referenced DeviceModel does not exist
 * - 500 Internal    - Unexpected errors
 */
export class ScanController {
  constructor(
    private readonly scanUseCase: ScanNetworkSegmentUseCase,
    private readonly logger: ILogger
  ) {}

  // =====================================
  // ENDPOINT HANDLERS
  // =====================================

  /**
   * POST /api/network/scan
   *
   * Initiates a network segment scan and auto-registers discovered hosts.
   * Delegates to ScanNetworkSegmentUseCase.
   *
   * Body: ScanNetworkSegmentInput (validated by Zod before reaching here)
   * Response: 200 OK with ScanNetworkSegmentResponseDTO
   * Errors:
   *   400 - Invalid input or business constraint violation
   *   404 - Referenced DeviceModel does not exist
   *   500 - Unexpected infrastructure error
   */
  public scan = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const body = req.body as ScanNetworkSegmentInput;

      const result = await this.scanUseCase.execute({
        segment: body.segment
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
      errorMessage.includes('must not exceed') ||
      errorMessage.includes('already assigned') ||
      errorMessage.includes('too large') ||
      errorMessage.includes('range')
    ) {
      return 400;
    }

    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in ScanController',
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
