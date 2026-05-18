import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AdminUser } from '../entities/admin-user.entity';

const ACCESS_COOKIE = 'li_admin_token';
const REFRESH_COOKIE = 'li_admin_refresh';

function setTokenCookies(
  res: any,
  accessToken: string,
  refreshToken: string,
  isProduction: boolean,
): void {
  const base = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    path: '/',
  };
  res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
}

function clearTokenCookies(res: any): void {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth/refresh' });
}

function getIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

@Controller('auth')
export class AuthController {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(private readonly authService: AuthService) {}

  // ── POST /api/auth/login ──────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const { tokens, user } = await this.authService.login(
      dto,
      getIp(req),
      req.headers?.['user-agent'],
    );
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken, this.isProduction);
    return { user };
  }

  // ── POST /api/auth/refresh ────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @CurrentUser() user: AdminUser & { rawRefreshToken: string },
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const tokens = await this.authService.refresh(user, getIp(req));
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken, this.isProduction);
    return { ok: true };
  }

  // ── POST /api/auth/logout ─────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AdminUser, @Req() req: any, @Res({ passthrough: true }) res: any) {
    await this.authService.logout(user.id, getIp(req));
    clearTokenCookies(res);
    return { ok: true };
  }

  // ── POST /api/auth/logout-all ─────────────────────────────────────────────

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser() user: AdminUser,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    await this.authService.logoutAll(user.id, getIp(req));
    clearTokenCookies(res);
    return { ok: true };
  }

  // ── GET /api/auth/me ──────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AdminUser) {
    return { user: this.authService.toPublic(user) };
  }

  // ── PATCH /api/auth/update-email ───────────────────────────────────────────

  @Patch('update-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async updateEmail(
    @CurrentUser() user: AdminUser,
    @Body() dto: UpdateEmailDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.authService.updateEmail(
      user.id,
      dto,
      getIp(req),
      req.headers?.['user-agent'],
    );
    if (result.tokens) {
      setTokenCookies(
        res,
        result.tokens.accessToken,
        result.tokens.refreshToken,
        this.isProduction,
      );
    }
    return { user: result.user };
  }

  // ── PATCH /api/auth/change-password ────────────────────────────────────────

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async changePassword(
    @CurrentUser() user: AdminUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    await this.authService.changePassword(
      user.id,
      dto,
      getIp(req),
      req.headers?.['user-agent'],
    );
    clearTokenCookies(res);
    return { message: 'Password updated successfully.' };
  }
}
