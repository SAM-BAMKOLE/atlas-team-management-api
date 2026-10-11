import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CollaborationService } from './collaboration.service';
import { LabelsController } from './labels.controller';

@Module({
  controllers: [TasksController, LabelsController],
  providers: [TasksService, CollaborationService],
})
export class TasksModule {}
