import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { LoginUseCase } from 'application/identity/use-cases/LoginUseCase';
import { LoginInput } from '../validation/auth.schemas';

export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logger: ILogger
  ) {}

  public login = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const body = req.body as LoginInput;

      const result = await this.loginUseCase.execute({
        email: body.email,
        password: body.password
      });

      if (result.isFailure) {
        res
          .status(401)
          .json({ success: false, error: 'Invalid credentials' });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.logger.error(
        'Unexpected error in AuthController',
        error as Error
      );
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  };
}
