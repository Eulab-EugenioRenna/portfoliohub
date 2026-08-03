import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean() productEmail?: boolean;
  @IsOptional() @IsBoolean() massEmail?: boolean;
  @IsOptional() @IsBoolean() inAppBanner?: boolean;
  @IsOptional() @IsBoolean() ticketUpdates?: boolean;
  @IsOptional() @IsBoolean() deliveryActivity?: boolean;
  @IsOptional() @IsBoolean() workspaceActivity?: boolean;
}

export class SendWorkspaceEmailDto {
  @IsIn(['product', 'mass']) category!: 'product' | 'mass';
  @IsString() @Length(1, 180) subject!: string;
  @IsString() @Length(1, 5000) message!: string;
  @IsOptional() @IsUrl({ require_tld: false }) actionUrl?: string;
}
