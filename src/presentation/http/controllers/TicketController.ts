import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  CreateTicketUseCase,
  GetTicketUseCase,
  ListTicketsUseCase,
  GetTechnicianDayUseCase,
  UpdateTicketUseCase,
  AssignTicketUseCase,
  ScheduleTicketUseCase,
  StartTicketUseCase,
  ResolveTicketUseCase,
  CancelTicketUseCase,
  DeleteTicketUseCase
} from 'application/tickets/use-cases';

export class TicketController {
  constructor(
    private readonly createUseCase: CreateTicketUseCase,
    private readonly getUseCase: GetTicketUseCase,
    private readonly listUseCase: ListTicketsUseCase,
    private readonly technicianDayUseCase: GetTechnicianDayUseCase,
    private readonly updateUseCase: UpdateTicketUseCase,
    private readonly assignUseCase: AssignTicketUseCase,
    private readonly scheduleUseCase: ScheduleTicketUseCase,
    private readonly startUseCase: StartTicketUseCase,
    private readonly resolveUseCase: ResolveTicketUseCase,
    private readonly cancelUseCase: CancelTicketUseCase,
    private readonly deleteUseCase: DeleteTicketUseCase,
    private readonly logger: ILogger
  ) {}

  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.createUseCase.execute({
        ...req.body,
        // Authorship comes from the token, never from the payload.
        createdBy: req.user?.userId ?? null
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
      const result = await this.listUseCase.execute({
        status: req.query.status as string | undefined,
        priority: req.query.priority as string | undefined,
        category: req.query.category as string | undefined,
        technicianId: req.query.technicianId as string | undefined,
        customerId: req.query.customerId as string | undefined,
        deviceId: req.query.deviceId as string | undefined,
        scheduledFrom: req.query.scheduledFrom as string | undefined,
        scheduledTo: req.query.scheduledTo as string | undefined,
        unassignedOnly: this.toBoolean(req.query.unassignedOnly),
        openOnly: this.toBoolean(req.query.openOnly),
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset
          ? Number(req.query.offset)
          : undefined
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

  /** The technician's day sheet — today's tasks, ready to work. */
  public myDay = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.technicianDayUseCase.execute({
        technicianId: req.query.technicianId as string,
        date: req.query.date as string | undefined
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
      const result = await this.updateUseCase.execute({
        id: req.params.id,
        ...req.body
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

  public assign = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.assignUseCase.execute({
        id: req.params.id,
        technicianId: req.body.technicianId,
        scheduledFor: req.body.scheduledFor
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

  public schedule = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.scheduleUseCase.execute({
        id: req.params.id,
        scheduledFor: req.body.scheduledFor
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

  public start = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.startUseCase.execute({
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

  public resolve = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.resolveUseCase.execute({
        id: req.params.id,
        resolutionNotes: req.body.resolutionNotes
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

  public cancel = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.cancelUseCase.execute({
        id: req.params.id,
        reason: req.body.reason
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

  // validateRequest checks the query but does not write its coercions back, so
  // every query value still arrives as a string.
  private toBoolean(value: unknown): boolean | undefined {
    if (value === undefined) return undefined;
    return value === 'true' || value === true;
  }

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
      errorMessage.includes('Cannot modify') ||
      errorMessage.includes('Cannot cancel') ||
      errorMessage.includes('Cannot reassign') ||
      errorMessage.includes('Cannot resolve') ||
      errorMessage.includes('Cannot start') ||
      errorMessage.includes('Cannot assign') ||
      errorMessage.includes('already in progress') ||
      errorMessage.includes('already cancelled') ||
      errorMessage.includes('Only an assigned ticket')
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
      'Unexpected error in TicketController',
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
