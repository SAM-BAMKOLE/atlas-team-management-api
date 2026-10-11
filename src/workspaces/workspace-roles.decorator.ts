import { SetMetadata } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';

export const WORKSPACE_ROLES_KEY = 'workspace_roles';
export const WorkspaceRoles = (...roles: MembershipRole[]) =>
  SetMetadata(WORKSPACE_ROLES_KEY, roles);
