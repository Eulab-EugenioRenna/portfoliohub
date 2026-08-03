import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

export function correlationMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header(CORRELATION_HEADER)?.trim();
  const correlationId = incoming && incoming.length <= 128 ? incoming : randomUUID();
  request.headers[CORRELATION_HEADER] = correlationId;
  response.setHeader(CORRELATION_HEADER, correlationId);
  next();
}
