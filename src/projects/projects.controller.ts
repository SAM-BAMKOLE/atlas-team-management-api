import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MembershipRole } from '@prisma/client';
import { WorkspaceMemberGuard } from '../workspaces/workspace-member.guard';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator';
import { CreateBoardDto } from './dto/create-board.dto';
import { CreateColumnDto } from './dto/create-column.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('workspaces/:workspaceId/projects')
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(workspaceId, dto);
  }

  @Get()
  list(@Param('workspaceId') workspaceId: string) {
    return this.projects.list(workspaceId);
  }

  @Get(':projectId')
  get(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.get(workspaceId, projectId);
  }

  @Patch(':projectId')
  @WorkspaceRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(workspaceId, projectId, dto);
  }

  @Post(':projectId/boards')
  createBoard(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateBoardDto,
  ) {
    return this.projects.createBoard(workspaceId, projectId, dto);
  }

  @Patch(':projectId/boards/:boardId')
  updateBoard(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('boardId') boardId: string,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.projects.updateBoard(workspaceId, projectId, boardId, dto);
  }

  @Delete(':projectId/boards/:boardId')
  @WorkspaceRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  deleteBoard(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('boardId') boardId: string,
  ) {
    return this.projects.deleteBoard(workspaceId, projectId, boardId);
  }

  @Post(':projectId/boards/:boardId/columns')
  createColumn(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('boardId') boardId: string,
    @Body() dto: CreateColumnDto,
  ) {
    return this.projects.createColumn(workspaceId, projectId, boardId, dto);
  }

  @Patch(':projectId/boards/:boardId/columns/:columnId')
  updateColumn(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Body() dto: UpdateColumnDto,
  ) {
    return this.projects.updateColumn(
      workspaceId,
      projectId,
      boardId,
      columnId,
      dto,
    );
  }

  @Delete(':projectId/boards/:boardId/columns/:columnId')
  @WorkspaceRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  deleteColumn(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Query('force') force?: string,
  ) {
    return this.projects.deleteColumn(
      workspaceId,
      projectId,
      boardId,
      columnId,
      force === 'true',
    );
  }
}