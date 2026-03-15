import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Global error handler middleware.
 * Must be registered LAST in the middleware chain.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  // Default values
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Une erreur interne est survenue';
  let details: Array<{ field: string; message: string }> | undefined;

  // Handle our custom AppError hierarchy
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;

    if (err instanceof ValidationError) {
      details = err.details;
    }
  }

  // Handle Prisma errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        statusCode = 409;
        code = 'DUPLICATE';
        const target = (err.meta?.target as string[])?.join(', ') || 'champ';
        message = `Cette valeur existe déjà (${target})`;
        break;
      }
      case 'P2025':
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Ressource introuvable';
        break;
      case 'P2003':
        statusCode = 400;
        code = 'FOREIGN_KEY';
        message = 'Référence invalide vers une ressource liée';
        break;
      default:
        statusCode = 400;
        code = 'DATABASE_ERROR';
        message = 'Erreur de base de données';
    }
  }

  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Données invalides';
  }

  // Log the error
  const logPayload = {
    statusCode,
    code,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    tenantId: req.tenantId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };

  if (statusCode >= 500) {
    logger.error(err.message, { ...logPayload, stack: err.stack });
  } else if (statusCode >= 400) {
    logger.warn(err.message, logPayload);
  }

  // Send response — NEVER expose stack trace in production
  const response: Record<string, unknown> = {
    success: false,
    error: message,
    code,
  };

  if (details) {
    response.details = details;
  }

  if (config.isDev) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * 404 handler for unknown routes.
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} introuvable`,
    code: 'NOT_FOUND',
  });
}
