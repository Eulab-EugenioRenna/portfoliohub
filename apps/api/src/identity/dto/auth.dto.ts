import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { WorkspaceType } from '../../workspaces/entities/workspace.entity';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SignUpDto {
  @IsEmail()
  @Transform(normalizeEmail)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  workspaceName!: string;

  @IsIn(['freelance', 'studio'])
  workspaceType!: WorkspaceType;
}

export class LoginDto {
  @IsEmail()
  @Transform(normalizeEmail)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsUUID()
  revokeSessionId?: string;
}

export class EmailDto {
  @IsEmail()
  @Transform(normalizeEmail)
  email!: string;
}

export class TokenDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{40,200}$/)
  token!: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
