const prisma = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendVerificationEmail } = require("../utils/emailSender");

// REGISTER – crée le compte mais non vérifié
exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser && existingUser.verified) {
      return res.status(400).json({ message: "Cet email est déjà utilisé" });
    }

    // Si l'utilisateur existe mais non vérifié, renvoyer un email
    if (existingUser && !existingUser.verified) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { email },
        data: { verifyToken: token, verifyTokenExp: expiry },
      });

      await sendVerificationEmail(email, token);

      return res.status(200).json({
        message: "Un nouvel email de vérification a été envoyé. Vérifiez votre boîte mail.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        verifyToken,
        verifyTokenExp,
        verified: false,
      },
    });

    await sendVerificationEmail(email, verifyToken);

    res.status(201).json({
      message: "Compte créé ! Vérifiez votre email pour activer votre compte.",
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// VERIFY EMAIL – activation du compte
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(renderPage("Token manquant", "Le lien de vérification est invalide.", false));
  }

  try {
    const user = await prisma.user.findFirst({
      where: { verifyToken: token },
    });

    if (!user) {
      return res.status(404).send(renderPage("Lien invalide", "Ce lien de vérification est incorrect ou a déjà été utilisé.", false));
    }

    if (new Date() > user.verifyTokenExp) {
      return res.status(400).send(renderPage("Lien expiré", "Ce lien a expiré. Veuillez vous réinscrire pour recevoir un nouveau lien.", false));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verifyToken: null,
        verifyTokenExp: null,
      },
    });

    res.send(renderPage("Email vérifié !", "Votre compte a été activé avec succès. Vous pouvez maintenant vous connecter.", true));
  } catch (error) {
    console.error("Verify error:", error);
    res.status(500).send(renderPage("Erreur serveur", "Une erreur est survenue. Réessayez plus tard.", false));
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ message: "Identifiants incorrects" });
    }

    if (!user.verified) {
      return res.status(403).json({
        message: "Veuillez vérifier votre email avant de vous connecter. Vérifiez votre boîte mail.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ message: "Identifiants incorrects" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Connexion réussie",
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Page HTML de confirmation (rendue côté backend)
function renderPage(title, message, success) {
  const color = success ? "#22c55e" : "#ef4444";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>${title} – KBApp</title>
      <style>
        body { margin:0; background:#0a0a1a; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:Arial,sans-serif; }
        .box { background:#111827; border:1px solid #1E3A8A; border-radius:20px; padding:50px 40px; text-align:center; max-width:420px; width:90%; }
        h1 { color:#FFD700; font-size:22px; margin-bottom:10px; }
        p { color:#ccc; line-height:1.6; }
        .icon { font-size:60px; margin-bottom:20px; }
        a { display:inline-block; margin-top:25px; background:linear-gradient(135deg,#1E3A8A,#1a6ec7); color:#FFD700; padding:14px 35px; border-radius:12px; text-decoration:none; font-weight:bold; border:2px solid #FFD700; }
        .status { color:${color}; font-size:18px; font-weight:bold; margin:10px 0; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="icon">${success ? "🎉" : "❌"}</div>
        <h1>KBApp</h1>
        <p class="status">${title}</p>
        <p>${message}</p>
        <a href="${frontendUrl}">Se connecter</a>
      </div>
    </body>
    </html>
  `;
}


// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email requis" });

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Toujours répondre OK (sécurité — ne pas révéler si l'email existe)
    if (!user) {
      return res.json({ message: "Si cet email existe, un lien de réinitialisation a été envoyé." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await require("../utils/emailSender").sendResetEmail(user.email, resetUrl);

    res.json({ message: "Si cet email existe, un lien de réinitialisation a été envoyé." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: "Token et nouveau mot de passe requis" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères" });
  }

  try {
    const reset = await prisma.passwordReset.findUnique({ where: { token } });

    if (!reset || reset.used || new Date() > reset.expiresAt) {
      return res.status(400).json({ message: "Lien invalide ou expiré" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: reset.userId },
      data: { password: hashedPassword },
    });

    await prisma.passwordReset.update({
      where: { token },
      data: { used: true },
    });

    res.json({ message: "Mot de passe réinitialisé avec succès. Vous pouvez vous connecter." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};