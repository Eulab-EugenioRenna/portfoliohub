import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateClientDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;
}

export class CreateProjectDto {
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @IsOptional() @IsUUID('4') clientId?: string;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) name?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID('4')
  clientId?: string | null;
}
