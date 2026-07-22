import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  GenerateBillUseCase,
  GenerateBillsForPeriodUseCase,
  ListBillsUseCase,
  GetBillUseCase,
  GetBillPdfUseCase,
  MarkBillPaidUseCase,
  MarkBillOverdueUseCase,
  CancelBillUseCase
} from 'application/billing/use-cases';

export class BillController {
  constructor(
    private readonly generateUseCase: GenerateBillUseCase,
    private readonly generateBulkUseCase: GenerateBillsForPeriodUseCase,
    private readonly listUseCase: ListBillsUseCase,
    private readonly getUseCase: GetBillUseCase,
    private readonly getPdfUseCase: GetBillPdfUseCase,
    private readonly markPaidUseCase: MarkBillPaidUseCase,
    private readonly markOverdueUseCase: MarkBillOverdueUseCase,
    private readonly cancelUseCase: CancelBillUseCase,
    private readonly logger: ILogger
  ) {}

  public generate = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.generateUseCase.execute(req.body);
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

  public generateBulk = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.generateBulkUseCase.execute(req.body);
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
        year: req.query.year ? Number(req.query.year) : undefined,
        month: req.query.month ? Number(req.query.month) : undefined,
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

  public markPaid = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.markPaidUseCase.execute({
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

  public markOverdue = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.markOverdueUseCase.execute({
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

  public cancel = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.cancelUseCase.execute({
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
      errorMessage.includes('no active contracted services') ||
      errorMessage.includes('not past its due date')
    ) {
      return 409;
    }
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('is not a valid')
    ) {
      return 400;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    this.logger.error(
      'Unexpected error in BillController',
      error as Error,
      { error: errorMessage }
    );
    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
