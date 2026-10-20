/** Stable, machine-readable error codes returned in `error.code`. Clients may branch on these. */
export const ErrorCode = {
  BadRequest: 'BAD_REQUEST',
  ValidationFailed: 'VALIDATION_FAILED',
  Unauthenticated: 'AUTH_UNAUTHENTICATED',
  InvalidCredentials: 'AUTH_INVALID_CREDENTIALS',
  InvalidRefreshToken: 'AUTH_INVALID_REFRESH_TOKEN',
  Forbidden: 'RESOURCE_FORBIDDEN',
  NotFound: 'RESOURCE_NOT_FOUND',
  Conflict: 'CONFLICT',
  RateLimited: 'RATE_LIMITED',
  NotReady: 'NOT_READY',
  Internal: 'INTERNAL_ERROR',
  Http: 'HTTP_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
