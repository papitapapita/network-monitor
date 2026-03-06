import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';

/**
 * Express middleware for validating requests using Zod schemas.
 *
 * Validates:
 * - req.body
 * - req.params
 * - req.query
 *
 * If validation fails, returns 400 Bad Request with detailed error messages.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * router.post(
 *   '/devices',
 *   validateRequest(createNetworkDeviceSchema),
 *   controller.create
 * );
 */
export const validateRequest = (schema: ZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request against schema
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });

      // Validation passed, continue to next middleware/controller
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formattedErrors
        });
      }

      // Unexpected error
      return res.status(500).json({
        success: false,
        error: 'Internal server error during validation'
      });
    }
  };
};
