import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload } from './jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { GoogleExchangeDto } from './dto/google-exchange.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto);
  }

  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.auth.confirmPasswordReset(dto.token, dto.password);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    return { message: 'Redirecting to Google' };
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(
    @Req()
    request: Request & {
      user: Parameters<AuthService['issueTokensForUser']>[0];
    },
    @Res() response: Response,
  ) {
    void this.auth
      .createOAuthCode(request.user)
      .then((code) => {
        const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
        const redirectUrl = new URL('/auth/oauth/callback', appUrl);
        redirectUrl.searchParams.set('code', code);
        response.redirect(302, redirectUrl.toString());
      })
      .catch(() => {
        const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
        response.redirect(302, `${appUrl}/auth/oauth/error`);
      });
  }

  @Post('google/exchange')
  exchangeGoogleCode(@Body() dto: GoogleExchangeDto) {
    return this.auth.exchangeOAuthCode(dto.code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.getSafeUser(request.user.sub);
  }
}
