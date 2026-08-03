import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ClientRequest } from './client-session.guard';

export const CurrentClient = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<ClientRequest>();
    if (!request.clientIdentityId) throw new Error('CurrentClient requires ClientSessionGuard');
    return request.clientIdentityId;
  },
);
