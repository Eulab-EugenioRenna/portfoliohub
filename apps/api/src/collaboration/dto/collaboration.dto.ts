import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';
import type { WorkspaceRole } from '../../workspaces/entities/workspace-membership.entity';

export class CreateInviteDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;
  @IsIn(['admin', 'editor', 'uploader', 'viewer', 'guest']) role!: Exclude<WorkspaceRole, 'owner'>;
  @IsOptional() @IsUUID('4') projectId?: string;
  @IsOptional() @IsUUID('4') nodeId?: string;
}
