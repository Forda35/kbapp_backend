const prisma = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendVerificationEmail } = require("../utils/emailSender");

// REGISTER – crée le compte mais non vérifié
exports.register = async (req, res) => {
  const { email, password, termsAccepted } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères" });
    }

    // Vérification consentement obligatoire
    if (!termsAccepted) {
      return res.status(400).json({
        message: "Vous devez accepter les conditions d'utilisation pour créer un compte",
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser && existingUser.verified) {
      return res.status(400).json({ message: "Cet email est déjà utilisé" });
    }

    if (existingUser && !existingUser.verified) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.user.update({
        where: { email },
        data: {
          verifyToken: token,
          verifyTokenExp: expiry,
          termsAccepted: true,
          termsVersion: "1.0",
          termsAcceptedAt: new Date(),
        },
      });
      await sendVerificationEmail(email, token);
      return res.status(200).json({
        message: "Un nouvel email de vérification a été envoyé. Vérifiez votre boîte mail et vos spams.",
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
        termsAccepted: true,
        termsVersion: "1.0",
        termsAcceptedAt: new Date(),
      },
    });

    await sendVerificationEmail(email, verifyToken);

    res.status(201).json({
      message: "Compte créé ! Vérifiez votre email pour activer votre compte. Si vous ne trouvez pas l'email, vérifiez vos spams.",
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
      <title>${title} – KB Events App</title>
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
        <div class="icon">${success ? "Succès" : "Echec"}</div>
        <h1>KB Events App</h1>
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

    const resetUrl = `${process.env.APP_URL}/api/users/reset-password-page?token=${token}`;

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

//reset page
function renderResetPage(token, showForm) {
  if (!showForm) {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Erreur – KB Events App</title>
        <style>
          body { margin:0; background:#0a0a1a; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:Arial,sans-serif; }
          .box { background:#111827; border:1px solid #1E3A8A; border-radius:20px; padding:50px 40px; text-align:center; max-width:420px; width:90%; }
          h1 { color:#FFD700; } p { color:#ccc; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>KB Events App</h1>
          <p> ${token}</p>
        </div>
      </body>
      </html>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Nouveau mot de passe – KB Events App</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background:#0a0a1a; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:Arial,sans-serif; padding: 20px; }
        .box { background:#111827; border:1px solid #1E3A8A; border-radius:20px; padding:40px; width:100%; max-width:420px; }
        h1 { color:#FFD700; font-size:24px; text-align:center; margin-bottom:8px; }
        p { color:#9CA3AF; text-align:center; margin-bottom:30px; font-size:14px; }
        label { color:#9CA3AF; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; display:block; margin-bottom:8px; }
        input { width:100%; background:#0d1535; border:1.5px solid #1E3A8A44; border-radius:12px; color:#fff; font-size:16px; padding:14px 16px; margin-bottom:20px; outline:none; }
        input:focus { border-color:#FFD700; }
        button { width:100%; background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#FFD700; border:1.5px solid #FFD70060; border-radius:12px; padding:16px; font-size:16px; font-weight:800; cursor:pointer; }
        button:hover { opacity:0.9; }
        .msg { margin-top:16px; padding:12px; border-radius:10px; text-align:center; font-size:14px; display:none; }
        .success { background:#052e16; border:1px solid #22c55e; color:#22c55e; }
        .error { background:#1a0a0a; border:1px solid #ef4444; color:#ef4444; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>KB Events App</h1>
        <p>Choisissez votre nouveau mot de passe</p>

        <label>Nouveau mot de passe</label>
        <input type="password" id="password" placeholder="Min. 6 caractères" />

        <label>Confirmer le mot de passe</label>
        <input type="password" id="confirm" placeholder="Répétez le mot de passe" />

        <button onclick="submitReset()">Réinitialiser mon mot de passe</button>

        <div id="msg" class="msg"></div>
      </div>

      <script>
        async function submitReset() {
          const password = document.getElementById('password').value;
          const confirm = document.getElementById('confirm').value;
          const msg = document.getElementById('msg');

          if (!password || password.length < 6) {
            msg.className = 'msg error';
            msg.style.display = 'block';
            msg.textContent = 'Le mot de passe doit contenir au moins 6 caractères';
            return;
          }

          if (password !== confirm) {
            msg.className = 'msg error';
            msg.style.display = 'block';
            msg.textContent = 'Les mots de passe ne correspondent pas';
            return;
          }

          try {
            const res = await fetch('/api/users/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: '${token}', newPassword: password })
            });
            const data = await res.json();

            if (res.ok) {
              msg.className = 'msg success';
              msg.style.display = 'block';
              msg.textContent = data.message + ' Retournez sur l'application KB Events pour vous connecter.';
            } else {
              msg.className = 'msg error';
              msg.style.display = 'block';
              msg.textContent = data.message;
            }
          } catch(e) {
            msg.className = 'msg error';
            msg.style.display = 'block';
            msg.textContent = 'Erreur de connexion. Réessayez.';
          }
        }
      </script>
    </body>
    </html>
  `;
}

// SUPPRIMER SON COMPTE
exports.deleteAccount = async (req, res) => {
  const userId = req.user.id;

  try {
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: "Compte supprimé avec succès" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.renderResetPage = renderResetPage;