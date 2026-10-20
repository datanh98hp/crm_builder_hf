import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { map, Observable } from 'rxjs';
import { getRequestId } from '../logging/request-id.middleware.js';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(map((data) => ({ data: data ?? null, meta: { requestId: getRequestId(req) } })));
  }
}
