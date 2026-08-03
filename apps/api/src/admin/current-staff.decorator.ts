import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { StaffPrincipal } from './admin.types';
import type { StaffRequest } from './staff-session.guard';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): StaffPrincipal => {
    const staff = context.switchToHttp().getRequest<StaffRequest>().staff;
    if (!staff) throw new Error('CurrentStaff richiede StaffSessionGuard');
    return staff;
  },
);
