import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    workspaceId: string,
    projectId: string,
    boardId: string,
    dto: CreateTaskDto,
  ) {
    await this.assertBoard(workspaceId, projectId, boardId);
    const column = await this.prisma.boardColumn.findFirst({
      where: { id: dto.columnId, boardId },
    });
    if (!column) throw new NotFoundException('Board column not found');
    return this.prisma.task.create({
      data: {
        boardId,
        columnId: dto.columnId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        position: dto.position ?? 0,
      },
      include: {
        assignees: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        labels: { include: { label: true } },
      },
    });
  }

  async list(workspaceId: string, projectId: string, boardId: string) {
    await this.assertBoard(workspaceId, projectId, boardId);
    return this.prisma.task.findMany({
      where: { boardId, archived: false },
      orderBy: [{ columnId: 'asc' }, { position: 'asc' }],
      include: {
        assignees: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        labels: { include: { label: true } },
      },
    });
  }

  async update(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    await this.assertTask(workspaceId, projectId, boardId, taskId);
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...dto,
        dueDate:
          dto.dueDate === undefined
            ? undefined
            : dto.dueDate
              ? new Date(dto.dueDate)
              : null,
      },
      include: {
        assignees: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        labels: { include: { label: true } },
      },
    });
  }

  async move(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
    dto: MoveTaskDto,
  ) {
    await this.assertTask(workspaceId, projectId, boardId, taskId);
    const column = await this.prisma.boardColumn.findFirst({
      where: { id: dto.columnId, boardId },
    });
    if (!column) throw new NotFoundException('Board column not found');
    return this.prisma.task.update({
      where: { id: taskId },
      data: { columnId: dto.columnId, position: dto.position },
    });
  }

  async assign(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
    userId: string,
  ) {
    await this.assertTask(workspaceId, projectId, boardId, taskId);
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!member)
      throw new ForbiddenException('User is not a member of this workspace');
    await this.prisma.taskAssignee.upsert({
      where: { taskId_userId: { taskId, userId } },
      update: {},
      create: { taskId, userId },
    });
    return { success: true };
  }

  async unassign(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
    userId: string,
  ) {
    await this.assertTask(workspaceId, projectId, boardId, taskId);
    await this.prisma.taskAssignee.deleteMany({ where: { taskId, userId } });
    return { success: true };
  }

  private async assertBoard(
    workspaceId: string,
    projectId: string,
    boardId: string,
  ) {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, project: { id: projectId, workspaceId } },
    });
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  private async assertTask(
    workspaceId: string,
    projectId: string,
    boardId: string,
    taskId: string,
  ) {
    await this.assertBoard(workspaceId, projectId, boardId);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, boardId },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
