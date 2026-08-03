import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedPrincipal } from './identity.types';

export interface AuthenticatedRequest extends Request {
  auth?: AuthenticatedPrincipal;
  cookies: Record<string, string | undefined>;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.['ph_session'];
    if (!token) throw new UnauthorizedException('Sessione richiesta');
    request.auth = await this.auth.authenticate(token);
    return true;
  }
}
