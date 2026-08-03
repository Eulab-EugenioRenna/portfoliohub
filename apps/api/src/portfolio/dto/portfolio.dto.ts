import { IsObject, IsString, Matches } from 'class-validator';

export class UpdatePortfolioDto {
  @IsString() @Matches(/^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$/) slug!: string;
  @IsObject() document!: Record<string, unknown>;
}
