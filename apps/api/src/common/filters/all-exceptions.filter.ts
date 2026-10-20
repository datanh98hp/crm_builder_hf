import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode } from '../errors/error-codes.js';
import { getRequestId } from '../logging/request-id.middleware.js';

interface ErrorResult {
  status: number;
  code: string;
  message: string;
  details: unknown[];
}

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: ErrorCode.BadRequest,
  401: ErrorCode.Unauthenticated,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  422: ErrorCode.ValidationFailed,
  429: ErrorCode.RateLimited,
};

const GENERIC_MESSAGE = 'Đã xảy ra lỗi hệ thống';

function fromHttpException(exception: HttpException): ErrorResult {
  const status = exception.getStatus();
  const fallbackCode = CODE_BY_STATUS[status] ?? ErrorCode.Http;
  const body = exception.getResponse();
  if (typeof body === 'string') return { status, code: fallbackCode, message: body, details: [] };

  const { message, code } = body as { message?: string | string[]; code?: string };
  if (Array.isArray(message)) {
    // class-validator output: one entry per violated constraint.
    return {
      status,
      code: status === 400 ? ErrorCode.ValidationFailed : (code ?? fallbackCode),
      message: 'Dữ liệu không hợp lệ',
      details: message,
    };
  }
  return { status, code: code ?? fallbackCode, message: message ?? GENERIC_MESSAGE, details: [] };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const requestId = getRequestId(ctx.getRequest<Request>());

    let result: ErrorResult;
    if (exception instanceof HttpException) {
      result = fromHttpException(exception);
    } else {
      // Never leak internals to clients; log server-side only.
      this.logger.error(`requestId=${requestId} ${(exception as Error)?.stack ?? String(exception)}`);
      result = { status: HttpStatus.INTERNAL_SERVER_ERROR, code: ErrorCode.Internal, message: GENERIC_MESSAGE, details: [] };
    }

    const { status, code, message, details } = result;
    ctx.getResponse<Response>().status(status).json({ error: { code, message, details }, meta: { requestId } });
  }
}
