import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { MembershipRole } from '@prisma/client';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceMemberGuard } from './workspace-member.guard';
import { WorkspaceRoles } from './workspace-roles.decorator';
import { WorkspacesService } from './workspaces.service';
import { InviteMemberDto } from './dto/invite-member.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(request.user.sub, dto);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.workspaces.listForUser(request.user.sub);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceMemberGuard)
  get(@Param('workspaceId') workspaceId: string) {
    return this.workspaces.get(workspaceId);
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceMemberGuard)
  @WorkspaceRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  update(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(workspaceId, dto);
  }

  @Patch(':workspaceId/members/:userId/role')
  @UseGuards(WorkspaceMemberGuard)
  @WorkspaceRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspaces.updateMemberRole(workspaceId, userId, dto);
  }

  @Delete(':workspaceId/members/:userId')
  @UseGuards(WorkspaceMemberGuard)
  @WorkspaceRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    return this.workspaces.removeMember(workspaceId, userId);
  }

  @Post(':workspaceId/invitations')
  @UseGuards(WorkspaceMemberGuard)
  @WorkspaceRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  inviteMember(
    @Param('workspaceId') workspaceId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspaces.inviteMember(workspaceId, request.user.sub, dto);
  }
}
