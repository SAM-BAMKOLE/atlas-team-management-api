CREATE TYPE "ActivityType" AS ENUM ('TASK_CREATED', 'TASK_UPDATED', 'TASK_MOVED', 'TASK_ASSIGNED', 'TASK_UNASSIGNED', 'COMMENT_ADDED', 'LABEL_ADDED', 'LABEL_REMOVED');

CREATE TABLE "Label" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskLabel" (
    "taskId" UUID NOT NULL,
    "labelId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskLabel_pkey" PRIMARY KEY ("taskId", "labelId")
);

CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityEvent" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "taskId" UUID,
    "actorId" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Label_workspaceId_idx" ON "Label"("workspaceId");
CREATE UNIQUE INDEX "Label_workspaceId_name_key" ON "Label"("workspaceId", "name");
CREATE INDEX "TaskLabel_labelId_idx" ON "TaskLabel"("labelId");
CREATE INDEX "Comment_taskId_createdAt_idx" ON "Comment"("taskId", "createdAt");
CREATE INDEX "ActivityEvent_workspaceId_createdAt_idx" ON "ActivityEvent"("workspaceId", "createdAt");
CREATE INDEX "ActivityEvent_taskId_createdAt_idx" ON "ActivityEvent"("taskId", "createdAt");

ALTER TABLE "Label" ADD CONSTRAINT "Label_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskLabel" ADD CONSTRAINT "TaskLabel_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskLabel" ADD CONSTRAINT "TaskLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
