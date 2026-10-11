import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRole } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { WORKSPACE_ROLES_KEY } from './workspace-roles.decorator';

type RequestWithUser = Request & {
  user: { sub: string };
  workspaceMembership?: unknown;
};

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const workspaceParam = request.params.workspaceId;
    const workspaceId = Array.isArray(workspaceParam)
      ? workspaceParam[0]
      : workspaceParam;
    if (!workspaceId)
      throw new NotFoundException('Workspace route parameter is required');

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: request.user.sub, workspaceId } },
      include: { workspace: true, user: true },
    });
    if (!membership)
      throw new ForbiddenException('You are not a member of this workspace');

    const requiredRoles = this.reflector.getAllAndOverride<MembershipRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'You do not have permission for this workspace action',
      );
    }

    request.workspaceMembership = membership;
    return true;
  }
}
