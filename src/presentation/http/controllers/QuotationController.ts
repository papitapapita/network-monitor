import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  CreateQuotationUseCase,
  UpdateQuotationLineItemsUseCase,
  UpdateQuotationDetailsUseCase,
  SendQuotationUseCase,
  AcceptQuotationUseCase,
  RejectQuotationUseCase,
  MarkQuotationExpiredUseCase,
  GetQuotationUseCase,
  ListQuotationsUseCase,
  GetQuotationPdfUseCase
} from 'application/quoting/use-cases';

export class QuotationController {
  constructor(
    private readonly createUseCase: CreateQuotationUseCase,
    private readonly updateLineItemsUseCase: UpdateQuotationLineItemsUseCase,
    private readonly updateDetailsUseCase: UpdateQuotationDetailsUseCase,
    private readonly sendUseCase: SendQuotationUseCase,
    private readonly acceptUseCase: AcceptQuotationUseCase,
    private readonly rejectUseCase: RejectQuotationUseCase,
    private readonly markExpiredUseCase: MarkQuotationExpiredUseCase,
    private readonly getUseCase: GetQuotationUseCase,
    private readonly listUseCase: ListQuotationsUseCase,
    private readonly getPdfUseCase: GetQuotationPdfUseCase,
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
        createdBy: req.user?.userId
      });

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

  public list = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.listUseCase.execute({
        customerId: req.query.customerId
          ? String(req.query.customerId)
          : undefined,
        status: req.query.status
          ? String(req.query.status)
          : undefined,
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

  public getPdf = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getPdfUseCase.execute({
        id: req.params.id
      });
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ success: false, error: result.error });
        return;
      }
      res
        .status(200)
        .setHeader('Content-Type', 'application/pdf')
        .setHeader(
          'Content-Disposition',
          `attachment; filename="${result.value.fileName}"`
        )
        .send(result.value.content);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public updateLineItems = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.updateLineItemsUseCase.execute({
        id: req.params.id,
        lineItems: req.body.lineItems
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

  public updateDetails = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.updateDetailsUseCase.execute({
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

  public send = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.sendUseCase.execute({
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

  public accept = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.acceptUseCase.execute({
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

  public reject = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.rejectUseCase.execute({
        id: req.params.id,
        reason: req.body.reason
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

  public markExpired = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.markExpiredUseCase.execute({
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

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('not found')) {
      return 404;
    }
    if (
      errorMessage.includes('already exists') ||
      errorMessage.includes('Cannot') ||
      errorMessage.includes('required to')
    ) {
      return 409;
    }
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('is not a valid') ||
      errorMessage.includes('cannot exceed') ||
      errorMessage.includes('cannot be empty')
    ) {
      return 400;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    this.logger.error(
      'Unexpected error in QuotationController',
      error as Error,
      { error: errorMessage }
    );
    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
