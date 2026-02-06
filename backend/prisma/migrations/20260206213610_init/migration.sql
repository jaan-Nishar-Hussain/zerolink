-- CreateTable
CREATE TABLE "Alias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "spendPubKey" TEXT NOT NULL,
    "viewingPubKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,

    CONSTRAINT "Alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StealthAnnouncement" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "stealthAddress" TEXT NOT NULL,
    "ephemeralPubKey" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StealthAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerState" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "lastBlockNumber" BIGINT NOT NULL DEFAULT 0,
    "lastTxHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Alias_alias_key" ON "Alias"("alias");

-- CreateIndex
CREATE INDEX "Alias_alias_idx" ON "Alias"("alias");

-- CreateIndex
CREATE INDEX "Alias_spendPubKey_idx" ON "Alias"("spendPubKey");

-- CreateIndex
CREATE UNIQUE INDEX "StealthAnnouncement_txHash_key" ON "StealthAnnouncement"("txHash");

-- CreateIndex
CREATE INDEX "StealthAnnouncement_stealthAddress_idx" ON "StealthAnnouncement"("stealthAddress");

-- CreateIndex
CREATE INDEX "StealthAnnouncement_ephemeralPubKey_idx" ON "StealthAnnouncement"("ephemeralPubKey");

-- CreateIndex
CREATE INDEX "StealthAnnouncement_blockNumber_idx" ON "StealthAnnouncement"("blockNumber");

-- CreateIndex
CREATE INDEX "StealthAnnouncement_timestamp_idx" ON "StealthAnnouncement"("timestamp");
