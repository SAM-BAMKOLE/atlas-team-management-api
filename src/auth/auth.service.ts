import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { REFRESH_TOKEN_TTL_DAYS } from './auth.constants';
import { Profile } from 'passport-google-oauth20';
import { JobsService } from '../jobs/jobs.service';

type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: Date | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly jobs: JobsService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email, name: dto.name?.trim(), passwordHash },
    });

    await this.sendVerificationEmail(user.id, user.email);
    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto) {
    const tokenHash = this.hashToken(dto.refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const next = await this.createSession(session.user);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const accessToken = await this.jwt.signAsync({
      sub: session.user.id,
      email: session.user.email,
    });
    return { accessToken, ...next };
  }

  async logout(dto: RefreshDto) {
    await this.prisma.session.updateMany({
      where: {
        refreshTokenHash: this.hashToken(dto.refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async requestPasswordReset(emailAddress: string) {
    const email = emailAddress.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.passwordHash) {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: this.hashToken(token),
          passwordResetExpiresAt: expiresAt,
        },
      });
      const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
      await this.jobs.enqueueEmail({
        kind: 'password-reset',
        to: user.email,
        resetUrl: `${appUrl}/auth/password-reset/confirm?token=${token}`,
      });
    }
    return {
      message: 'If an account exists, a password reset email has been sent',
    };
  }

  async confirmPasswordReset(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: this.hashToken(token),
        passwordResetExpiresAt: { gt: new Date() },
      },
    });
    if (!user)
      throw new UnauthorizedException(
        'Invalid or expired password reset token',
      );

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: this.hashToken(token),
        emailVerificationExpiresAt: { gt: new Date() },
      },
    });
    if (!user)
      throw new UnauthorizedException(
        'Invalid or expired email verification token',
      );
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });
    return { success: true };
  }

  async getSafeUser(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this.toSafeUser(user);
  }

  async findOrCreateGoogleUser(profile: Profile) {
    const email = profile.emails?.[0]?.value?.trim().toLowerCase();
    const verified =
      profile.emails?.[0]?.verified === true ||
      (profile._json as { email_verified?: boolean }).email_verified === true;
    if (!email || !verified) {
      throw new UnauthorizedException(
        'Google did not provide a verified email',
      );
    }

    const existingByGoogle = await this.prisma.user.findUnique({
      where: { googleSubject: profile.id },
    });
    if (existingByGoogle) return existingByGoogle;

    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (
      existingByEmail?.googleSubject &&
      existingByEmail.googleSubject !== profile.id
    ) {
      throw new ConflictException(
        'This email is linked to another Google account',
      );
    }
    if (existingByEmail) {
      return this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleSubject: profile.id,
          emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date(),
          name: existingByEmail.name ?? profile.displayName,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        email,
        name: profile.displayName,
        googleSubject: profile.id,
        emailVerifiedAt: new Date(),
      },
    });
  }

  issueTokensForUser(user: {
    id: string;
    email: string;
    name: string | null;
    emailVerifiedAt: Date | null;
  }) {
    return this.issueTokens(user);
  }

  async createOAuthCode(user: { id: string }) {
    const code = randomBytes(32).toString('hex');
    await this.prisma.oAuthCode.create({
      data: {
        codeHash: this.hashToken(code),
        userId: user.id,
        expiresAt: new Date(Date.now() + 2 * 60 * 1000),
      },
    });
    return code;
  }

  async exchangeOAuthCode(code: string) {
    const record = await this.prisma.oAuthCode.findFirst({
      where: {
        codeHash: this.hashToken(code),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!record) {
      throw new UnauthorizedException('Invalid or expired OAuth code');
    }
    const consumed = await this.prisma.oAuthCode.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException('Invalid or expired OAuth code');
    }
    return this.issueTokens(record.user);
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    name: string | null;
    emailVerifiedAt: Date | null;
  }) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });
    const { refreshToken } = await this.createSession(user);
    return { accessToken, refreshToken, user: this.toSafeUser(user) };
  }

  private async createSession(user: { id: string }) {
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });
    return { refreshToken, expiresAt };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async sendVerificationEmail(userId: string, email: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationTokenHash: this.hashToken(token),
        emailVerificationExpiresAt: expiresAt,
      },
    });
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    return this.jobs.enqueueEmail({
      kind: 'verification',
      to: email,
      verifyUrl: `${appUrl}/auth/verify-email?token=${token}`,
    });
  }

  private toSafeUser(user: SafeUser): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }
}
