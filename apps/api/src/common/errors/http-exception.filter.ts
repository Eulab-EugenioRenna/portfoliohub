import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CORRELATION_HEADER } from '../correlation/correlation.middleware';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const correlationId = request.header(CORRELATION_HEADER);
    const exceptionBody = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      typeof exceptionBody === 'string'
        ? exceptionBody
        : typeof exceptionBody === 'object' && exceptionBody && 'message' in exceptionBody
          ? exceptionBody.message
          : status === HttpStatus.INTERNAL_SERVER_ERROR
            ? 'Errore interno del servizio'
            : 'Richiesta non valida';

    if (status >= 500) {
      this.logger.error({
        message: 'Unhandled request error',
        correlationId,
        method: request.method,
        path: request.url,
        error: exception instanceof Error ? exception.stack : String(exception),
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(typeof exceptionBody === 'object' &&
      exceptionBody &&
      'code' in exceptionBody &&
      exceptionBody.code === 'SESSION_LIMIT_REACHED'
        ? {
            code: exceptionBody.code,
            ...('limit' in exceptionBody ? { limit: exceptionBody.limit } : {}),
            ...('sessions' in exceptionBody ? { sessions: exceptionBody.sessions } : {}),
          }
        : {}),
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
