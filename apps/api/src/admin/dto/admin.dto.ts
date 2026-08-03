import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class StaffLoginDto {
  @IsEmail() email!: string;
  @IsString() @Length(12, 200) password!: string;
}

export class ReasonDto {
  @IsString() @Length(20, 1000) reason!: string;
}

export class LegalHoldDto extends ReasonDto {
  @IsOptional() @IsString() @Length(3, 200) authorityReference?: string;
}

export class SupportSessionDto extends ReasonDto {
  @IsUUID() workspaceId!: string;
  @IsIn(['read_only', 'break_glass']) mode!: 'read_only' | 'break_glass';
  @IsOptional() @IsUUID() actionRequestId?: string;
}

export class SupportConsentDto extends ReasonDto {}

export class CreateAccountDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) @MaxLength(120) displayName!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @IsString() @MinLength(2) @MaxLength(120) workspaceName!: string;
  @IsIn(['freelance', 'studio']) workspaceType!: 'freelance' | 'studio';
}

export class ManualAccountActionDto extends ReasonDto {}

export class ManualPlanDto extends ReasonDto {
  @IsIn(['free', 'pro', 'unlimited']) plan!: 'free' | 'pro' | 'unlimited';
}
