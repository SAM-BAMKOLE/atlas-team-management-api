import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateLabelDto } from './dto/create-label.dto';

@Injectable()
export class CollaborationService {
  constructor(private readonly prisma: PrismaService) {}

  async addComment(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
    authorId: string,
    dto: CreateCommentDto,
  ) {
    await this.assertTask(workspaceId, projectId, boardId, taskId);
    const comment = await this.prisma.comment.create({
      data: { taskId, authorId, body: dto.body.trim() },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    await this.record(
      workspaceId,
      taskId,
      authorId,
      ActivityType.COMMENT_ADDED,
      { commentId: comment.id },
    );
    return comment;
  }

  async listComments(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
  ) {
    await this.assertTask(workspaceId, projectId, boardId, taskId);
    return this.prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async createLabel(workspaceId: string, dto: CreateLabelDto) {
    try {
      return await this.prisma.label.create({
        data: {
          workspaceId,
          name: dto.name.trim(),
          color: dto.color.toUpperCase(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('A label with this name already exists');
      throw error;
    }
  }

  listLabels(workspaceId: string) {
    return this.prisma.label.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  async addLabel(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
    labelId: string,
    actorId: string,
  ) {
    await this.assertTask(workspaceId, projectId, boardId, taskId);
    const label = await this.prisma.label.findFirst({
      where: { id: labelId, workspaceId },
    });
    if (!label) throw new NotFoundException('Label not found');
    await this.prisma.taskLabel.upsert({
      where: { taskId_labelId: { taskId, labelId } },
      update: {},
      create: { taskId, labelId },
    });
    await this.record(workspaceId, taskId, actorId, ActivityType.LABEL_ADDED, {
      labelId,
    });
    return { success: true };
  }

  async removeLabel(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
    labelId: string,
    actorId: string,
  ) {
    await this.assertTask(workspaceId, projectId, boardId, taskId);
    await this.prisma.taskLabel.deleteMany({ where: { taskId, labelId } });
    await this.record(
      workspaceId,
      taskId,
      actorId,
      ActivityType.LABEL_REMOVED,
      { labelId },
    );
    return { success: true };
  }

  async listActivity(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
  ) {
    await this.assertTask(workspaceId, projectId, boardId, taskId);
    return this.prisma.activityEvent.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  }

  private async assertTask(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        boardId,
        board: { project: { id: projectId, workspaceId } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private record(
    workspaceId: string,
    taskId: string,
    actorId: string,
    type: ActivityType,
    metadata: Prisma.InputJsonValue,
  ) {
    return this.prisma.activityEvent.create({
      data: { workspaceId, taskId, actorId, type, metadata },
    });
  }
}
