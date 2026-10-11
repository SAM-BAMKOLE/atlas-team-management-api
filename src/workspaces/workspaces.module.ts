import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspaceMemberGuard } from './workspace-member.guard';
import { WorkspacesService } from './workspaces.service';
import { InvitationsController } from './invitations.controller';

@Module({
  controllers: [WorkspacesController, InvitationsController],
  providers: [WorkspacesService, WorkspaceMemberGuard],
})
export class WorkspacesModule {}
