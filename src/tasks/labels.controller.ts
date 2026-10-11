import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../workspaces/workspace-member.guard';
import { CreateLabelDto } from './dto/create-label.dto';
import { CollaborationService } from './collaboration.service';

@Controller('workspaces/:workspaceId/labels')
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class LabelsController {
  constructor(private readonly collaboration: CollaborationService) {}

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateLabelDto,
  ) {
    return this.collaboration.createLabel(workspaceId, dto);
  }

  @Get()
  list(@Param('workspaceId') workspaceId: string) {
    return this.collaboration.listLabels(workspaceId);
  }
}
