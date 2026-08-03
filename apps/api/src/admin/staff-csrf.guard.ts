import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { StaffRequest } from './staff-session.guard';

@Injectable()
export class StaffCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const cookie = request.cookies?.['ph_staff_csrf'];
    const header = request.header('x-staff-csrf-token');
    if (!cookie || !header || cookie !== header)
      throw new ForbiddenException('Token CSRF staff non valido');
    return true;
  }
}
