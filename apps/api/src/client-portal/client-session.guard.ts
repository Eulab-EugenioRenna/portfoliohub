import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ClientPortalService } from './client-portal.service';

export interface ClientRequest extends Request {
  clientIdentityId?: string;
  cookies: Record<string, string | undefined>;
}

@Injectable()
export class ClientSessionGuard implements CanActivate {
  constructor(private readonly portal: ClientPortalService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ClientRequest>();
    const token = request.cookies?.['ph_client_session'];
    if (!token) throw new UnauthorizedException('Accesso cliente richiesto');
    request.clientIdentityId = await this.portal.authenticateClient(token);
    return true;
  }
}
