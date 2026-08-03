import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { CurrentUser } from './current-user.decorator';
import {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  ResetPasswordDto,
  SignUpDto,
  TokenDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import type { AuthenticatedPrincipal, SessionIssue } from './identity.types';
import { SessionGuard } from './session.guard';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.secureCookies = config.get<boolean>('app.secureCookies') ?? false;
  }

  @Post('signup')
  @HttpCode(HttpStatus.ACCEPTED)
  signUp(@Body() dto: SignUpDto): Promise<{ userId: string; workspaceId: string }> {
    return this.auth.signUp(dto);
  }

  @Post('verify-email')
  async verifyEmail(
    @Body() dto: TokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatedPrincipal> {
    const issue = await this.auth.verifyEmail(dto, this.requestMetadata(request));
    this.setSessionCookies(response, issue);
    return issue.principal;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatedPrincipal> {
    const issue = await this.auth.login(dto, this.requestMetadata(request));
    this.setSessionCookies(response, issue);
    return issue.principal;
  }

  @Post('magic-link')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestMagicLink(@Body() dto: EmailDto): Promise<{ accepted: true }> {
    await this.auth.requestMagicLink(dto);
    return { accepted: true };
  }

  @Post('magic-link/consume')
  async consumeMagicLink(
    @Body() dto: TokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatedPrincipal> {
    const issue = await this.auth.consumeMagicLink(dto, this.requestMetadata(request));
    this.setSessionCookies(response, issue);
    return issue.principal;
  }

  @Post('password-reset')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestPasswordReset(@Body() dto: EmailDto): Promise<{ accepted: true }> {
    await this.auth.requestPasswordReset(dto);
    return { accepted: true };
  }

  @Post('password-reset/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() principal: AuthenticatedPrincipal): AuthenticatedPrincipal {
    return principal;
  }

  @Patch('me')
  @UseGuards(SessionGuard, CsrfGuard)
  updateProfile(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthenticatedPrincipal> {
    return this.auth.updateProfile(principal, dto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, CsrfGuard)
  changePassword(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.auth.changePassword(principal, dto);
  }

  @Get('sessions')
  @UseGuards(SessionGuard)
  sessions(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.auth.listSessions(principal.userId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, CsrfGuard)
  revokeSession(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    return this.auth.revokeSession(principal.userId, sessionId);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, CsrfGuard)
  revokeOtherSessions(@CurrentUser() principal: AuthenticatedPrincipal): Promise<void> {
    return this.auth.revokeOtherSessions(principal.userId, principal.sessionId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(principal);
    response.clearCookie('ph_session');
    response.clearCookie('ph_csrf');
  }

  private requestMetadata(request: Request): { userAgent?: string; ip?: string } {
    return { userAgent: request.header('user-agent'), ip: request.ip };
  }

  private setSessionCookies(response: Response, issue: SessionIssue): void {
    const maxAge = issue.expiresAt.getTime() - Date.now();
    response.cookie('ph_session', issue.token, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    response.cookie('ph_csrf', issue.csrfToken, {
      httpOnly: false,
      secure: this.secureCookies,
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
  }
}
