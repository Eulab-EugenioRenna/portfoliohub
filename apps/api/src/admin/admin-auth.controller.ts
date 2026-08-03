import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { StaffPrincipal } from './admin.types';
import { CurrentStaff } from './current-staff.decorator';
import { StaffLoginDto } from './dto/admin.dto';
import { StaffAuthService } from './staff-auth.service';
import { StaffCsrfGuard } from './staff-csrf.guard';
import { StaffSessionGuard } from './staff-session.guard';

@Controller({ path: 'admin/auth', version: '1' })
export class AdminAuthController {
  private readonly secure: boolean;
  constructor(
    private readonly auth: StaffAuthService,
    config: ConfigService,
  ) {
    this.secure = config.get<boolean>('app.secureCookies') ?? false;
  }

  @Post('login')
  async login(
    @Body() dto: StaffLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StaffPrincipal> {
    const issue = await this.auth.login(dto, {
      ip: request.ip,
      userAgent: request.header('user-agent'),
    });
    const options = {
      secure: this.secure,
      sameSite: 'strict' as const,
      path: '/',
      maxAge: issue.expiresAt.getTime() - Date.now(),
    };
    response.cookie('ph_staff_session', issue.token, { ...options, httpOnly: true });
    response.cookie('ph_staff_csrf', issue.csrfToken, { ...options, httpOnly: false });
    return issue.principal;
  }

  @Get('me')
  @UseGuards(StaffSessionGuard)
  me(@CurrentStaff() staff: StaffPrincipal): StaffPrincipal {
    return staff;
  }

  @Post('logout')
  @UseGuards(StaffSessionGuard, StaffCsrfGuard)
  async logout(
    @CurrentStaff() staff: StaffPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    await this.auth.logout(staff.sessionId);
    response.clearCookie('ph_staff_session', { path: '/' });
    response.clearCookie('ph_staff_csrf', { path: '/' });
    return { ok: true };
  }
}
