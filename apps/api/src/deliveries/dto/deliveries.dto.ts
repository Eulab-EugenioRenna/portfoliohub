import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDeliveryDto {
  @IsUUID('4') projectId!: string;
  @IsOptional() @IsUUID('4') clientId?: string;
  @IsString() @MinLength(2) @MaxLength(180) title!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsUUID('4', { each: true }) nodeIds!: string[];
  @IsBoolean() allowDownload!: boolean;
  @IsBoolean() allowComments!: boolean;
  @IsBoolean() allowApproval!: boolean;
  @IsBoolean() oneShot!: boolean;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) password?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) maxDownloads?: number;
}

export class AccessDeliveryDto {
  @IsOptional() @IsString() @MaxLength(128) password?: string;
}

export class DeliveryCommentDto {
  @IsString() @MinLength(2) @MaxLength(120) authorName!: string;
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
  @IsOptional() @IsUUID('4') fileVersionId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(86_400_000) timecodeMs?: number;
}

export class DeliveryApprovalDto {
  @IsString() @MinLength(2) @MaxLength(120) authorName!: string;
  @IsIn(['approved', 'changes_requested']) decision!: 'approved' | 'changes_requested';
  @IsOptional() @IsString() @MaxLength(5000) note?: string;
  @IsOptional() @IsUUID('4') fileVersionId?: string;
}
