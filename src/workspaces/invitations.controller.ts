import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post('accept')
  accept(
    @Req() request: Request & { user: JwtPayload },
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.workspaces.acceptInvitation(request.user.sub, dto.token);
  }
}
