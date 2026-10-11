import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import { EmailService } from '../email/email.service';
import { EMAIL_JOB, EmailJobPayload } from './jobs.constants';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly boss: PgBoss;

  constructor(
    config: ConfigService,
    private readonly email: EmailService,
  ) {
    const connectionString =
      config.get<string>('DATABASE_URL_UNPOOLED') ??
      config.getOrThrow<string>('DATABASE_URL');
    this.boss = new PgBoss({ connectionString });
  }

  async onModuleInit() {
    await this.boss.start();
    await this.boss.createQueue(EMAIL_JOB);
    await this.boss.work<EmailJobPayload>(EMAIL_JOB, async (jobs) => {
      const [job] = jobs;
      const result = await this.processEmail(job.data);
      if (!result.sent) {
        throw new Error(`Email provider rejected ${job.data.kind} email`);
      }
    });
    this.logger.log('Background job worker started');
  }

  async enqueueEmail(payload: EmailJobPayload) {
    return this.boss.send(EMAIL_JOB, payload, {
      retryLimit: 5,
      retryDelay: 30,
      retryBackoff: true,
    });
  }

  async onModuleDestroy() {
    await this.boss.stop({ graceful: true });
  }

  private processEmail(payload: EmailJobPayload) {
    switch (payload.kind) {
      case 'invitation':
        return this.email.sendInvitation(
          payload.to,
          payload.workspaceName,
          payload.inviteUrl,
        );
      case 'verification':
        return this.email.sendVerification(payload.to, payload.verifyUrl);
      case 'password-reset':
        return this.email.sendPasswordReset(payload.to, payload.resetUrl);
    }
  }
}
