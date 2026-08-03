import type { StaffRole } from './entities/staff-user.entity';

export interface StaffPrincipal {
  staffUserId: string;
  sessionId: string;
  email: string;
  displayName: string;
  role: StaffRole;
}
