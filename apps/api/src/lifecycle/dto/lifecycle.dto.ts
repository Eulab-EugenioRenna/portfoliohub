import { IsIn, IsString, Length } from 'class-validator';

export class PrivacyRequestDto {
  @IsIn(['access', 'portability', 'rectification', 'restriction'])
  kind!: 'access' | 'portability' | 'rectification' | 'restriction';
}

export class AppealDto {
  @IsString() @Length(20, 5000) text!: string;
}

export class AccountDeletionDto {
  @IsString() @Length(12, 200) password!: string;
}
