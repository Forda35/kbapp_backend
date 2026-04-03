const express = require("express");
const router = express.Router();
const { register, login, verifyEmail, forgotPassword, resetPassword } = require("../controllers/userController");

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/register", register);
router.post("/login", login);
router.get("/verify-email", verifyEmail);

// Route temporaire pour créer le premier admin
// À SUPPRIMER après création du compte admin !
router.post("/setup-admin", async (req, res) => {
  const { email, password, setupKey } = req.body;

  // Clé secrète pour sécuriser cette route
  if (setupKey !== process.env.SETUP_KEY) {
    return res.status(401).json({ message: "Clé invalide" });
  }

  try {
    const bcrypt = require("bcryptjs");
    const prisma = require("../config/db");

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      // Si existe déjà, mettre à jour en admin
      await prisma.user.update({
        where: { email },
        data: { role: "admin", verified: true, verifyToken: null, verifyTokenExp: null },
      });
      return res.json({ message: "Utilisateur mis à jour en admin" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: "admin",
        verified: true,
      },
    });

    res.json({ message: "Admin créé avec succès", email: admin.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
module.exports = router;