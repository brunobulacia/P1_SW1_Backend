-- CreateEnum
CREATE TYPE "public"."MemberRole" AS ENUM ('EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."MemberStatus" AS ENUM ('ACTIVE', 'PENDING', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."ExportType" AS ENUM ('SPRING_BOOT', 'POSTMAN');

-- CreateEnum
CREATE TYPE "public"."ExportStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Diagram" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "model" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Diagram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiagramMember" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DiagramMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiagramInvite" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DiagramInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Diagram_ownerId_idx" ON "public"."Diagram"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagramMember_invitationId_key" ON "public"."DiagramMember"("invitationId");

-- CreateIndex
CREATE INDEX "DiagramMember_invitationId_idx" ON "public"."DiagramMember"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagramMember_diagramId_invitationId_key" ON "public"."DiagramMember"("diagramId", "invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagramInvite_token_key" ON "public"."DiagramInvite"("token");

-- CreateIndex
CREATE INDEX "DiagramInvite_diagramId_idx" ON "public"."DiagramInvite"("diagramId");

-- AddForeignKey
ALTER TABLE "public"."Diagram" ADD CONSTRAINT "Diagram_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiagramMember" ADD CONSTRAINT "DiagramMember_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "public"."Diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiagramMember" ADD CONSTRAINT "DiagramMember_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "public"."DiagramInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiagramInvite" ADD CONSTRAINT "DiagramInvite_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "public"."Diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
