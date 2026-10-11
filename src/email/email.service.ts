import { Inject, Injectable, Logger } from '@nestjs/common';
import { EMAIL_PROVIDER, EmailProvider } from './email-provider';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  async sendInvitation(to: string, workspaceName: string, inviteUrl: string) {
    return this.trySend({
      to,
      subject: `You have been invited to ${workspaceName}`,
      text: `Join ${workspaceName} on Atlas: ${inviteUrl}`,
      html: `<p>Join <strong>${workspaceName}</strong> on Atlas.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`,
    });
  }

  async sendVerification(to: string, verifyUrl: string) {
    return this.trySend({
      to,
      subject: 'Verify your Atlas email address',
      text: `Verify your Atlas email address: ${verifyUrl}`,
      html: `<p><a href="${verifyUrl}">Verify your email address</a></p>`,
    });
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    return this.trySend({
      to,
      subject: 'Reset your Atlas password',
      text: `Reset your Atlas password: ${resetUrl}`,
      html: `<p><a href="${resetUrl}">Reset your password</a></p>`,
    });
  }

  private async trySend(message: Parameters<EmailProvider['send']>[0]) {
    try {
      return { sent: true, ...(await this.provider.send(message)) };
    } catch (error) {
      this.logger.error(`Email delivery failed for ${message.to}`, error);
      return { sent: false };
    }
  }
}
