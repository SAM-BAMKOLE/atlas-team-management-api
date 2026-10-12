import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MembershipRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt.strategy';
import { WorkspaceMemberGuard } from '../workspaces/workspace-member.guard';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';
import { CollaborationService } from './collaboration.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('workspaces/:workspaceId/projects/:projectId/boards/:boardId/tasks')
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly collaboration: CollaborationService,
  ) {}

  @Post()
  create(
    @Param()
    params: { workspaceId: string; projectId: string; boardId: string },
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(
      params.workspaceId,
      params.projectId,
      params.boardId,
      dto,
    );
  }

  @Get()
  list(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
    },
    @Query('archived') archived?: string,
  ) {
    return this.tasks.list(
      params.workspaceId,
      params.projectId,
      params.boardId,
      archived === 'true',
    );
  }

  /** One task by id, archived or not — used for deep links to archived tasks. */
  @Get(':taskId')
  get(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
    },
  ) {
    return this.tasks.get(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
    );
  }

  @Patch(':taskId')
  update(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
    },
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
      dto,
    );
  }

  @Delete(':taskId')
  remove(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
    },
  ) {
    return this.tasks.remove(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
    );
  }

  @Delete(':taskId/permanent')
  @WorkspaceRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  purge(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
    },
  ) {
    return this.tasks.purge(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
    );
  }

  @Post(':taskId/move')
  move(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
    },
    @Body() dto: MoveTaskDto,
  ) {
    return this.tasks.move(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
      dto,
    );
  }

  @Put(':taskId/assignees/:userId')
  assign(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
      userId: string;
    },
  ) {
    return this.tasks.assign(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
      params.userId,
    );
  }

  @Delete(':taskId/assignees/:userId')
  unassign(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
      userId: string;
    },
  ) {
    return this.tasks.unassign(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
      params.userId,
    );
  }

  @Post(':taskId/comments')
  addComment(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
    },
    @Req() request: Request & { user: JwtPayload },
    @Body() dto: CreateCommentDto,
  ) {
    return this.collaboration.addComment(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
      request.user.sub,
      dto,
    );
  }

  @Get(':taskId/comments')
  listComments(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
    },
  ) {
    return this.collaboration.listComments(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
    );
  }

  @Get(':taskId/activity')
  listActivity(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
    },
  ) {
    return this.collaboration.listActivity(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
    );
  }

  @Put(':taskId/labels/:labelId')
  addLabel(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
      labelId: string;
    },
    @Req() request: Request & { user: JwtPayload },
  ) {
    return this.collaboration.addLabel(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
      params.labelId,
      request.user.sub,
    );
  }

  @Delete(':taskId/labels/:labelId')
  removeLabel(
    @Param()
    params: {
      workspaceId: string;
      projectId: string;
      boardId: string;
      taskId: string;
      labelId: string;
    },
    @Req() request: Request & { user: JwtPayload },
  ) {
    return this.collaboration.removeLabel(
      params.workspaceId,
      params.projectId,
      params.boardId,
      params.taskId,
      params.labelId,
      request.user.sub,
    );
  }
}
