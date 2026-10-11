-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationTokenHash" TEXT,
ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN "passwordResetTokenHash" TEXT;

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "inviterId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_workspaceId_email_idx" ON "Invitation"("workspaceId", "email");
CREATE INDEX "Invitation_expiresAt_acceptedAt_idx" ON "Invitation"("expiresAt", "acceptedAt");
CREATE UNIQUE INDEX "User_emailVerificationTokenHash_key" ON "User"("emailVerificationTokenHash");
CREATE UNIQUE INDEX "User_passwordResetTokenHash_key" ON "User"("passwordResetTokenHash");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
