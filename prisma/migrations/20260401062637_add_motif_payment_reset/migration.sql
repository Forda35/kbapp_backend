-- Ajout colonne motif avec valeur temporaire NON unique
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "motif" TEXT NOT NULL DEFAULT 'KB-INIT';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "motifExpiry" TIMESTAMP(3) NOT NULL DEFAULT NOW() + INTERVAL '30 minutes';

-- Rendre chaque motif unique AVANT de créer l'index
UPDATE "Payment" SET "motif" = 'KB-' || SUBSTR(MD5(id::text), 1, 4) WHERE "motif" = 'KB-INIT';

-- Maintenant créer l'index unique (toutes les valeurs sont différentes)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_motif_key" UNIQUE ("motif");

-- Ajout colonne ticketId optionnelle
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "ticketId" TEXT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ticketId_key" UNIQUE ("ticketId");

-- Mise à jour table Ticket
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Ticket" ALTER COLUMN "qrCode" DROP NOT NULL;

-- Créer table PasswordReset
CREATE TABLE IF NOT EXISTS "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordReset_token_key" ON "PasswordReset"("token");

ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;