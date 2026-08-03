import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { StaffPrincipal } from './admin.types';
import { StaffAuthService } from './staff-auth.service';

export interface StaffRequest extends Request {
  staff?: StaffPrincipal;
  cookies: Record<string, string | undefined>;
}

@Injectable()
export class StaffSessionGuard implements CanActivate {
  constructor(private readonly auth: StaffAuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const token = request.cookies?.['ph_staff_session'];
    if (!token) throw new UnauthorizedException('Sessione staff richiesta');
    request.staff = await this.auth.authenticate(token);
    return true;
  }
}
