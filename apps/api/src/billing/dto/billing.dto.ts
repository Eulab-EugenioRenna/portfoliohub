import { IsBoolean, IsIn } from 'class-validator';

export class CheckoutDto {
  @IsIn(['pro', 'unlimited']) plan!: 'pro' | 'unlimited';
  @IsBoolean() annual!: boolean;
}
