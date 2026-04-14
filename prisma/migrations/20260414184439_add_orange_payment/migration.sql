/*
  Warnings:

  - A unique constraint covering the columns `[orangeTransactionId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "orangeTransactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orangeTransactionId_key" ON "Payment"("orangeTransactionId");
