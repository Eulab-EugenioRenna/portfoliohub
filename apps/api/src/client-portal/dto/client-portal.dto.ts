import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class ClientEmailDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{40,200}$/) linkToken?: string;
}

export class ClientTokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{40,200}$/) token!: string;
}

export class MergeClientLinksDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) linkTokens!: string[];
}
