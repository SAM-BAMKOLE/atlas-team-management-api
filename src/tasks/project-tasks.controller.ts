import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../workspaces/workspace-member.guard';
import { TasksService } from './tasks.service';

/**
 * Project-scoped task listings (the project "Tasks" page): every task across
 * a project's boards, active or archived. Membership is enforced by the
 * workspace guard; ownership of the project is verified in the service.
 */
@Controller('workspaces/:workspaceId/projects/:projectId/tasks')
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class ProjectTasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @Param()
    params: { workspaceId: string; projectId: string },
    @Query('archived') archived?: string,
  ) {
    return this.tasks.listForProject(
      params.workspaceId,
      params.projectId,
      archived === 'true',
    );
  }
}