import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '../entities/admin-user.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { LoginDto } from './dto/login.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailService } from '../common/services/email.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AdminUserPublic {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: Date | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUsers: Repository<AdminUser>,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    ip: string,
    userAgent?: string,
  ): Promise<{ tokens: TokenPair; user: AdminUserPublic }> {
    const user = await this.adminUsers.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    // Generic error to prevent email enumeration
    const invalidCredsError = new UnauthorizedException(
      'Invalid email or password.',
    );

    if (!user) throw invalidCredsError;

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated. Contact support.');
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new ForbiddenException(
        `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      await this.handleFailedLogin(user);
      throw invalidCredsError;
    }

    // Reset failed attempts on successful login
    const tokens = await this.generateTokens(user);
    await this.adminUsers.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ip,
      refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
    });

    await this.audit({
      adminUserId: user.id,
      adminEmail: user.email,
      adminRole: user.role,
      action: 'auth.login',
      ipAddress: ip,
      userAgent,
    });

    return { tokens, user: this.toPublic(user) };
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async refresh(
    user: AdminUser & { rawRefreshToken: string },
    ip: string,
  ): Promise<TokenPair> {
    // Verify the stored hash matches the incoming token
    const tokenValid = await bcrypt.compare(
      user.rawRefreshToken,
      user.refreshTokenHash!,
    );

    if (!tokenValid) {
      // Possible token reuse attack — clear the refresh token
      await this.adminUsers.update(user.id, { refreshTokenHash: null });
      await this.audit({
        adminUserId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'auth.refresh_token_reuse_detected',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Invalid refresh token. Please log in again.');
    }

    const tokens = await this.generateTokens(user);
    await this.adminUsers.update(user.id, {
      refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
    });

    return tokens;
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(userId: string, ip: string): Promise<void> {
    const user = await this.adminUsers.findOne({ where: { id: userId } });
    await this.adminUsers.update(userId, { refreshTokenHash: null });
    if (user) {
      await this.audit({
        adminUserId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'auth.logout',
        ipAddress: ip,
      });
    }
  }

  // ── Logout all devices ────────────────────────────────────────────────────

  async logoutAll(userId: string, ip: string): Promise<void> {
    const user = await this.adminUsers.findOne({ where: { id: userId } });
    await this.adminUsers.update(userId, { refreshTokenHash: null });
    if (user) {
      await this.audit({
        adminUserId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'auth.logout_all_devices',
        ipAddress: ip,
      });
    }
  }

  // ── Update email (re-auth + rotate sessions) ─────────────────────────────

  async updateEmail(
    userId: string,
    dto: UpdateEmailDto,
    ip: string,
    userAgent?: string,
  ): Promise<{ user: AdminUserPublic; tokens: TokenPair | null }> {
    const user = await this.adminUsers.findOne({
      where: { id: userId, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found or deactivated.');
    }

    const passwordOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const newEmail = dto.newEmail.trim().toLowerCase();
    if (newEmail === user.email) {
      return { user: this.toPublic(user), tokens: null };
    }

    const taken = await this.adminUsers.findOne({ where: { email: newEmail } });
    if (taken) {
      throw new ConflictException('An account with this email already exists.');
    }

    const oldEmail = user.email;
    const unfamiliarIp =
      Boolean(user.lastLoginIp) && user.lastLoginIp !== ip && ip !== 'unknown';

    await this.adminUsers.update(userId, { email: newEmail });

    const updated = await this.adminUsers.findOne({ where: { id: userId } });
    if (!updated) {
      throw new UnauthorizedException('User not found or deactivated.');
    }

    const tokens = await this.generateTokens(updated);
    await this.adminUsers.update(userId, {
      refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
    });

    await this.audit({
      adminUserId: userId,
      adminEmail: newEmail,
      adminRole: updated.role,
      action: 'auth.email_changed',
      resource: 'admin_user',
      resourceId: userId,
      metadata: {
        previousEmail: oldEmail,
        newEmail,
        ip,
        unfamiliarIp,
      },
      ipAddress: ip,
      userAgent,
    });

    void this.emailService
      .sendAdminEmailChangeAlertToOldAddress(oldEmail, newEmail, ip)
      .catch((err) => this.logger.error('Admin email-change alert (old) failed', err));
    void this.emailService
      .sendAdminEmailChangeConfirmationToNewAddress(newEmail, ip)
      .catch((err) => this.logger.error('Admin email-change confirmation failed', err));
    if (unfamiliarIp) {
      void this.emailService
        .sendAdminSuspiciousActivityAlert({
          adminEmail: newEmail,
          action: 'email_change',
          ip,
          lastKnownIp: user.lastLoginIp,
        })
        .catch((err) => this.logger.error('Suspicious activity alert failed', err));
    }

    return { user: this.toPublic(updated), tokens };
  }

  // ── Change password (invalidate all refresh tokens) ───────────────────────

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('New password and confirmation do not match.');
    }

    const user = await this.adminUsers.findOne({
      where: { id: userId, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found or deactivated.');
    }

    const passwordOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const reused = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (reused) {
      throw new BadRequestException(
        'New password must be different from your current password.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const unfamiliarIp =
      Boolean(user.lastLoginIp) && user.lastLoginIp !== ip && ip !== 'unknown';

    await this.adminUsers.update(userId, {
      passwordHash,
      refreshTokenHash: null,
    });

    await this.audit({
      adminUserId: userId,
      adminEmail: user.email,
      adminRole: user.role,
      action: 'auth.password_changed',
      resource: 'admin_user',
      resourceId: userId,
      metadata: { ip, unfamiliarIp },
      ipAddress: ip,
      userAgent,
    });

    void this.emailService
      .sendAdminPasswordChangedNotice(user.email, ip)
      .catch((err) => this.logger.error('Password-changed email failed', err));

    if (unfamiliarIp) {
      void this.emailService
        .sendAdminSuspiciousActivityAlert({
          adminEmail: user.email,
          action: 'password_change',
          ip,
          lastKnownIp: user.lastLoginIp,
        })
        .catch((err) => this.logger.error('Suspicious activity alert failed', err));
    }
  }

  // ── Get current user ──────────────────────────────────────────────────────

  toPublic(user: AdminUser): AdminUserPublic {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async generateTokens(user: AdminUser): Promise<TokenPair> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        // expiresIn accepts ms-compatible strings at runtime; cast is safe.
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m') as any,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async handleFailedLogin(user: AdminUser): Promise<void> {
    const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
    const update: Partial<AdminUser> = { failedLoginAttempts: newAttempts };

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      update.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      this.logger.warn(
        `Account locked for ${user.email} after ${newAttempts} failed attempts.`,
      );
    }

    await this.adminUsers.update(user.id, update);
  }

  private async audit(data: {
    adminUserId: string;
    adminEmail: string;
    adminRole: string;
    action: string;
    resource?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.auditLogs.save(this.auditLogs.create(data));
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }
}
