-- AlterTable
ALTER TABLE "Player" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "Player_createdById_idx" ON "Player"("createdById");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "GroupInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvite_token_key" ON "GroupInvite"("token");
CREATE INDEX "GroupInvite_groupId_idx" ON "GroupInvite"("groupId");

-- AddForeignKey
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data backfill: visibility becomes group-scoped in this release, so put every
-- existing player into one founding group. Admin is the earliest app admin
-- (falling back to the earliest player). Skipped if the group already exists
-- or there are no players (fresh database).
DO $$
DECLARE
  admin_id TEXT;
  gid TEXT := gen_random_uuid()::text;
BEGIN
  SELECT id INTO admin_id FROM "Player" WHERE "isAdmin" = true ORDER BY "createdAt" ASC LIMIT 1;
  IF admin_id IS NULL THEN
    SELECT id INTO admin_id FROM "Player" ORDER BY "createdAt" ASC LIMIT 1;
  END IF;
  IF admin_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Group" WHERE name = 'PT Cornhole') THEN
    INSERT INTO "Group" (id, name, "createdBy", "createdAt")
      VALUES (gid, 'PT Cornhole', admin_id, now());
    INSERT INTO "GroupMember" (id, "groupId", "playerId", status, "addedAt")
      SELECT gen_random_uuid()::text, gid, p.id, 'MEMBER'::"GroupMemberStatus", now()
      FROM "Player" p
      ON CONFLICT DO NOTHING;
  END IF;
END $$;
