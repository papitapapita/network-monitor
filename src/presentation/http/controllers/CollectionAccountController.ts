import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  CreateCollectionAccountUseCase,
  ListCollectionAccountsUseCase,
  GetCollectionAccountUseCase,
  GetCollectionAccountPdfUseCase,
  MarkCollectionAccountPaidUseCase,
  CancelCollectionAccountUseCase
} from 'application/billing/use-cases';

export class CollectionAccountController {
  constructor(
    private readonly createUseCase: CreateCollectionAccountUseCase,
    private readonly listUseCase: ListCollectionAccountsUseCase,
    private readonly getUseCase: GetCollectionAccountUseCase,
    private readonly getPdfUseCase: GetCollectionAccountPdfUseCase,
    private readonly markPaidUseCase: MarkCollectionAccountPaidUseCase,
    private readonly cancelUseCase: CancelCollectionAccountUseCase,
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
    if (errorMessage.includes('Cannot')) {
      return 409;
    }
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('is not a valid') ||
      errorMessage.includes('cannot exceed') ||
      errorMessage.includes('cannot be') ||
      errorMessage.includes('must be')
    ) {
      return 400;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    this.logger.error(
      'Unexpected error in CollectionAccountController',
      error as Error,
      { error: errorMessage }
    );
    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
