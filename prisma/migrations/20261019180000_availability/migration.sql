-- CreateTable
CREATE TABLE "ChefBlockedDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChefBlockedDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChefBlockedDay_userId_day_key" ON "ChefBlockedDay"("userId", "day");

-- AddForeignKey
ALTER TABLE "ChefBlockedDay" ADD CONSTRAINT "ChefBlockedDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
