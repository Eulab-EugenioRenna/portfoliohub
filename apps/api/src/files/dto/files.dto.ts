import { Type } from 'class-transformer';
import {
  IsInt,
  IsMimeType,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFolderDto {
  @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @IsOptional() @IsUUID('4') parentId?: string;
}

export class BeginUploadDto {
  @IsString() @MinLength(1) @MaxLength(255) fileName!: string;
  @IsMimeType() mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100 * 1024 * 1024 * 1024) size!: number;
  @IsOptional() @IsUUID('4') parentId?: string;
  @IsOptional() @IsUUID('4') fileNodeId?: string;
}

export class UpdateNodeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) name?: string;
  @IsOptional() @IsUUID('4') parentId?: string | null;
}

export class NodeTargetDto {
  @IsOptional() @IsUUID('4') parentId?: string;
}
