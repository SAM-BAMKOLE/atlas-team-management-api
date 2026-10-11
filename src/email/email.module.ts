import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER } from './email-provider';
import { EmailService } from './email.service';
import { NodemailerEmailProvider } from './nodemailer-email.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    NodemailerEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, NodemailerEmailProvider],
      useFactory: (
        config: ConfigService,
        provider: NodemailerEmailProvider,
      ) => {
        const selected = config.get<string>('EMAIL_PROVIDER', 'smtp');
        if (!['smtp', 'gmail'].includes(selected)) {
          throw new Error(`Unsupported EMAIL_PROVIDER: ${selected}`);
        }
        return provider;
      },
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
