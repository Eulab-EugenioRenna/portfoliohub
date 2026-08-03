import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { WorkspaceType } from '../entities/workspace.entity';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsIn(['freelance', 'studio'])
  type!: WorkspaceType;
}

export class TransferOwnershipDto {
  @IsUUID('4')
  newOwnerUserId!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class UpdateWorkspaceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
