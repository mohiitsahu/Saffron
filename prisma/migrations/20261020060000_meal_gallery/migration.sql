CREATE TABLE "MealPhoto" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chefId" TEXT NOT NULL REFERENCES "ChefProfile"("id") ON DELETE CASCADE,
  "contentType" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "dishName" TEXT NOT NULL DEFAULT '',
  "caption" TEXT NOT NULL DEFAULT '',
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealPhoto_position" CHECK ("position" BETWEEN 0 AND 5),
  CONSTRAINT "MealPhoto_size" CHECK (octet_length("data") BETWEEN 1 AND 1000000),
  CONSTRAINT "MealPhoto_type" CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT "MealPhoto_text" CHECK (char_length("dishName") <= 80 AND char_length("caption") <= 280)
);
CREATE INDEX "MealPhoto_chefId_position_createdAt_idx" ON "MealPhoto"("chefId", "position", "createdAt");
