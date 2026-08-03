import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from './session.guard';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const cookie = request.cookies?.['ph_csrf'];
    const header = request.header('x-csrf-token');
    if (!cookie || !header || cookie !== header)
      throw new ForbiddenException('Token CSRF non valido');
    return true;
  }
}
