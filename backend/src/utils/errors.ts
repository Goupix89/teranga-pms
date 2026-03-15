export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string = 'ERROR', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Ressource') {
    super(`${resource} introuvable`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Non authentifié') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Accès non autorisé') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflit de données') {
    super(message, 409, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  public readonly details: Array<{ field: string; message: string }>;

  constructor(message: string, details: Array<{ field: string; message: string }> = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('Trop de requêtes. Réessayez plus tard.', 429, 'RATE_LIMIT');
  }
}
