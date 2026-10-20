import { jest } from '@jest/globals';
import { ArgumentsHost, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

interface ErrBody {
  error: { code: string; message: string; details: unknown[] };
  meta: { requestId: string };
}

function run(exception: unknown): { status: number; body: ErrBody } {
  const json = jest.fn<(b: ErrBody) => void>();
  const status = jest.fn<(c: number) => { json: typeof json }>().mockReturnValue({ json });
  const res = { status };
  const host = {
    switchToHttp: () => ({ getRequest: () => ({ requestId: 'req-test-1' }), getResponse: () => res }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('AllExceptionsFilter', () => {
  it('maps forbidden to the documented error shape with requestId', () => {
    const { status, body } = run(new ForbiddenException({ code: 'RESOURCE_FORBIDDEN', message: 'no' }));
    expect(status).toBe(403);
    expect(body).toEqual({ error: { code: 'RESOURCE_FORBIDDEN', message: 'no', details: [] }, meta: { requestId: 'req-test-1' } });
  });
  it('maps validation arrays to VALIDATION_FAILED details', () => {
    const { body } = run(new BadRequestException(['email must be an email']));
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details).toEqual(['email must be an email']);
  });
  it('hides internals for unexpected errors', () => {
    const { status, body } = run(new Error('db password=secret at /srv/app.ts'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/secret|\.ts/);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
