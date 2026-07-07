-- AlterEnum
ALTER TYPE "BagColour" ADD VALUE 'BLACK';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "Game_createdById_idx" ON "Game"("createdById");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
