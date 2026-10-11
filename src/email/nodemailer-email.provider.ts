import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { EmailMessage, EmailProvider } from './email-provider';

@Injectable()
export class NodemailerEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const provider = config.get<string>('EMAIL_PROVIDER', 'smtp');
    const user = config.get<string>('EMAIL_USER');
    const password = config.get<string>('EMAIL_APP_PASSWORD');
    this.from = config.get<string>('EMAIL_FROM', user ?? 'no-reply@localhost');

    this.transporter =
      provider === 'gmail'
        ? nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass: password },
          })
        : nodemailer.createTransport({
            host: config.get<string>('SMTP_HOST', 'localhost'),
            port: Number(config.get<string>('SMTP_PORT', '1025')),
            secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
            auth: user && password ? { user, pass: password } : undefined,
          });
  }

  async send(message: EmailMessage) {
    const result = await this.transporter.sendMail({
      ...message,
      from: this.from,
    });
    return { messageId: result.messageId };
  }
}
