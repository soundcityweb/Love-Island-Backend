import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from '../../entities/admin-user.entity';

export interface JwtRefreshPayload {
  sub: string;
  email: string;
  role: string;
  type: 'refresh';
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService,
    @InjectRepository(AdminUser)
    private readonly adminUsers: Repository<AdminUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => req?.cookies?.['li_admin_refresh'] ?? null,
        ExtractJwt.fromBodyField('refreshToken'),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    payload: JwtRefreshPayload,
  ): Promise<AdminUser & { rawRefreshToken: string }> {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type.');
    }

    const rawRefreshToken =
      req.cookies?.['li_admin_refresh'] ??
      (req.body as { refreshToken?: string })?.refreshToken;

    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token not provided.');
    }

    const user = await this.adminUsers.findOne({
      where: { id: payload.sub, isActive: true },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    return { ...user, rawRefreshToken };
  }
}
