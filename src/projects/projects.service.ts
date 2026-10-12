import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { CreateColumnDto } from './dto/create-column.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateProjectDto) {
    const slug = dto.slug?.trim() || this.slugify(dto.name);
    try {
      return await this.prisma.project.create({
        data: {
          workspaceId,
          name: dto.name.trim(),
          slug,
          description: dto.description?.trim(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A project with this slug already exists in the workspace',
        );
      }
      throw error;
    }
  }

  list(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      include: { boards: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async get(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      include: {
        boards: {
          orderBy: { createdAt: 'asc' },
          include: { columns: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(workspaceId: string, projectId: string, dto: UpdateProjectDto) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.project.update({ where: { id: projectId }, data: dto });
  }

  async createBoard(
    workspaceId: string,
    projectId: string,
    dto: CreateBoardDto,
  ) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.board.create({
      data: { projectId, name: dto.name.trim() },
    });
  }

  async updateBoard(
    workspaceId: string,
    projectId: string,
    boardId: string,
    dto: UpdateBoardDto,
  ) {
    await this.assertBoard(workspaceId, projectId, boardId);
    return this.prisma.board.update({
      where: { id: boardId },
      data: { name: dto.name.trim() },
    });
  }

  async deleteBoard(workspaceId: string, projectId: string, boardId: string) {
    await this.assertBoard(workspaceId, projectId, boardId);
    // Columns and tasks follow through the database-level cascade.
    await this.prisma.board.delete({ where: { id: boardId } });
    return { success: true };
  }

  async createColumn(
    workspaceId: string,
    projectId: string,
    boardId: string,
    dto: CreateColumnDto,
  ) {
    await this.assertProject(workspaceId, projectId);
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, projectId },
    });
    if (!board) throw new NotFoundException('Board not found');
    try {
      return await this.prisma.boardColumn.create({
        data: { boardId, name: dto.name.trim(), position: dto.position },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A column already exists at this position');
      }
      throw error;
    }
  }

  async updateColumn(
    workspaceId: string,
    projectId: string,
    boardId: string,
    columnId: string,
    dto: UpdateColumnDto,
  ) {
    await this.assertBoard(workspaceId, projectId, boardId);
    const column = await this.prisma.boardColumn.findFirst({
      where: { id: columnId, boardId },
    });
    if (!column) throw new NotFoundException('Board column not found');
    if (dto.name === undefined && dto.position === undefined) {
      throw new BadRequestException('Provide a name or a position to update');
    }

    const name = dto.name?.trim();
    if (dto.position === undefined || dto.position === column.position) {
      return this.prisma.boardColumn.update({
        where: { id: columnId },
        data: { name },
      });
    }

    // The (boardId, position) unique index forbids shifting positions in
    // place: park every column on a temporary position first, then write
    // the final order. Out-of-range targets clamp to the end of the board.
    const target = dto.position;
    return this.prisma.$transaction(async (tx) => {
      const columns = await tx.boardColumn.findMany({
        where: { boardId },
        orderBy: { position: 'asc' },
      });
      for (const [index, col] of columns.entries()) {
        await tx.boardColumn.update({
          where: { id: col.id },
          data: { position: -(index + 1) },
        });
      }
      const others = columns.filter((c) => c.id !== columnId);
      const targetIndex = Math.min(target, others.length);
      const ordered = [
        ...others.slice(0, targetIndex),
        column,
        ...others.slice(targetIndex),
      ];
      for (const [index, col] of ordered.entries()) {
        await tx.boardColumn.update({
          where: { id: col.id },
          data: {
            position: index,
            ...(col.id === columnId && name !== undefined ? { name } : {}),
          },
        });
      }
      return tx.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
    });
  }

  async deleteColumn(
    workspaceId: string,
    projectId: string,
    boardId: string,
    columnId: string,
    force: boolean,
  ) {
    await this.assertBoard(workspaceId, projectId, boardId);
    const column = await this.prisma.boardColumn.findFirst({
      where: { id: columnId, boardId },
    });
    if (!column) throw new NotFoundException('Board column not found');
    const taskCount = await this.prisma.task.count({ where: { columnId } });
    if (taskCount > 0 && !force) {
      throw new ConflictException(
        'This column still holds ' +
          taskCount +
          ' task(s). Pass ?force=true to delete them as well.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      // Tasks inside the column follow through the database-level cascade.
      await tx.boardColumn.delete({ where: { id: columnId } });
      // Close the gap the deletion left behind; ascending renumbering never
      // collides because each target position was just vacated.
      const remaining = await tx.boardColumn.findMany({
        where: { boardId },
        orderBy: { position: 'asc' },
      });
      for (const [index, col] of remaining.entries()) {
        if (col.position === index) continue;
        await tx.boardColumn.update({
          where: { id: col.id },
          data: { position: index },
        });
      }
    });
    return { success: true };
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
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

  private slugify(value: string) {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'project'
    );
  }
}