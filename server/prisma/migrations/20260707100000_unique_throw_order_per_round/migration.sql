-- CreateIndex
-- Rows with null roundId (practice throws) are unaffected: Postgres treats
-- nulls as distinct in unique indexes.
CREATE UNIQUE INDEX "BagThrow_roundId_throwOrder_key" ON "BagThrow"("roundId", "throwOrder");
