import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { JobsService } from './jobs.service';

@Global()
@Module({
  imports: [ConfigModule, EmailModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
