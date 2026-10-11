import { PrismaClient, MembershipRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@atlas.local' },
    update: {},
    create: { email: 'demo@atlas.local', name: 'Atlas Demo' },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: { name: 'Demo Workspace', slug: 'demo-workspace' },
  });

  await prisma.workspaceMember.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: MembershipRole.OWNER },
    create: { userId: user.id, workspaceId: workspace.id, role: MembershipRole.OWNER },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
