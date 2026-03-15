import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Generic Zod validation middleware.
 * Validates request body against a Zod schema.
 * Replaces req.body with parsed (cleaned) data.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return next(new ValidationError('Données invalides', details));
    }

    // Replace body with parsed/cleaned data (strips unknown fields)
    req.body = result.data;
    next();
  };
}

/**
 * Validate query parameters.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return next(new ValidationError('Paramètres de requête invalides', details));
    }

    req.query = result.data;
    next();
  };
}

/**
 * Validate route parameters.
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return next(new ValidationError('Paramètres de route invalides', details));
    }

    next();
  };
}
