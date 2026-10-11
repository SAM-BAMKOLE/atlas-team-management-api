import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { CreateColumnDto } from './dto/create-column.dto';
import { CreateProjectDto } from './dto/create-project.dto';
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

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
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
