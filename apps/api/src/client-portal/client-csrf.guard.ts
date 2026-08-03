import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { ClientRequest } from './client-session.guard';

@Injectable()
export class ClientCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ClientRequest>();
    const cookie = request.cookies?.['ph_client_csrf'];
    const header = request.header('x-client-csrf-token');
    if (!cookie || !header || cookie !== header)
      throw new ForbiddenException('Token CSRF cliente non valido');
    return true;
  }
}
