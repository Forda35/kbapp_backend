/**
 * Script pour créer le premier compte administrateur
 * Usage : node scripts/createAdmin.js
 *
 * Configurez les variables EMAIL et PASSWORD ci-dessous avant d'exécuter.
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════
// 👇 MODIFIEZ CES VALEURS AVANT D'EXÉCUTER
const ADMIN_EMAIL = "";
const ADMIN_PASSWORD = "";
// ═══════════════════════════════════════════════

async function createAdmin() {
  console.log("\n🚀 Création du compte administrateur...\n");

  try {
    const existing = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existing) {
      // Met à jour le rôle si l'utilisateur existe déjà
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: { role: "admin", verified: true, verifyToken: null, verifyTokenExp: null },
      });
      console.log(`✅ Compte existant mis à jour en admin : ${ADMIN_EMAIL}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: "admin",
        verified: true,
      },
    });

    console.log("✅ Administrateur créé avec succès !");
    console.log(`   Email    : ${admin.email}`);
    console.log(`   Rôle     : ${admin.role}`);
    console.log(`   ID       : ${admin.id}`);
    console.log("\n🔐 Connectez-vous avec ces identifiants dans l'application.\n");
  } catch (error) {
    console.error("❌ Erreur :", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
