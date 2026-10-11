import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { JobsService } from '../jobs/jobs.service';
import { createHash, randomBytes } from 'node:crypto';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const slug = dto.slug?.trim() || this.slugify(dto.name);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: { name: dto.name.trim(), slug },
        });
        await tx.workspaceMember.create({
          data: {
            userId,
            workspaceId: workspace.id,
            role: MembershipRole.OWNER,
          },
        });
        return workspace;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A workspace with this slug already exists',
        );
      }
      throw error;
    }
  }

  listForUser(userId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { workspace: true },
    });
  }

  async get(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        memberships: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async update(workspaceId: string, dto: UpdateWorkspaceDto) {
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!target) throw new NotFoundException('Workspace member not found');
    if (
      target.role === MembershipRole.OWNER &&
      dto.role !== MembershipRole.OWNER
    ) {
      throw new ForbiddenException('The workspace owner cannot be demoted');
    }
    if (
      dto.role === MembershipRole.OWNER &&
      target.role !== MembershipRole.OWNER
    ) {
      throw new ForbiddenException('Transfer ownership is not supported yet');
    }
    return this.prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: dto.role },
    });
  }

  async removeMember(workspaceId: string, userId: string) {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!target) throw new NotFoundException('Workspace member not found');
    if (target.role === MembershipRole.OWNER) {
      throw new ForbiddenException('The workspace owner cannot be removed');
    }
    await this.prisma.workspaceMember.delete({ where: { id: target.id } });
    return { success: true };
  }

  async inviteMember(
    workspaceId: string,
    inviterId: string,
    dto: InviteMemberDto,
  ) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (
      existing &&
      (await this.prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: existing.id, workspaceId } },
      }))
    ) {
      throw new ConflictException('This user is already a workspace member');
    }

    const token = randomBytes(32).toString('hex');
    const invitation = await this.prisma.invitation.create({
      data: {
        workspaceId,
        inviterId,
        email,
        role: dto.role,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: { workspace: true },
    });
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const jobId = await this.jobs.enqueueEmail({
      kind: 'invitation',
      to: email,
      workspaceName: invitation.workspace.name,
      inviteUrl: `${appUrl}/invitations/accept?token=${token}`,
    });
    return {
      id: invitation.id,
      email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      emailJobId: jobId,
    };
  }

  async acceptInvitation(userId: string, token: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!invitation)
      throw new NotFoundException('Invalid or expired invitation');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email.toLowerCase() !== invitation.email) {
      throw new ForbiddenException(
        'Invitation email does not match the current account',
      );
    }
    await this.prisma.$transaction([
      this.prisma.workspaceMember.upsert({
        where: {
          userId_workspaceId: { userId, workspaceId: invitation.workspaceId },
        },
        update: { role: invitation.role },
        create: {
          userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
    return { workspaceId: invitation.workspaceId, role: invitation.role };
  }

  private slugify(value: string) {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'workspace'
    );
  }
}
